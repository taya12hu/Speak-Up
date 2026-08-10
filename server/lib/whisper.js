import { spawn } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const WHISPER_BIN = process.env.WHISPER_BIN_PATH || path.join(ROOT, 'whisper', 'bin', 'whisper-cli.exe');
const WHISPER_MODEL = process.env.WHISPER_MODEL_PATH || path.join(ROOT, 'whisper', 'models', 'ggml-base.en.bin');

/** Reads sample count directly from a 16-bit PCM WAV header to compute duration without needing ffprobe. */
function wavDurationSec(buffer) {
  let sampleRate = null;
  let bitsPerSample = 16;
  let channels = 1;
  let dataSize = null;

  let offset = 12; // skip RIFF header + "WAVE"
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (chunkId === 'fmt ') {
      channels = buffer.readUInt16LE(bodyStart + 2);
      sampleRate = buffer.readUInt32LE(bodyStart + 4);
      bitsPerSample = buffer.readUInt16LE(bodyStart + 14);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
    }

    offset = bodyStart + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (!sampleRate || !dataSize) throw new Error('Could not parse WAV header');
  const bytesPerSample = bitsPerSample / 8;
  return dataSize / bytesPerSample / channels / sampleRate;
}

/**
 * Runs whisper.cpp on a WAV file and returns { text, segments, durationSec }.
 * segments are near-word-level because we pass -ml 1 (max line length of 1 word).
 */
export async function transcribeWav(wavPath) {
  const wavBuffer = await readFile(wavPath);
  const durationSec = wavDurationSec(wavBuffer);

  const outBase = wavPath.replace(/\.wav$/, '');
  await new Promise((resolve, reject) => {
    const proc = spawn(WHISPER_BIN, [
      '-m', WHISPER_MODEL,
      '-f', wavPath,
      '-oj',
      '-of', outBase,
      '-ml', '1',
    ]);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper.cpp exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });

  const jsonPath = `${outBase}.json`;
  const raw = JSON.parse(await readFile(jsonPath, 'utf-8'));
  await unlink(jsonPath).catch(() => {});

  const segments = (raw.transcription || []).map((seg) => ({
    text: seg.text.trim(),
    start: timeToSec(seg.offsets?.from ?? seg.timestamps?.from),
    end: timeToSec(seg.offsets?.to ?? seg.timestamps?.to),
  }));

  const text = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();

  return { text, segments, durationSec };
}

function timeToSec(value) {
  if (typeof value === 'number') return value / 1000; // offsets.from/to are milliseconds
  if (typeof value === 'string') {
    // "HH:MM:SS,mmm" format from timestamps.from/to
    const [h, m, sRest] = value.split(':');
    const [s, ms] = sRest.split(',');
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  }
  return 0;
}
