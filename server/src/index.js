import { mkdir } from 'fs/promises';
import path from 'path';
import { createApp } from './app.js';
import { config } from './config.js';
import { createSupabaseTokenVerifier } from './services/auth.js';
import { createGemini } from './services/gemini.js';
import { createSessionRepository } from './services/sessionRepository.js';
import { createWhisper } from './services/whisper.js';

const tmpDir = path.join(config.dataDir, 'tmp');
await mkdir(tmpDir, { recursive: true });

const { askJSON } = createGemini({ apiKey: config.geminiApiKey, model: config.geminiModel });
const whisper = createWhisper({
  binPath: config.whisperBinPath,
  modelPath: config.whisperModelPath,
  timeoutMs: config.whisperTimeoutMs,
});
const sessionRepository = createSessionRepository(config.supabase);
const authConfigured = Boolean(config.supabase.url && config.supabase.publishableKey);

const app = createApp({
  askJSON,
  transcribeWav: whisper.transcribeWav,
  checkWhisper: whisper.checkInstallation,
  verifyToken: createSupabaseTokenVerifier(config.supabase),
  sessionRepository,
  tmpDir,
  geminiConfigured: Boolean(config.geminiApiKey),
  authConfigured,
  clientDistDir: config.clientDistDir,
});

// Startup diagnostics: the server still starts so the UI can load and show the failing step.
if (!config.geminiApiKey) console.warn('WARNING: GEMINI_API_KEY is not set — AI features will fail until you add it to server/.env');
if (!authConfigured) console.warn('WARNING: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set — sign-in and history will fail until you add them to server/.env');
const whisperStatus = await whisper.checkInstallation();
if (!whisperStatus.binary) console.warn(`WARNING: whisper.cpp binary not found at ${whisperStatus.binPath}`);
if (!whisperStatus.model) console.warn(`WARNING: whisper model not found at ${whisperStatus.modelPath}`);

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback.
app.listen(config.port, config.host, (err) => {
  if (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
  console.log(`Server listening on http://${config.host}:${config.port} (model: ${config.geminiModel})`);
});
