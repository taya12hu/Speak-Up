import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '../src/errors.js';
import { parseWhisperOutput, timeToSec, wavDurationSec } from '../src/services/whisper.js';
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
