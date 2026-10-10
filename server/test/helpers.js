import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createTokenVerifier } from '../src/services/auth.js';

/** Builds a 16-bit PCM WAV buffer of silence, matching what the client's encoder produces. */
export function makeWav({ seconds, sampleRate = 16000, channels = 1 }) {
  const dataSize = Math.round(seconds * sampleRate) * channels * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

export const TEST_ISSUER = 'https://test-project.supabase.co/auth/v1';

/**
 * A local stand-in for a Supabase project's asymmetric signing key: the real verifier checks
 * tokens signed here exactly as it would check Supabase-issued ones (ES256 via a JWKS).
 */
export async function createTestAuth() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };
  const verifyToken = createTokenVerifier({ issuer: TEST_ISSUER, key: createLocalJWKSet({ keys: [jwk] }), algorithms: ['ES256'] });

  /** Signs a Supabase-shaped access token. Override claims or `expiresIn` to build bad tokens. */
  async function tokenFor(userId, { expiresIn = '1h', issuer = TEST_ISSUER, audience = 'authenticated', claims = {}, key = privateKey } = {}) {
    return new SignJWT({ role: 'authenticated', email: `${userId.slice(0, 8)}@example.test`, ...claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(userId)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(key);
  }

  return { verifyToken, tokenFor };
}

/**
 * In-memory practice history with the same per-user contract as services/sessionRepository.js.
 * Used by route tests to check that routes scope by the *verified* identity; the database-level
 * guarantee (RLS) is covered by supabase.integration.test.js against a real project.
 */
export function createMemoryRepository() {
  const rows = [];
  const owners = [];
  return {
    rows,
    /** User ids passed to forUser, in call order. */
    owners,
    forUser({ userId }) {
      owners.push(userId);
      const toSession = ({ user_id: _owner, created_at, ...rest }) => ({ ...rest, date: created_at });
      return {
        async list() {
          return rows.filter((r) => r.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(toSession);
        },
        async create(data) {
          const row = { id: randomUUID(), user_id: userId, created_at: new Date(Date.now() + rows.length).toISOString(), ...data };
          rows.push(row);
          return toSession(row);
        },
        async remove(id) {
          const index = rows.findIndex((r) => r.id === id && r.user_id === userId);
          if (index === -1) return false;
          rows.splice(index, 1);
          return true;
        },
      };
    },
  };
}
