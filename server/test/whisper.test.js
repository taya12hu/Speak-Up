import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '../src/errors.js';
import { cpuQuotaThreads, parseWhisperOutput, timeToSec, wavDurationSec } from '../src/services/whisper.js';
import { makeWav } from './helpers.js';

describe('wavDurationSec', () => {
  it('computes duration from a mono 16 kHz header', () => {
    assert.equal(wavDurationSec(makeWav({ seconds: 2.5 })), 2.5);
  });

  it('accounts for channel count and sample rate', () => {
    assert.equal(wavDurationSec(makeWav({ seconds: 1, sampleRate: 44100, channels: 2 })), 1);
  });

  it('skips unknown chunks between fmt and data', () => {
    const wav = makeWav({ seconds: 1 });
    const list = Buffer.alloc(8 + 4);
    list.write('LIST', 0, 'ascii');
    list.writeUInt32LE(4, 4);
    const withExtraChunk = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);
    assert.equal(wavDurationSec(withExtraChunk), 1);
  });

  it('rejects non-WAV input with a 400', () => {
    assert.throws(() => wavDurationSec(Buffer.from('not a wav file at all')), (err) => err instanceof HttpError && err.status === 400);
  });

  it('rejects a WAV without a data chunk', () => {
    const headerOnly = makeWav({ seconds: 0 }).subarray(0, 36);
    assert.throws(() => wavDurationSec(headerOnly), /Could not parse WAV header/);
  });
});

describe('parseWhisperOutput', () => {
  it('converts millisecond offsets to seconds and joins text', () => {
    const raw = {
      transcription: [
        { text: ' Hello', offsets: { from: 0, to: 500 } },
        { text: ' world. ', offsets: { from: 2500, to: 3000 } },
      ],
    };
    assert.deepEqual(parseWhisperOutput(raw), {
      text: 'Hello world.',
      segments: [
        { text: 'Hello', start: 0, end: 0.5 },
        { text: 'world.', start: 2.5, end: 3 },
      ],
    });
  });

  it('falls back to string timestamps when offsets are absent', () => {
    const raw = { transcription: [{ text: 'hi', timestamps: { from: '00:01:02,250', to: '00:01:03,000' } }] };
    assert.deepEqual(parseWhisperOutput(raw).segments, [{ text: 'hi', start: 62.25, end: 63 }]);
  });

  it('re-attaches punctuation and contractions that small models emit as separate segments', () => {
    const words = ['I', 'think', 'that', "'s", 'listening', '.', 'Um', ',', 'we', 'do', "n't", 'listen', '?'];
    const raw = { transcription: words.map((w, i) => ({ text: ` ${w}`, offsets: { from: i * 100, to: i * 100 + 50 } })) };
    assert.equal(parseWhisperOutput(raw).text, "I think that's listening. Um, we don't listen?");
  });

  it('handles output with no transcription', () => {
    assert.deepEqual(parseWhisperOutput({}), { text: '', segments: [] });
  });
});

describe('timeToSec', () => {
  it('parses HH:MM:SS,mmm', () => {
    assert.equal(timeToSec('01:00:00,500'), 3600.5);
  });

  it('returns 0 for missing values', () => {
    assert.equal(timeToSec(undefined), 0);
  });
});

describe('cpuQuotaThreads', () => {
  const files = (map) => (p) => {
    if (p in map) return map[p];
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  };

  it('uses one thread for fractional quotas (Render Free 0.1, Starter 0.5)', () => {
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu.max': '10000 100000\n' })), 1);
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu.max': '50000 100000' })), 1);
  });

  it('rounds whole-CPU quotas down (cgroup v2)', () => {
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu.max': '200000 100000' })), 2);
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu.max': '150000 100000' })), 1);
  });

  it('returns null when there is no quota', () => {
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu.max': 'max 100000' })), null);
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '-1', '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000' })), null);
  });

  it('reads cgroup v1 quota files', () => {
    assert.equal(cpuQuotaThreads(files({ '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '400000', '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000' })), 4);
  });

  it('returns null when cgroup files are absent (Windows, macOS)', () => {
    assert.equal(cpuQuotaThreads(files({})), null);
  });
});
