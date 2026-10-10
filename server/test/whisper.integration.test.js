import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { config } from '../src/config.js';
import { createWhisper } from '../src/services/whisper.js';
import { makeWav } from './helpers.js';

// Runs the real whisper.cpp binary. Skipped (not failed) when it is not installed, since the
// binary and model are large local downloads that are not part of the repository.
const whisper = createWhisper({
  binPath: config.whisperBinPath,
  modelPath: config.whisperModelPath,
  timeoutMs: 120_000,
});
const installation = await whisper.checkInstallation();
const skip = !installation.binary || !installation.model ? 'whisper.cpp binary or model not installed' : false;

describe('whisper.cpp integration', { skip }, () => {
  it('transcribes a WAV file and cleans up its JSON output', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'speakup-whisper-'));
    try {
      const wavPath = path.join(dir, 'silence.wav');
      await writeFile(wavPath, makeWav({ seconds: 2 }));

      const result = await whisper.transcribeWav(wavPath);

      assert.equal(result.durationSec, 2);
      assert.equal(typeof result.text, 'string');
      assert.ok(Array.isArray(result.segments));
      assert.deepEqual(await readdir(dir), ['silence.wav']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('whisper.cpp process errors', () => {
  it('reports a missing binary as a 503', async () => {
    const broken = createWhisper({ binPath: path.join(tmpdir(), 'no-such-whisper'), modelPath: 'x', timeoutMs: 5000 });
    const dir = await mkdtemp(path.join(tmpdir(), 'speakup-whisper-'));
    try {
      const wavPath = path.join(dir, 'a.wav');
      await writeFile(wavPath, makeWav({ seconds: 1 }));
      await assert.rejects(broken.transcribeWav(wavPath), { status: 503 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
