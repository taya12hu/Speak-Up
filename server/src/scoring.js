// The model scores each dimension; the weighted overall score is computed here rather than by the
// model, because LLM arithmetic is unreliable and the overall score drives the history chart.

export const SCORE_WEIGHTS = {
  grammar: 0.15,
  coherence: 0.1,
  vocabulary: 0.1,
  fluency: 0.15,
  fillerWords: 0.1,
  confidence: 0.1,
  topicRelevance: 0.15,
  ideaDepth: 0.15,
};

const clampScore = (value) => Math.min(100, Math.max(0, Math.round(value)));

/** Clamps every dimension to an integer 0-100 and adds the weighted `overall` score. */
export function finalizeScores(dimensionScores) {
  const scores = {};
  let overall = 0;
  for (const [dimension, weight] of Object.entries(SCORE_WEIGHTS)) {
    const value = dimensionScores?.[dimension];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Model response is missing the "${dimension}" score`);
    scores[dimension] = clampScore(value);
    overall += scores[dimension] * weight;
  }
  return { ...scores, overall: clampScore(overall) };
}
