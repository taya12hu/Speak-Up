import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Stable aliases (not pinned version numbers) so this keeps working as Google
// rotates which concrete model backs "latest". Both point at the same lite model:
// the free tier caps "flash-latest" at just 20 requests/day, too tight for daily practice,
// while "flash-lite-latest" has a much more usable quota and is plenty capable with a schema.
export const MODEL_FAST = 'gemini-flash-lite-latest';
export const MODEL_SMART = 'gemini-flash-lite-latest';

/**
 * Calls Gemini with a response schema and parses the reply as JSON.
 * A schema (not just responseMimeType) is required — without it, this model's JSON mode
 * unpredictably drops closing braces or duplicates trailing text on longer replies.
 */
export async function askJSON({ model, system, prompt, schema, maxTokens = 1024, retries = 1 }) {
  for (let attempt = 0; ; attempt++) {
    const res = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens: maxTokens,
        // Structured extraction/formatting, not tasks needing chain-of-thought — disabling
        // thinking avoids it eating into maxOutputTokens and leaves more budget for the reply.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    try {
      return JSON.parse(res.text);
    } catch (err) {
      if (attempt >= retries) throw new Error(`Model returned invalid JSON after ${attempt + 1} attempt(s): ${err.message}`);
    }
  }
}
