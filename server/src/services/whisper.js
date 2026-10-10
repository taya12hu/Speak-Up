import { spawn } from 'child_process';
import { access, readFile, unlink } from 'fs/promises';
import { HttpError } from '../errors.js';

/**
 * Wraps the local whisper.cpp CLI. Returns `transcribeWav(wavPath)` and `checkInstallation()`.
 */
export function createWhisper({ binPath, modelPath, timeoutMs }) {
  /**
   * Runs whisper.cpp on a 16-bit PCM WAV file and returns { text, segments, durationSec }.
   * Segments are near-word-level because we pass -ml 1 (max line length of 1 word); the
   * client derives pause statistics from the gaps between them.
   */
  async function transcribeWav(wavPath) {
    const durationSec = wavDurationSec(await readFile(wavPath));
    const outBase = wavPath.replace(/\.wav$/, '');
    await runWhisper(['-m', modelPath, '-f', wavPath, '-oj', '-of', outBase, '-ml', '1']);

    const jsonPath = `${outBase}.json`;
    try {
      const raw = JSON.parse(await readFile(jsonPath, 'utf-8'));
      return { ...parseWhisperOutput(raw), durationSec };
    } finally {
      await unlink(jsonPath).catch(() => {});
    }
  }

  function runWhisper(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(binPath, args);
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill();
        reject(new HttpError(504, `Transcription timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);

      // whisper.cpp logs verbosely to stderr; keep only the tail for error messages.
      proc.stderr.on('data', (d) => (stderr = (stderr + d.toString()).slice(-2000)));
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new HttpError(503, `Could not start whisper.cpp (${err.code ?? err.message}). Check WHISPER_BIN_PATH.`));
      });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`whisper.cpp exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
  }

  /** Reports whether the configured binary and model exist, for the health endpoint and startup log. */
  async function checkInstallation() {
    const exists = (p) => access(p).then(() => true, () => false);
    const [binary, model] = await Promise.all([exists(binPath), exists(modelPath)]);
    return { binary, model, binPath, modelPath };
  }

  return { transcribeWav, checkInstallation };
}

/** Reads the sample count from a PCM WAV header to compute duration without needing ffprobe. */
export function wavDurationSec(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new HttpError(400, 'Uploaded audio is not a WAV file');
  }

  let sampleRate = null;
  let bitsPerSample = null;
  let channels = null;
  let dataSize = null;

  let offset = 12; // skip RIFF header + "WAVE"
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (chunkId === 'fmt ' && bodyStart + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(bodyStart + 2);
      sampleRate = buffer.readUInt32LE(bodyStart + 4);
      bitsPerSample = buffer.readUInt16LE(bodyStart + 14);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
    }

    offset = bodyStart + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (!sampleRate || !channels || !bitsPerSample || dataSize === null) {
    throw new HttpError(400, 'Could not parse WAV header');
  }
  return dataSize / (bitsPerSample / 8) / channels / sampleRate;
}

/** Converts whisper.cpp's `-oj` JSON output into { text, segments } with times in seconds. */
export function parseWhisperOutput(raw) {
  const segments = (raw.transcription || []).map((seg) => ({
    text: seg.text.trim(),
    start: timeToSec(seg.offsets?.from ?? seg.timestamps?.from),
    end: timeToSec(seg.offsets?.to ?? seg.timestamps?.to),
  }));
  const text = segments
    .map((s) => s.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { text, segments };
}

export function timeToSec(value) {
  if (typeof value === 'number') return value / 1000; // offsets.from/to are milliseconds
  if (typeof value === 'string') {
    // "HH:MM:SS,mmm" format from timestamps.from/to
    const [h, m, sRest] = value.split(':');
    const [s, ms] = sRest.split(',');
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  }
  return 0;
}
