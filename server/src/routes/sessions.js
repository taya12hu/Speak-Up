import { Router } from 'express';
import { HttpError } from '../errors.js';
import { number, object, oneOf, requireBody, string } from '../validation.js';

const SESSION_MODES = ['random', 'interview', 'vocab'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The signed-in user's practice history. Mounted behind requireAuth, so `req.auth` holds the
 * verified identity. Ownership is always taken from `req.auth`; any user id in the request body
 * is ignored. The database assigns `id` and `created_at`.
 */
export function sessionsRouter({ sessionRepository }) {
  const router = Router();

  router.get('/sessions', async (req, res) => {
    res.json(await sessionRepository.forUser(req.auth).list());
  });

  router.post('/sessions', async (req, res) => {
    const body = requireBody(req.body);
    const metrics = object(body.metrics, 'metrics');
    const analysis = object(body.analysis, 'analysis');
    const scores = object(analysis.scores, 'analysis.scores');
    number(scores.overall, 'analysis.scores.overall');
    if (!Array.isArray(analysis.grammarIssues)) throw new HttpError(400, '"analysis.grammarIssues" must be an array');

    const session = await sessionRepository.forUser(req.auth).create({
      mode: oneOf(body.mode, 'mode', SESSION_MODES),
      topic: string(body.topic, 'topic', { max: 1000 }),
      transcript: string(body.transcript, 'transcript', { max: 50_000 }),
      metrics,
      analysis,
    });
    res.status(201).json(session);
  });

  router.delete('/sessions/:id', async (req, res) => {
    if (!UUID.test(req.params.id)) throw new HttpError(400, 'Invalid session id');
    // "Not found" and "belongs to someone else" deliberately look identical.
    const deleted = await sessionRepository.forUser(req.auth).remove(req.params.id);
    if (!deleted) throw new HttpError(404, 'Session not found');
    res.status(204).end();
  });

  return router;
}
