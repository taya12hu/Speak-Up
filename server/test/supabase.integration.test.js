import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { createSupabaseTokenVerifier } from '../src/services/auth.js';
import { createSessionRepository } from '../src/services/sessionRepository.js';

// End-to-end isolation tests against a REAL Supabase project: real Auth tokens, the real JWT
// verifier, real PostgREST, and the Row Level Security policies from supabase/migrations.
//
// Opt-in, because it creates two throwaway users (deleted afterwards, cascading their rows):
//   RUN_SUPABASE_TESTS=1 npm test --prefix server
// Requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY in server/.env and
// the migration applied. The service-role key is used only here to create/delete the test users
// and to inspect rows as an administrator; the app under test never receives it.

const { url, publishableKey } = config.supabase;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const skip =
  process.env.RUN_SUPABASE_TESTS !== '1'
    ? 'set RUN_SUPABASE_TESTS=1 to run against a real Supabase project'
    : !url || !publishableKey || !serviceKey
      ? 'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY are required'
      : false;

const SESSION = {
  mode: 'random',
  topic: 'Integration test topic',
  transcript: 'This is an integration test transcript.',
  metrics: { fillerCount: 0, fillerBreakdown: {}, wpm: 120, pauseCount: 0, longestPauseSec: 0, totalPauseSec: 0, stuckLoops: [] },
  analysis: { nativeRewrite: 'x', grammarIssues: [], pronunciationTips: [], fluencyCommentary: 'x', scores: { overall: 77 }, summary: 'x' },
};

describe('Supabase multi-user isolation (real project)', { skip }, () => {
  const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  let admin;
  let tmp;
  let server;
  let baseUrl;
  const users = {};

  async function createUser(label) {
    const email = `speakup-test-${label}-${randomUUID()}@example.com`;
    const password = randomBytes(18).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(url, publishableKey, { auth: noSession });
    const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return { id: data.user.id, token: signIn.session.access_token, db: userClient(signIn.session.access_token) };
  }

  const userClient = (token) =>
    createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: noSession });

  const api = (route, { method = 'GET', body, token } = {}) =>
    fetch(`${baseUrl}${route}`, {
      method,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
      ...(body && { body: JSON.stringify(body) }),
    });

  before(async () => {
    admin = createClient(url, serviceKey, { auth: noSession });
    users.a = await createUser('a');
    users.b = await createUser('b');

    tmp = await mkdtemp(path.join(tmpdir(), 'speakup-int-'));
    const app = createApp({
      askJSON: async () => ({}),
      transcribeWav: async () => ({ text: '', segments: [], durationSec: 0 }),
      checkWhisper: async () => ({ binary: true, model: true }),
      verifyToken: createSupabaseTokenVerifier(config.supabase),
      sessionRepository: createSessionRepository(config.supabase),
      tmpDir: tmp,
      geminiConfigured: true,
      authConfigured: true,
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    server?.close();
    // Deleting the users cascades to their practice_sessions rows.
    for (const user of Object.values(users)) await admin.auth.admin.deleteUser(user.id);
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });

  let sessionOfA;

  it('accepts a real Supabase access token and stores the session under the verified user', async () => {
    const res = await api('/sessions', { method: 'POST', token: users.a.token, body: { ...SESSION, user_id: users.b.id } });
    assert.equal(res.status, 201, await res.clone().text());
    sessionOfA = await res.json();

    const { data } = await admin.from('practice_sessions').select('user_id').eq('id', sessionOfA.id).single();
    assert.equal(data.user_id, users.a.id, 'owner comes from the token, not the forged body field');
  });

  it("user A sees their session; user B's history does not include it", async () => {
    const listA = await (await api('/sessions', { token: users.a.token })).json();
    const listB = await (await api('/sessions', { token: users.b.token })).json();
    assert.deepEqual(listA.map((s) => s.id), [sessionOfA.id]);
    assert.deepEqual(listB, []);
  });

  it("user B cannot delete user A's session through the API", async () => {
    const res = await api(`/sessions/${sessionOfA.id}`, { method: 'DELETE', token: users.b.token });
    assert.equal(res.status, 404);
    const { count } = await admin.from('practice_sessions').select('id', { count: 'exact', head: true }).eq('id', sessionOfA.id);
    assert.equal(count, 1);
  });

  describe('Row Level Security on direct database access (bypassing the API)', () => {
    it("B cannot read A's rows, even when filtering by A's id", async () => {
      const all = await users.b.db.from('practice_sessions').select('id');
      const targeted = await users.b.db.from('practice_sessions').select('id').eq('user_id', users.a.id);
      assert.equal(all.error, null);
      assert.deepEqual(all.data, []);
      assert.deepEqual(targeted.data, []);
    });

    it('B cannot insert a row owned by A', async () => {
      const { error } = await users.b.db.from('practice_sessions').insert({ ...SESSION, user_id: users.a.id });
      assert.equal(error?.code, '42501', `expected an RLS violation, got ${JSON.stringify(error)}`);
    });

    it("B cannot delete A's row", async () => {
      const { data } = await users.b.db.from('practice_sessions').delete().eq('id', sessionOfA.id).select('id');
      assert.deepEqual(data ?? [], []);
      const { count } = await admin.from('practice_sessions').select('id', { count: 'exact', head: true }).eq('id', sessionOfA.id);
      assert.equal(count, 1);
    });

    it('sessions are immutable: even the owner cannot update them', async () => {
      const { error } = await users.a.db.from('practice_sessions').update({ topic: 'changed' }).eq('id', sessionOfA.id);
      assert.equal(error?.code, '42501', `expected permission denied, got ${JSON.stringify(error)}`);
    });

    it('clients cannot choose id or created_at', async () => {
      const { error } = await users.a.db.from('practice_sessions').insert({ ...SESSION, user_id: users.a.id, created_at: '2000-01-01T00:00:00Z' });
      assert.equal(error?.code, '42501', `expected permission denied, got ${JSON.stringify(error)}`);
    });

    it('signed-out (anon) callers get nothing', async () => {
      const anon = createClient(url, publishableKey, { auth: noSession });
      const { data, error } = await anon.from('practice_sessions').select('id');
      assert.ok(error || data.length === 0, 'anon must not read any rows');
    });
  });

  it('rejects an invalid token from the real verifier', async () => {
    const res = await api('/sessions', { token: `${users.a.token.slice(0, -4)}AAAA` });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, 'token_invalid');
  });

  it('keeps concurrent writes from different users separate', async () => {
    await Promise.all(
      [users.a, users.b, users.a, users.b].map((u, i) => api('/sessions', { method: 'POST', token: u.token, body: { ...SESSION, topic: `concurrent ${i}` } })),
    );
    const listA = await (await api('/sessions', { token: users.a.token })).json();
    const listB = await (await api('/sessions', { token: users.b.token })).json();
    assert.deepEqual(listA.map((s) => s.topic).sort(), ['Integration test topic', 'concurrent 0', 'concurrent 2']);
    assert.deepEqual(listB.map((s) => s.topic).sort(), ['concurrent 1', 'concurrent 3']);
  });

  it('lets the owner delete their own session', async () => {
    const res = await api(`/sessions/${sessionOfA.id}`, { method: 'DELETE', token: users.a.token });
    assert.equal(res.status, 204);
    const listA = await (await api('/sessions', { token: users.a.token })).json();
    assert.equal(listA.some((s) => s.id === sessionOfA.id), false);
  });
});
