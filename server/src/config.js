import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

// quiet: dotenv v17 otherwise logs a banner on every load.
loadEnv({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

const env = process.env;
const whisperExe = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';

function intFromEnv(name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

export const config = Object.freeze({
  host: env.HOST || '127.0.0.1',
  port: intFromEnv('PORT', 4000),
  geminiApiKey: env.GEMINI_API_KEY || '',
  // Stable alias rather than a pinned version so this keeps working as Google rotates the
  // concrete model behind it. The free tier caps "flash-latest" at ~20 requests/day, which is
  // too tight for daily practice; "flash-lite-latest" has a usable quota and is reliable with a schema.
  geminiModel: env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  whisperBinPath: env.WHISPER_BIN_PATH || path.join(REPO_ROOT, 'whisper', 'bin', whisperExe),
  whisperModelPath: env.WHISPER_MODEL_PATH || path.join(REPO_ROOT, 'whisper', 'models', 'ggml-base.en.bin'),
  whisperTimeoutMs: intFromEnv('WHISPER_TIMEOUT_MS', 5 * 60 * 1000),
  // Explicit thread count for whisper.cpp; when unset, index.js derives it from the CPU quota.
  whisperThreads: intFromEnv('WHISPER_THREADS', undefined),
  // Supabase Auth + Postgres. Only the public publishable (or legacy anon) key is needed at
  // runtime: database queries run with each user's own JWT so Row Level Security applies.
  // The service-role key is intentionally not read here (see scripts/ for its only use).
  supabase: {
    url: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '',
    // Only for projects still on the legacy shared-secret (HS256) JWT signing key. Projects using
    // asymmetric signing keys (the default for new projects) are verified via the public JWKS.
    jwtSecret: env.SUPABASE_JWT_SECRET || '',
  },
  // Temporary audio uploads during transcription (deleted after each request).
  dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(SERVER_ROOT, 'data'),
  // Built client, served by Express when present so `npm start` is a single-origin deployment.
  clientDistDir: path.join(REPO_ROOT, 'client', 'dist'),
});
