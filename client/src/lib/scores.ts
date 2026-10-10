import type { ScoreKey, Scores } from '../types';

/** The scored dimensions, in display order (excludes the derived overall score). */
export const SCORE_DIMENSIONS: { key: Exclude<ScoreKey, 'overall'>; label: string }[] = [
  { key: 'topicRelevance', label: 'Topic Relevance' },
  { key: 'ideaDepth', label: 'Idea Depth' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'coherence', label: 'Coherence' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'fluency', label: 'Fluency' },
  { key: 'fillerWords', label: 'Filler Words' },
  { key: 'confidence', label: 'Confidence' },
];

/** Tailwind background class for a score bar. */
export function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export interface ScoreDelta {
  key: ScoreKey;
  label: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Per-dimension change between two attempts, overall first. Dimensions missing from either
 * attempt (sessions saved before that dimension existed) are skipped rather than shown as 0.
 */
export function compareScores(before: Scores, after: Scores): ScoreDelta[] {
  const dimensions: { key: ScoreKey; label: string }[] = [{ key: 'overall', label: 'Overall' }, ...SCORE_DIMENSIONS];
  return dimensions.flatMap(({ key, label }) => {
    const b = before[key];
    const a = after[key];
    if (typeof b !== 'number' || typeof a !== 'number') return [];
    return [{ key, label, before: b, after: a, delta: a - b }];
  });
}

export function formatDelta(delta: number): string {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : String(delta);
}
