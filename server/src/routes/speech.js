import { randomUUID } from 'crypto';
import { Router } from 'express';
import { rm } from 'fs/promises';
import multer from 'multer';
import { HttpError } from '../errors.js';
import { buildAnalysisPrompt } from '../prompts.js';
import { ANALYSIS_SCHEMA } from '../schemas.js';
import { finalizeScores } from '../scoring.js';
import { integer, number, object, requireBody, string } from '../validation.js';

// 16 kHz mono 16-bit WAV is ~1.9 MB per minute, so this allows recordings of ~13 minutes.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_STUCK_LOOPS = 20;

/** Speech pipeline: WAV upload → local transcription, and transcript + metrics → AI analysis. */
export function speechRouter({ askJSON, transcribeWav, tmpDir }) {
  const router = Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: tmpDir,
      // whisper.cpp picks the decoder from the extension; the client always uploads WAV.
      filename: (_req, _file, cb) => cb(null, `${randomUUID()}.wav`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No audio file uploaded (expected multipart field "audio")');
    let result;
    try {
      result = await transcribeWav(req.file.path);
    } finally {
      await rm(req.file.path, { force: true }).catch(() => {});
    }
    res.json(result);
  });

  router.post('/analyze', async (req, res) => {
    const body = requireBody(req.body);
    const params = {
      topic: string(body.topic, 'topic', { max: 1000 }),
      transcript: string(body.transcript, 'transcript', { max: 50_000 }),
      metrics: parseMetrics(body.metrics),
    };
    const analysis = await askJSON({ prompt: buildAnalysisPrompt(params), schema: ANALYSIS_SCHEMA, maxTokens: 3000 });
    res.json({ ...analysis, scores: finalizeScores(analysis.scores) });
  });

  return router;
}

function parseMetrics(value) {
  const metrics = object(value, 'metrics');
  const stuckLoops = metrics.stuckLoops ?? [];
  if (!Array.isArray(stuckLoops)) throw new HttpError(400, '"metrics.stuckLoops" must be an array');
  return {
    fillerCount: number(metrics.fillerCount, 'metrics.fillerCount'),
    wpm: number(metrics.wpm, 'metrics.wpm'),
    pauseCount: number(metrics.pauseCount, 'metrics.pauseCount'),
    longestPauseSec: number(metrics.longestPauseSec, 'metrics.longestPauseSec'),
    totalPauseSec: number(metrics.totalPauseSec, 'metrics.totalPauseSec'),
    stuckLoops: stuckLoops.slice(0, MAX_STUCK_LOOPS).map((loop, i) => ({
      phrase: string(loop?.phrase, `metrics.stuckLoops[${i}].phrase`, { max: 200 }),
      occurrences: integer(loop?.occurrences, `metrics.stuckLoops[${i}].occurrences`, { min: 2, max: 1000 }),
    })),
  };
}
