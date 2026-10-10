import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { HttpError } from '../src/errors.js';
import { SCORE_WEIGHTS } from '../src/scoring.js';
import { createSessionStore } from '../src/services/sessionStore.js';
import { makeWav } from './helpers.js';

// Route-level tests. Gemini and whisper.cpp are replaced with in-test stubs so these tests
// exercise validation, wiring, and error mapping without network access or the whisper binary.

const METRICS = { fillerCount: 2, wpm: 130, pauseCount: 1, longestPauseSec: 1.8, totalPauseSec: 1.8, stuckLoops: [] };
const dimensionScores = Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((k) => [k, 80]));

describe('HTTP API', () => {
  let dataDir;
  let baseUrl;
  let server;
  // Each test sets these to control what the stubbed services do.
  let askJSONImpl;
  let transcribeImpl;
  const calls = { askJSON: [], transcribe: [] };

  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'speakup-app-'));
    const tmpDir = path.join(dataDir, 'tmp');
    await mkdir(tmpDir);
    const app = createApp({
      askJSON: async (args) => {
        calls.askJSON.push(args);
        return askJSONImpl(args);
      },
      transcribeWav: async (wavPath) => {
        calls.transcribe.push(wavPath);
        return transcribeImpl(wavPath);
      },
      checkWhisper: async () => ({ binary: true, model: false }),
      sessionStore: createSessionStore(dataDir),
      tmpDir,
      geminiConfigured: true,
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    calls.askJSON.length = 0;
    calls.transcribe.length = 0;
    askJSONImpl = async () => ({});
    transcribeImpl = async () => ({ text: '', segments: [], durationSec: 0 });
  });

  const post = (route, body) =>
    fetch(`${baseUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  describe('GET /health', () => {
    it('reports dependency status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { gemini: { configured: true }, whisper: { binary: true, model: false } });
    });
  });

  describe('POST /topics', () => {
    it('applies defaults and returns the model output', async () => {
      askJSONImpl = async () => ['Topic one', 'Topic two'];
      const res = await post('/topics', {});
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), ['Topic one', 'Topic two']);
      assert.match(calls.askJSON[0].prompt, /^Generate 5 impromptu speaking topics/);
    });

    for (const [body, field] of [
      [{ count: 500 }, 'count'],
      [{ count: '5' }, 'count'],
      [{ category: 'unknown' }, 'category'],
      [{ difficulty: 'Insane' }, 'difficulty'],
      [{ theme: 'x'.repeat(101) }, 'theme'],
    ]) {
      it(`rejects invalid ${field} without calling the model`, async () => {
        const res = await post('/topics', body);
        assert.equal(res.status, 400);
        assert.match((await res.json()).error, new RegExp(`"${field}"`));
        assert.equal(calls.askJSON.length, 0);
      });
    }
  });

  describe('POST /interview-sample', () => {
    it('requires a known framework', async () => {
      const res = await post('/interview-sample', { question: 'Why us?', framework: 'XYZ' });
      assert.equal(res.status, 400);
    });

    it('returns the sample', async () => {
      askJSONImpl = async () => ({ sample: 'Situation: ...' });
      const res = await post('/interview-sample', { question: 'Why us?', framework: 'STAR' });
      assert.deepEqual(await res.json(), { sample: 'Situation: ...' });
    });
  });

  describe('POST /analyze', () => {
    it('rejects a request without metrics (previously a 500 TypeError)', async () => {
      const res = await post('/analyze', { topic: 'Pets', transcript: 'I like dogs.' });
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, /"metrics"/);
    });

    it('rejects an empty transcript', async () => {
      const res = await post('/analyze', { topic: 'Pets', transcript: '  ', metrics: METRICS });
      assert.equal(res.status, 400);
    });

    it('computes the overall score server-side', async () => {
      askJSONImpl = async () => ({ summary: 'ok', scores: { ...dimensionScores, grammar: 100, overall: 3 } });
      const res = await post('/analyze', { topic: 'Pets', transcript: 'I like dogs.', metrics: METRICS });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.scores.grammar, 100);
      assert.equal(body.scores.overall, 83); // 80 + 0.15 * 20
    });
  });

  describe('POST /transcribe', () => {
    it('rejects a request with no file', async () => {
      const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: new FormData() });
      assert.equal(res.status, 400);
    });

    it('passes a .wav file to whisper and deletes it afterwards', async () => {
      transcribeImpl = async () => ({ text: 'hello', segments: [], durationSec: 1 });
      const form = new FormData();
      form.append('audio', new Blob([makeWav({ seconds: 1 })], { type: 'audio/wav' }), 'recording.wav');

      const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: form });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { text: 'hello', segments: [], durationSec: 1 });
      assert.match(calls.transcribe[0], /\.wav$/);
      await assert.rejects(access(calls.transcribe[0]), { code: 'ENOENT' });
    });

    it('deletes the upload even when transcription fails', async () => {
      transcribeImpl = async () => {
        throw new HttpError(503, 'Could not start whisper.cpp');
      };
      const form = new FormData();
      form.append('audio', new Blob([makeWav({ seconds: 1 })]), 'recording.wav');

      const res = await fetch(`${baseUrl}/transcribe`, { method: 'POST', body: form });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'Could not start whisper.cpp' });
      await assert.rejects(access(calls.transcribe[0]), { code: 'ENOENT' });
    });
  });

  describe('sessions', () => {
    const validSession = {
      mode: 'random',
      topic: 'Pets',
      transcript: 'I like dogs.',
      metrics: METRICS,
      analysis: { grammarIssues: [], scores: { ...dimensionScores, overall: 80 } },
    };

    it('assigns id and date, then lists the saved session', async () => {
      const res = await post('/sessions', { ...validSession, id: 'client-id', date: '1999-01-01' });
      assert.equal(res.status, 201);
      const saved = await res.json();
      assert.notEqual(saved.id, 'client-id');
      assert.ok(Date.now() - Date.parse(saved.date) < 60_000);

      const list = await (await fetch(`${baseUrl}/sessions`)).json();
      assert.equal(list[0].id, saved.id);
    });

    it('rejects sessions with an invalid mode or missing scores', async () => {
      assert.equal((await post('/sessions', { ...validSession, mode: 'history' })).status, 400);
      assert.equal((await post('/sessions', { ...validSession, analysis: { grammarIssues: [] } })).status, 400);
    });
  });

  describe('cross-site request protection', () => {
    for (const site of ['cross-site', 'same-site']) {
      it(`rejects ${site} browser requests before they reach the model`, async () => {
        const res = await fetch(`${baseUrl}/vocab`, { method: 'POST', headers: { 'Sec-Fetch-Site': site } });
        assert.equal(res.status, 403);
        assert.equal(calls.askJSON.length, 0);
      });
    }

    it('allows same-origin browser requests', async () => {
      askJSONImpl = async () => ({ word: 'w' });
      const res = await fetch(`${baseUrl}/vocab`, { method: 'POST', headers: { 'Sec-Fetch-Site': 'same-origin' } });
      assert.equal(res.status, 200);
    });
  });

  describe('error handling', () => {
    it('returns 400 for malformed JSON', async () => {
      const res = await fetch(`${baseUrl}/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
      assert.equal(res.status, 400);
      assert.ok((await res.json()).error);
    });

    it('returns a JSON 404 for unknown API routes', async () => {
      const res = await fetch(`${baseUrl}/does-not-exist`);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'Not found' });
    });

    it('forwards client-safe service errors with their status', async () => {
      askJSONImpl = async () => {
        throw new HttpError(429, 'Gemini rate limit reached');
      };
      const res = await post('/vocab', {});
      assert.equal(res.status, 429);
      assert.deepEqual(await res.json(), { error: 'Gemini rate limit reached' });
    });

    it('hides unexpected error details behind a generic 500', async (t) => {
      t.mock.method(console, 'error', () => {});
      askJSONImpl = async () => {
        throw new Error('secret internal detail');
      };
      const res = await post('/vocab', {});
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: 'Internal server error' });
    });
  });
});
