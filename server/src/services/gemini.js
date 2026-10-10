import { GoogleGenAI } from '@google/genai';
import { HttpError } from '../errors.js';

/**
 * Creates the structured-output Gemini client used by every AI route.
 * Returns `askJSON`, which calls the model with a response schema and parses the reply.
 */
export function createGemini({ apiKey, model }) {
  const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

  /**
   * A schema (not just responseMimeType) is required — without it, this model's JSON mode
   * unpredictably drops closing braces or duplicates trailing text on longer replies.
   * Retries only cover unparseable replies; API errors (quota, network) propagate immediately.
   */
  async function askJSON({ prompt, schema, maxTokens = 1024, retries = 1 }) {
    if (!client) throw new HttpError(503, 'GEMINI_API_KEY is not configured on the server (see server/.env.example).');

    for (let attempt = 0; ; attempt++) {
      const res = await generate({ prompt, schema, maxTokens });
      try {
        return JSON.parse(res.text);
      } catch (err) {
        if (attempt >= retries) {
          throw new HttpError(502, `Gemini returned invalid JSON after ${attempt + 1} attempt(s): ${err.message}`);
        }
      }
    }
  }

  async function generate({ prompt, schema, maxTokens }) {
    try {
      return await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          maxOutputTokens: maxTokens,
          // No thinkingConfig on purpose: the "-latest" alias now resolves to Gemini 3.x, which
          // rejects `thinkingBudget` (400 INVALID_ARGUMENT), while 2.5 models reject `thinkingLevel`.
          // The flash-lite default spends ~0 thinking tokens, so omitting it is safe for both.
        },
      });
    } catch (err) {
      throw toHttpError(err);
    }
  }

  return { askJSON };
}

/** Maps Gemini SDK failures to client-safe errors; anything unrecognised propagates unchanged (→ 500). */
function toHttpError(err) {
  if (err?.name !== 'ApiError') return err;
  if (err.status === 429) {
    return new HttpError(429, 'Gemini rate limit reached (free-tier quota). Wait a minute and try again.');
  }
  return new HttpError(502, `Gemini request failed (${err.status ?? 'unknown status'}): ${String(err.message).slice(0, 300)}`);
}
