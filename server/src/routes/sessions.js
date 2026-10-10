import { randomUUID } from 'crypto';
import { Router } from 'express';
import { HttpError } from '../errors.js';
import { number, object, oneOf, requireBody, string } from '../validation.js';

const SESSION_MODES = ['random', 'interview', 'vocab'];

/** Practice history. The server assigns `id` and `date`; the client supplies the practice result. */
export function sessionsRouter({ sessionStore }) {
  const router = Router();

  router.get('/sessions', async (_req, res) => {
    res.json(await sessionStore.list());
  });

  router.post('/sessions', async (req, res) => {
    const body = requireBody(req.body);
    const metrics = object(body.metrics, 'metrics');
    const analysis = object(body.analysis, 'analysis');
    const scores = object(analysis.scores, 'analysis.scores');
    number(scores.overall, 'analysis.scores.overall');
    if (!Array.isArray(analysis.grammarIssues)) throw new HttpError(400, '"analysis.grammarIssues" must be an array');

    const session = {
      id: randomUUID(),
      date: new Date().toISOString(),
      mode: oneOf(body.mode, 'mode', SESSION_MODES),
      topic: string(body.topic, 'topic', { max: 1000 }),
      transcript: string(body.transcript, 'transcript', { max: 50_000 }),
      metrics,
      analysis,
    };
    res.status(201).json(await sessionStore.append(session));
  });

  return router;
}
