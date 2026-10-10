import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createSessionRepository } from '../src/services/sessionRepository.js';

// Exercises the real supabase-js client against a local HTTP server standing in for PostgREST,
// to pin down the wire contract (whose token is sent, how queries are scoped) and failure mapping.

const PUBLISHABLE_KEY = 'sb_publishable_test';
const userId = randomUUID();
const token = 'user-access-token';
const ROW = {
  id: randomUUID(),
  created_at: '2026-10-10T12:00:00+00:00',
  mode: 'random',
  topic: 'Pets',
  transcript: 'I like dogs.',
  metrics: { wpm: 120 },
  analysis: { scores: { overall: 80 }, grammarIssues: [] },
};

describe('sessionRepository (Supabase REST)', () => {
  let server;
  let url;
  let requests;
  let respond;

  before(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const parsed = new URL(req.url, 'http://x');
        requests.push({ method: req.method, path: parsed.pathname, query: parsed.searchParams, headers: req.headers, body: body ? JSON.parse(body) : undefined });
        const { status = 200, json } = respond(req);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  beforeEach(() => {
    requests = [];
    respond = () => ({ json: [] });
  });

  const repo = () => createSessionRepository({ url, publishableKey: PUBLISHABLE_KEY }).forUser({ userId, token });

  it("queries with the user's own token, never a privileged key", async () => {
    await repo().list();
    const [req] = requests;
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    assert.equal(req.headers.apikey, PUBLISHABLE_KEY);
  });

  it('scopes the history query to the user, newest first', async () => {
    respond = () => ({ json: [ROW] });
    const sessions = await repo().list();

    const [req] = requests;
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/rest/v1/practice_sessions');
    assert.equal(req.query.get('user_id'), `eq.${userId}`);
    assert.equal(req.query.get('order'), 'created_at.desc');
    assert.doesNotMatch(req.query.get('select'), /user_id/, 'owner id is not selected');
    const { created_at: createdAt, ...rest } = ROW;
    assert.deepEqual(sessions, [{ ...rest, date: createdAt }]);
  });

  it('inserts with the verified user id and lets the database assign id and created_at', async () => {
    respond = () => ({ status: 201, json: ROW });
    const created = await repo().create({ mode: 'random', topic: 'Pets', transcript: 'x', metrics: {}, analysis: {} });

    const [req] = requests;
    assert.equal(req.method, 'POST');
    assert.equal(req.body.user_id, userId);
    assert.equal(req.body.id, undefined);
    assert.equal(req.body.created_at, undefined);
    assert.equal(created.id, ROW.id);
    assert.equal(created.date, ROW.created_at);
  });

  it('scopes deletes to both the session id and the user', async () => {
    respond = () => ({ json: [] });
    const sessionId = randomUUID();
    assert.equal(await repo().remove(sessionId), false);

    const [req] = requests;
    assert.equal(req.method, 'DELETE');
    assert.equal(req.query.get('id'), `eq.${sessionId}`);
    assert.equal(req.query.get('user_id'), `eq.${userId}`);
  });

  it('reports a successful delete', async () => {
    respond = () => ({ json: [{ id: ROW.id }] });
    assert.equal(await repo().remove(ROW.id), true);
  });

  describe('database failures', () => {
    it('maps an unreachable database to 503 db_unavailable', async () => {
      const unreachable = createSessionRepository({ url: 'http://127.0.0.1:9', publishableKey: PUBLISHABLE_KEY });
      await assert.rejects(unreachable.forUser({ userId, token }).list(), { status: 503, code: 'db_unavailable' });
    });

    it('maps a PostgREST server error to a generic 500, keeping details only in the cause', async () => {
      respond = () => ({ status: 500, json: { code: 'XX000', message: 'internal error at 10.0.0.5', details: null, hint: null } });
      await assert.rejects(repo().list(), (err) => {
        assert.equal(err.status, 500);
        assert.doesNotMatch(err.message, /10\.0\.0\.5/);
        assert.match(err.cause.message, /10\.0\.0\.5/);
        return true;
      });
    });

    it('maps a JWT rejected by the database to 401 token_expired', async () => {
      respond = () => ({ status: 401, json: { code: 'PGRST303', message: 'JWT expired', details: null, hint: null } });
      await assert.rejects(repo().list(), { status: 401, code: 'token_expired' });
    });

    it('maps a check-constraint violation to 400', async () => {
      respond = () => ({ status: 400, json: { code: '23514', message: 'violates check constraint', details: null, hint: null } });
      await assert.rejects(repo().create({ mode: 'random', topic: 't', transcript: 'x', metrics: {}, analysis: {} }), { status: 400, code: 'invalid_session' });
    });

    it('fails closed with 503 when Supabase is not configured', () => {
      const unconfigured = createSessionRepository({ url: '', publishableKey: '' });
      assert.throws(() => unconfigured.forUser({ userId, token }), { status: 503, code: 'db_not_configured' });
    });
  });

  it('keeps no state between users: each call is bound to its own identity', async () => {
    const repository = createSessionRepository({ url, publishableKey: PUBLISHABLE_KEY });
    const other = randomUUID();
    await Promise.all([repository.forUser({ userId, token: 'token-a' }).list(), repository.forUser({ userId: other, token: 'token-b' }).list()]);
    const byToken = Object.fromEntries(requests.map((r) => [r.headers.authorization, r.query.get('user_id')]));
    assert.deepEqual(byToken, { 'Bearer token-a': `eq.${userId}`, 'Bearer token-b': `eq.${other}` });
  });
});
