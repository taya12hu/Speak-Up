import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { access, readFile, unlink } from 'fs/promises';
import { HttpError } from '../errors.js';

/**
 * Wraps the local whisper.cpp CLI. Returns `transcribeWav(wavPath)` and `checkInstallation()`.
 * `threads` is passed as `-t`; when omitted, whisper.cpp picks its own default (up to 4).
 */
export function createWhisper({ binPath, modelPath, timeoutMs, threads }) {
  /**
   * Runs whisper.cpp on a 16-bit PCM WAV file and returns { text, segments, durationSec }.
   * Segments are near-word-level because we pass -ml 1 (max line length of 1 word); the
   * client derives pause statistics from the gaps between them.
   */
  async function transcribeWav(wavPath) {
    const durationSec = wavDurationSec(await readFile(wavPath));
    const outBase = wavPath.replace(/\.wav$/, '');
    await runWhisper(['-m', modelPath, '-f', wavPath, '-oj', '-of', outBase, '-ml', '1', ...(threads ? ['-t', String(threads)] : [])]);

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

/**
 * Whole CPUs this process may use under a Linux cgroup CPU quota (Docker --cpus, Render plans),
 * or null when there is no quota or it cannot be read (e.g. on Windows/macOS).
 *
 * This matters because whisper.cpp's worker threads spin while waiting: with 4 threads under a
 * 0.5-CPU quota they burn the quota idling. Measured on a 60 s clip, base.en at 0.5 CPU: 4 threads
 * 449 s, 1 thread 75 s.
 */
export function cpuQuotaThreads(read = (p) => readFileSync(p, 'utf8')) {
  const tryRead = (p) => {
    try {
      return read(p).trim();
    } catch {
      return null;
    }
  };
  let quota;
  let period;
  const v2 = tryRead('/sys/fs/cgroup/cpu.max'); // cgroup v2: "<quota|max> <period>"
  if (v2) {
    [quota, period] = v2.split(/\s+/);
    if (quota === 'max') return null;
  } else {
    quota = tryRead('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'); // cgroup v1: -1 means unlimited
    period = tryRead('/sys/fs/cgroup/cpu/cpu.cfs_period_us');
  }
  const cpus = Number(quota) / Number(period);
  if (!Number.isFinite(cpus) || cpus <= 0) return null;
  return Math.max(1, Math.floor(cpus));
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
    // Smaller models (e.g. tiny.en) emit punctuation as separate one-token segments; re-attach it so
    // the transcript reads naturally and the client's word count (pace) is not inflated by ". , ?".
    .replace(/ ([.,!?;:)\]}%]|'(?:s|re|ve|ll|d|m|t)\b|n't\b)/g, '$1')
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
