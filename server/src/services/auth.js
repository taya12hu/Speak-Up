import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { HttpError } from '../errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const expired = () => new HttpError(401, 'Your session has expired. Please sign in again.', 'token_expired');
const invalid = () => new HttpError(401, 'Invalid authentication token. Please sign in again.', 'token_invalid');

/**
 * Verifies Supabase access tokens locally (signature, issuer, audience, expiry) and returns the
 * caller's identity. `key` is a JWKS resolver (asymmetric signing keys) or a secret (legacy HS256).
 *
 * Note: local verification cannot see server-side sign-outs, so a token stays usable until it
 * expires (Supabase default: 1 hour). See DESIGN_DECISIONS.md for the trade-off.
 */
export function createTokenVerifier({ issuer, key, algorithms }) {
  return async function verifyToken(token) {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, key, { issuer, audience: 'authenticated', algorithms, requiredClaims: ['sub', 'exp'] }));
    } catch (err) {
      if (err instanceof errors.JWTExpired) throw expired();
      // Could not fetch the signing keys: an infrastructure problem, not a bad token.
      if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) {
        throw new HttpError(503, 'Could not verify your sign-in right now. Please try again.', 'auth_unavailable');
      }
      throw invalid();
    }
    // Reject the anon key (role "anon", no user) and any token without a user id.
    if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw invalid();
    return { userId: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  };
}

/** Builds the verifier for a Supabase project from server configuration. */
export function createSupabaseTokenVerifier({ url, jwtSecret }) {
  if (!url) {
    return async () => {
      throw new HttpError(503, 'Sign-in is not configured on the server (set SUPABASE_URL in server/.env).', 'auth_not_configured');
    };
  }
  const issuer = `${url}/auth/v1`;
  if (jwtSecret) return createTokenVerifier({ issuer, key: new TextEncoder().encode(jwtSecret), algorithms: ['HS256'] });
  return createTokenVerifier({
    issuer,
    key: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
    algorithms: ['ES256', 'RS256', 'EdDSA'],
  });
}

/**
 * Express middleware: requires `Authorization: Bearer <access token>`, verifies it, and attaches
 * the verified identity as `req.auth = { userId, email, token }`. Route handlers must take the
 * user id from here and never from the request body or query.
 */
export function requireAuth(verifyToken) {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) {
      res.set('WWW-Authenticate', 'Bearer');
      return next(new HttpError(401, 'Please sign in to continue.', 'auth_required'));
    }
    try {
      const identity = await verifyToken(match[1]);
      req.auth = Object.freeze({ ...identity, token: match[1] });
      next();
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) res.set('WWW-Authenticate', `Bearer error="invalid_token"`);
      next(err);
    }
  };
}
