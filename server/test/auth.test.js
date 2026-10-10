import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';
import { createSupabaseTokenVerifier, createTokenVerifier } from '../src/services/auth.js';
import { createTestAuth, TEST_ISSUER } from './helpers.js';

const userId = randomUUID();
const { verifyToken, tokenFor } = await createTestAuth();

const rejectsWith = (promise, status, code) => assert.rejects(promise, (err) => err.status === status && err.code === code);

describe('createTokenVerifier (asymmetric keys via JWKS)', () => {
  it('accepts a valid token and returns the user id from "sub"', async () => {
    const identity = await verifyToken(await tokenFor(userId));
    assert.equal(identity.userId, userId);
    assert.equal(identity.email, `${userId.slice(0, 8)}@example.test`);
  });

  it('reports an expired token distinctly', async () => {
    const token = await tokenFor(userId, { expiresIn: Math.floor(Date.now() / 1000) - 60 });
    await rejectsWith(verifyToken(token), 401, 'token_expired');
  });

  it('rejects a token signed by a different key', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    await rejectsWith(verifyToken(await tokenFor(userId, { key: privateKey })), 401, 'token_invalid');
  });

  it('rejects a token from another Supabase project (issuer)', async () => {
    await rejectsWith(verifyToken(await tokenFor(userId, { issuer: 'https://other.supabase.co/auth/v1' })), 401, 'token_invalid');
  });

  it('rejects a token for another audience', async () => {
    await rejectsWith(verifyToken(await tokenFor(userId, { audience: 'service' })), 401, 'token_invalid');
  });

  it('rejects anon-role tokens (e.g. the anon key itself)', async () => {
    await rejectsWith(verifyToken(await tokenFor(userId, { claims: { role: 'anon' } })), 401, 'token_invalid');
  });

  it('rejects a token whose subject is not a user id', async () => {
    await rejectsWith(verifyToken(await tokenFor('not-a-uuid')), 401, 'token_invalid');
  });

  it('rejects malformed and unsigned tokens', async () => {
    await rejectsWith(verifyToken('not.a.jwt'), 401, 'token_invalid');
    const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', iss: TEST_ISSUER, exp: 9999999999 }),
    ).toString('base64url')}.`;
    await rejectsWith(verifyToken(unsigned), 401, 'token_invalid');
  });

  it('reports a signing-key fetch failure as 503, not as a bad token', async () => {
    const unreachable = createTokenVerifier({
      issuer: TEST_ISSUER,
      key: async () => {
        throw new TypeError('fetch failed');
      },
      algorithms: ['ES256'],
    });
    await rejectsWith(unreachable(await tokenFor(userId)), 503, 'auth_unavailable');
  });
});

describe('createSupabaseTokenVerifier', () => {
  it('verifies legacy HS256 tokens when SUPABASE_JWT_SECRET is set', async () => {
    const secret = 'legacy-project-jwt-secret-at-least-32-chars';
    const verify = createSupabaseTokenVerifier({ url: 'https://legacy.supabase.co', jwtSecret: secret });
    const sign = (key) =>
      new SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuer('https://legacy.supabase.co/auth/v1')
        .setAudience('authenticated')
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(key));

    assert.equal((await verify(await sign(secret))).userId, userId);
    await rejectsWith(verify(await sign('a-different-secret-that-is-also-long')), 401, 'token_invalid');
  });

  it('fails closed with 503 when Supabase is not configured', async () => {
    const verify = createSupabaseTokenVerifier({ url: '', jwtSecret: '' });
    await rejectsWith(verify(await tokenFor(userId)), 503, 'auth_not_configured');
  });
});
