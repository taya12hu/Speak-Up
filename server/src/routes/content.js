import { Router } from 'express';
import {
  DIFFICULTIES,
  INTERVIEW_FRAMEWORKS,
  TOPIC_CATEGORIES,
  buildInterviewSamplePrompt,
  buildTopicsPrompt,
  buildVocabPrompt,
} from '../prompts.js';
import { INTERVIEW_SAMPLE_SCHEMA, TOPICS_SCHEMA, VOCAB_SCHEMA } from '../schemas.js';
import { integer, oneOf, requireBody, string } from '../validation.js';

/** Practice content generated on demand: speaking topics, vocab words, and sample interview answers. */
export function contentRouter({ askJSON }) {
  const router = Router();

  router.post('/topics', async (req, res) => {
    const body = requireBody(req.body);
    const params = {
      category: oneOf(body.category, 'category', Object.keys(TOPIC_CATEGORIES), { fallback: 'general' }),
      difficulty: oneOf(body.difficulty, 'difficulty', DIFFICULTIES, { fallback: 'Medium' }),
      theme: string(body.theme, 'theme', { max: 100, optional: true }),
      count: integer(body.count, 'count', { min: 1, max: 10, fallback: 5 }),
      interview: body.interview === true,
    };
    const topics = await askJSON({ prompt: buildTopicsPrompt(params), schema: TOPICS_SCHEMA, maxTokens: 512 });
    res.json(topics);
  });

  router.post('/vocab', async (_req, res) => {
    const entry = await askJSON({ prompt: buildVocabPrompt(), schema: VOCAB_SCHEMA, maxTokens: 300 });
    res.json(entry);
  });

  router.post('/interview-sample', async (req, res) => {
    const body = requireBody(req.body);
    const params = {
      question: string(body.question, 'question', { max: 500 }),
      framework: oneOf(body.framework, 'framework', INTERVIEW_FRAMEWORKS),
    };
    const result = await askJSON({ prompt: buildInterviewSamplePrompt(params), schema: INTERVIEW_SAMPLE_SCHEMA, maxTokens: 500 });
    res.json(result);
  });

  return router;
}
