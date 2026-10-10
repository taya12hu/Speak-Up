import express from 'express';
import { existsSync } from 'fs';
import multer from 'multer';
import { HttpError } from './errors.js';
import { contentRouter } from './routes/content.js';
import { sessionsRouter } from './routes/sessions.js';
import { speechRouter } from './routes/speech.js';

/**
 * Builds the Express app from its dependencies so tests can supply their own services.
 *
 * @param {object} deps
 * @param {Function} deps.askJSON          Gemini structured-output call (services/gemini.js)
 * @param {Function} deps.transcribeWav    whisper.cpp transcription (services/whisper.js)
 * @param {Function} deps.checkWhisper     whisper.cpp installation check (services/whisper.js)
 * @param {object}   deps.sessionStore     session history persistence (services/sessionStore.js)
 * @param {string}   deps.tmpDir           where uploaded audio is staged during transcription
 * @param {boolean}  deps.geminiConfigured whether an API key is present, reported by /api/health
 * @param {string}  [deps.clientDistDir]   built client to serve, if it exists
 */
export function createApp({ askJSON, transcribeWav, checkWhisper, sessionStore, tmpDir, geminiConfigured, clientDistDir }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  const api = express.Router();
  api.use(rejectCrossSite);
  api.get('/health', async (_req, res) => {
    const whisper = await checkWhisper();
    res.json({ gemini: { configured: geminiConfigured }, whisper: { binary: whisper.binary, model: whisper.model } });
  });
  api.use(contentRouter({ askJSON }));
  api.use(speechRouter({ askJSON, transcribeWav, tmpDir }));
  api.use(sessionsRouter({ sessionStore }));
  api.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use('/api', api);

  if (clientDistDir && existsSync(clientDistDir)) app.use(express.static(clientDistDir));

  app.use(errorHandler);
  return app;
}

/**
 * Fetch Metadata resource isolation. Without CORS other sites cannot read API responses, but a
 * page could still fire "simple" cross-site requests (e.g. a form POST) that spend Gemini quota or
 * run whisper. Browsers label every request with Sec-Fetch-Site, so only the app's own pages
 * ("same-origin") and direct navigation ("none") are let through. Non-browser clients such as
 * curl send no header and are allowed: they are not a cross-site request forgery vector.
 */
function rejectCrossSite(req, _res, next) {
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return next(new HttpError(403, 'Cross-site requests are not allowed'));
  next();
}

// Express 5 forwards rejected promises from async handlers here, so routes need no try/catch.
function errorHandler(err, req, res, _next) {
  const { status, message } = describeError(err);
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json({ error: message });
}

function describeError(err) {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  if (err instanceof multer.MulterError) {
    return { status: err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message: `Upload rejected: ${err.message}` };
  }
  // body-parser marks client errors (malformed JSON, oversized body) as safe to expose.
  if (err?.expose && err.status) return { status: err.status, message: err.message };
  return { status: 500, message: 'Internal server error' };
}
