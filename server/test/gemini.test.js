import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGemini } from '../src/services/gemini.js';

describe('createGemini', () => {
  it('fails with a 503 explaining the missing key, without calling the API', async () => {
    const { askJSON } = createGemini({ apiKey: '', model: 'any' });
    await assert.rejects(askJSON({ prompt: 'x', schema: {} }), { status: 503, message: /GEMINI_API_KEY is not configured/ });
  });
});
