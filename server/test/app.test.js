import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { HttpError } from '../src/errors.js';
import { SCORE_WEIGHTS } from '../src/scoring.js';
import { createMemoryRepository, createTestAuth, makeWav } from './helpers.js';

// Route-level tests against the real Express app and the real token verifier (tokens are signed
// with a locally generated key). Gemini, whisper.cpp and the database are replaced with in-test
// implementations so these tests run offline; real-database isolation is covered separately by
// supabase.integration.test.js.

const METRICS = { fillerCount: 2, wpm: 130, pauseCount: 1, longestPauseSec: 1.8, totalPauseSec: 1.8, stuckLoops: [] };
const dimensionScores = Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((k) => [k, 80]));
const validSession = {
  mode: 'random',
  topic: 'Pets',
  transcript: 'I like dogs.',
  metrics: METRICS,
  analysis: { grammarIssues: [], scores: { ...dimensionScores, overall: 80 } },
};

describe('HTTP API', () => {
  const userA = randomUUID();
  const userB = randomUUID();
  let auth;
  let tokenA;
  let tokenB;
  let tmpRoot;
  let tmpDir;
  let baseUrl;
  let server;
  // Each test sets these to control what the stand-in services do.
  let askJSONImpl;
  let transcribeImpl;
  let repository;
  const calls = { askJSON: [], transcribe: [] };

  before(async () => {
    auth = await createTestAuth();
    tokenA = await auth.tokenFor(userA);
    tokenB = await auth.tokenFor(userB);
    tmpRoot = await mkdtemp(path.join(tmpdir(), 'speakup-app-'));
    tmpDir = path.join(tmpRoot, 'tmp');
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
      verifyToken: auth.verifyToken,
      sessionRepository: { forUser: (identity) => repository.forUser(identity) },
      tmpDir,
      geminiConfigured: true,
      authConfigured: true,
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    server.close();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    calls.askJSON.length = 0;
    calls.transcribe.length = 0;
    askJSONImpl = async () => ({});
    transcribeImpl = async () => ({ text: '', segments: [], durationSec: 0 });
    repository = createMemoryRepository();
  });

  /** Calls the API as user A unless another `token` (or `null` for none) is given. */
  const api = (route, { method = 'GET', body, form, token = tokenA, headers = {} } = {}) => {
    const payload = form ?? (body !== undefined ? JSON.stringify(body) : undefined);
    return fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(payload !== undefined && { body: payload }),
    });
  };
  const post = (route, body, options) => api(route, { method: 'POST', body, ...options });

  describe('GET /health', () => {
    it('is public and reports dependency status only', async () => {
      const res = await api('/health', { token: null });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { gemini: { configured: true }, whisper: { binary: true, model: false }, auth: { configured: true } });
    });
  });

  describe('authentication', () => {
    const privateRoutes = [
      ['GET', '/sessions'],
      ['POST', '/sessions'],
      ['DELETE', `/sessions/${randomUUID()}`],
      ['POST', '/topics'],
      ['POST', '/vocab'],
      ['POST', '/interview-sample'],
      ['POST', '/analyze'],
      ['POST', '/transcribe'],
    ];

    for (const [method, route] of privateRoutes) {
      it(`${method} ${route.replace(/[0-9a-f-]{36}/, ':id')} requires a token`, async () => {
        const res = await api(route, { method, token: null, body: method === 'POST' ? {} : undefined });
        assert.equal(res.status, 401);
        assert.equal(res.headers.get('www-authenticate'), 'Bearer');
        assert.deepEqual(await res.json(), { error: 'Please sign in to continue.', code: 'auth_required' });
      });
    }

    it('rejects a non-Bearer authorization header', async () => {
      const res = await api('/sessions', { token: null, headers: { Authorization: `Basic ${Buffer.from('a:b').toString('base64')}` } });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).code, 'auth_required');
    });

    it('rejects an expired token with code token_expired', async () => {
      const expired = await auth.tokenFor(userA, { expiresIn: Math.floor(Date.now() / 1000) - 5 });
      const res = await api('/sessions', { token: expired });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).code, 'token_expired');
      assert.match(res.headers.get('www-authenticate'), /invalid_token/);
    });

    it('rejects a forged token with code token_invalid', async () => {
      const [header, , signature] = tokenA.split('.');
      const forgedPayload = Buffer.from(JSON.stringify({ sub: userB, role: 'authenticated', aud: 'authenticated', exp: 9999999999 })).toString('base64url');
      const res = await api('/sessions', { token: `${header}.${forgedPayload}.${signature}` });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).code, 'token_invalid');
      assert.deepEqual(repository.owners, []);
    });

    it('does not run the model for unauthenticated AI requests', async () => {
      await post('/vocab', {}, { token: null });
      await post('/topics', {}, { token: 'garbage' });
      assert.equal(calls.askJSON.length, 0);
    });

    it('never writes unauthenticated uploads to disk', async () => {
      const form = new FormData();
      form.append('audio', new Blob([makeWav({ seconds: 1 })]), 'recording.wav');
      const res = await api('/transcribe', { method: 'POST', form, token: null });
      assert.equal(res.status, 401);
      assert.deepEqual(await readdir(tmpDir), []);
      assert.equal(calls.transcribe.length, 0);
    });
  });

  describe('session ownership and isolation', () => {
    it('stores a new session under the verified user, ignoring any user id in the body', async () => {
      const res = await post('/sessions', { ...validSession, user_id: userB, userId: userB, id: 'client-id', date: '1999-01-01' });
      assert.equal(res.status, 201);
      const saved = await res.json();
      assert.notEqual(saved.id, 'client-id');
      assert.ok(Date.now() - Date.parse(saved.date) < 60_000);
      assert.equal(saved.user_id, undefined, 'owner id is not echoed to the client');
      assert.deepEqual(repository.owners, [userA]);
      assert.equal(repository.rows[0].user_id, userA);
    });

    it("lists only the caller's sessions", async () => {
      await post('/sessions', { ...validSession, topic: 'A1' });
      await post('/sessions', { ...validSession, topic: 'A2' });
      await post('/sessions', { ...validSession, topic: 'B1' }, { token: tokenB });

      const listA = await (await api('/sessions')).json();
      const listB = await (await api('/sessions', { token: tokenB })).json();
      assert.deepEqual(listA.map((s) => s.topic), ['A2', 'A1']);
      assert.deepEqual(listB.map((s) => s.topic), ['B1']);
    });

    it("cannot be steered to another user's history with query parameters", async () => {
      await post('/sessions', { ...validSession, topic: 'B secret' }, { token: tokenB });
      const res = await api(`/sessions?user_id=${userB}&userId=${userB}`);
      assert.deepEqual(await res.json(), []);
    });

    it("cannot delete another user's session, and gets the same 404 as for a missing one", async () => {
      const bSession = await (await post('/sessions', validSession, { token: tokenB })).json();

      const foreign = await api(`/sessions/${bSession.id}`, { method: 'DELETE' });
      const missing = await api(`/sessions/${randomUUID()}`, { method: 'DELETE' });
      assert.equal(foreign.status, 404);
      assert.deepEqual(await foreign.json(), await missing.json());
      assert.equal(repository.rows.length, 1, "B's session still exists");
    });

    it('deletes the caller’s own session', async () => {
      const mine = await (await post('/sessions', validSession)).json();
      const res = await api(`/sessions/${mine.id}`, { method: 'DELETE' });
      assert.equal(res.status, 204);
      assert.deepEqual(await (await api('/sessions')).json(), []);
    });

    it('rejects a malformed session id before touching the database', async () => {
      const res = await api('/sessions/not-a-uuid', { method: 'DELETE' });
      assert.equal(res.status, 400);
      assert.deepEqual(repository.owners, []);
    });

    it('rejects sessions with an invalid mode or missing scores', async () => {
      assert.equal((await post('/sessions', { ...validSession, mode: 'history' })).status, 400);
      assert.equal((await post('/sessions', { ...validSession, analysis: { grammarIssues: [] } })).status, 400);
      assert.equal(repository.rows.length, 0);
    });
  });

  describe('database failures', () => {
    const failingRepository = (error) => ({
      forUser: () => ({
        list: async () => {
          throw error;
        },
        create: async () => {
          throw error;
        },
        remove: async () => {
          throw error;
        },
      }),
    });

    it('reports an unavailable database as 503 without internal details', async (t) => {
      t.mock.method(console, 'error', () => {});
      const dbError = new HttpError(503, 'Practice history is temporarily unavailable. Please try again.', 'db_unavailable');
      dbError.cause = new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2');
      repository = failingRepository(dbError);

      for (const res of [await api('/sessions'), await post('/sessions', validSession)]) {
        assert.equal(res.status, 503);
        const body = await res.json();
        assert.deepEqual(body, { error: 'Practice history is temporarily unavailable. Please try again.', code: 'db_unavailable' });
      }
    });

    it('turns an unexpected repository crash into a generic 500', async (t) => {
      t.mock.method(console, 'error', () => {});
      repository = failingRepository(new Error('relation "practice_sessions" does not exist'));
      const res = await api('/sessions');
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: 'Internal server error' });
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
      const res = await api('/transcribe', { method: 'POST', form: new FormData() });
      assert.equal(res.status, 400);
    });

    it('passes a .wav file to whisper and deletes it afterwards', async () => {
      transcribeImpl = async () => ({ text: 'hello', segments: [], durationSec: 1 });
      const form = new FormData();
      form.append('audio', new Blob([makeWav({ seconds: 1 })], { type: 'audio/wav' }), 'recording.wav');

      const res = await api('/transcribe', { method: 'POST', form });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { text: 'hello', segments: [], durationSec: 1 });
      assert.match(calls.transcribe[0], /\.wav$/);
      await assert.rejects(access(calls.transcribe[0]), { code: 'ENOENT' });
    });

    it('deletes the upload even when transcription fails', async (t) => {
      t.mock.method(console, 'error', () => {});
      transcribeImpl = async () => {
        throw new HttpError(503, 'Could not start whisper.cpp');
      };
      const form = new FormData();
      form.append('audio', new Blob([makeWav({ seconds: 1 })]), 'recording.wav');

      const res = await api('/transcribe', { method: 'POST', form });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'Could not start whisper.cpp' });
      await assert.rejects(access(calls.transcribe[0]), { code: 'ENOENT' });
    });

    it('gives concurrent uploads separate temporary files', async () => {
      transcribeImpl = async () => ({ text: 'x', segments: [], durationSec: 1 });
      const upload = (token) => {
        const form = new FormData();
        form.append('audio', new Blob([makeWav({ seconds: 1 })]), 'recording.wav');
        return api('/transcribe', { method: 'POST', form, token });
      };
      const responses = await Promise.all([upload(tokenA), upload(tokenB), upload(tokenA)]);
      assert.deepEqual(responses.map((r) => r.status), [200, 200, 200]);
      assert.equal(new Set(calls.transcribe).size, 3);
      assert.deepEqual(await readdir(tmpDir), []);
    });
  });

  describe('cross-site request protection', () => {
    for (const site of ['cross-site', 'same-site']) {
      it(`rejects ${site} browser requests before they reach the model`, async () => {
        const res = await post('/vocab', {}, { headers: { 'Sec-Fetch-Site': site } });
        assert.equal(res.status, 403);
        assert.equal(calls.askJSON.length, 0);
      });
    }

    it('allows same-origin browser requests', async () => {
      askJSONImpl = async () => ({ word: 'w' });
      const res = await post('/vocab', {}, { headers: { 'Sec-Fetch-Site': 'same-origin' } });
      assert.equal(res.status, 200);
    });
  });

  describe('error handling', () => {
    it('returns 400 for malformed JSON', async () => {
      const res = await api('/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, form: '{nope' });
      assert.equal(res.status, 400);
      assert.ok((await res.json()).error);
    });

    it('returns a JSON 404 for unknown API routes', async () => {
      const res = await api('/does-not-exist');
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
