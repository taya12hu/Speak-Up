import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../errors.js';

const TABLE = 'practice_sessions';
const COLUMNS = 'id, created_at, mode, topic, transcript, metrics, analysis';

/**
 * Practice history in Supabase Postgres.
 *
 * `forUser(auth)` returns a repository bound to one verified caller. Every query:
 *   - runs through a client created for this request with the caller's own access token, so
 *     Postgres Row Level Security enforces ownership even if this code had a bug, and
 *   - is also explicitly scoped to `auth.userId` (defence in depth, and it uses the index).
 * Nothing user-specific is cached or shared between requests.
 */
export function createSessionRepository({ url, publishableKey, fetch: fetchImpl }) {
  const configured = Boolean(url && publishableKey);

  function clientFor(token) {
    return createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` }, ...(fetchImpl && { fetch: fetchImpl }) },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  function forUser({ userId, token }) {
    if (!configured) {
      throw new HttpError(503, 'Practice history is not configured on the server (set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY).', 'db_not_configured');
    }
    const db = clientFor(token);

    return {
      /** All of the caller's sessions, newest first. */
      async list() {
        const { data, error } = await db.from(TABLE).select(COLUMNS).eq('user_id', userId).order('created_at', { ascending: false });
        if (error) throw toHttpError(error, 'list');
        return data.map(toSession);
      },

      /** Stores a session owned by the caller; id and created_at are assigned by the database. */
      async create({ mode, topic, transcript, metrics, analysis }) {
        const { data, error } = await db
          .from(TABLE)
          .insert({ user_id: userId, mode, topic, transcript, metrics, analysis })
          .select(COLUMNS)
          .single();
        if (error) throw toHttpError(error, 'create');
        return toSession(data);
      },

      /** Deletes one of the caller's sessions. Returns false if no such session exists for this user. */
      async remove(id) {
        const { data, error } = await db.from(TABLE).delete().eq('id', id).eq('user_id', userId).select('id');
        if (error) throw toHttpError(error, 'delete');
        return data.length > 0;
      },
    };
  }

  return { configured, forUser };
}

/** Database row → API shape. user_id is never returned: the caller already knows who they are. */
function toSession(row) {
  return {
    id: row.id,
    date: row.created_at,
    mode: row.mode,
    topic: row.topic,
    transcript: row.transcript,
    metrics: row.metrics,
    analysis: row.analysis,
  };
}

/**
 * Maps Supabase/PostgREST errors to client-safe responses. Details are logged by the central
 * error handler (status >= 500) but never sent to the client.
 */
function toHttpError(error, operation) {
  // PostgREST rejected the user's JWT (e.g. it expired between our check and the query).
  if (error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt expired/i.test(error.message ?? '')) {
    return new HttpError(401, 'Your session has expired. Please sign in again.', 'token_expired');
  }
  // Check-constraint violation: the payload passed our validation but not the database's.
  if (error.code === '23514') return new HttpError(400, 'The practice session data is invalid.', 'invalid_session');
  const status = !error.code || /fetch failed|network|ECONNREFUSED|ENOTFOUND|timeout/i.test(`${error.message} ${error.details ?? ''}`) ? 503 : 500;
  const httpError = new HttpError(status, 'Practice history is temporarily unavailable. Please try again.', 'db_unavailable');
  httpError.cause = Object.assign(new Error(`Supabase ${operation} failed: ${error.message}`), { supabase: error });
  return httpError;
}
