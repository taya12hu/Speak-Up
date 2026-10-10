import { describe, expect, it } from 'vitest';
import type { Scores } from '../types';
import { compareScores, formatDelta, scoreTone } from './scores';

const scores = (overrides: Partial<Scores> = {}): Scores => ({
  grammar: 70,
  coherence: 70,
  vocabulary: 70,
  fluency: 70,
  fillerWords: 70,
  confidence: 70,
  topicRelevance: 70,
  ideaDepth: 70,
  overall: 70,
  ...overrides,
});

describe('compareScores', () => {
  it('lists overall first, then every dimension, with deltas', () => {
    const rows = compareScores(scores(), scores({ overall: 75, grammar: 60 }));
    expect(rows).toHaveLength(9);
    expect(rows[0]).toEqual({ key: 'overall', label: 'Overall', before: 70, after: 75, delta: 5 });
    expect(rows.find((r) => r.key === 'grammar')?.delta).toBe(-10);
  });

  it('skips dimensions missing from a legacy session instead of treating them as 0', () => {
    const legacy = scores({ topicRelevance: undefined, ideaDepth: undefined });
    const keys = compareScores(legacy, scores()).map((r) => r.key);
    expect(keys).not.toContain('topicRelevance');
    expect(keys).not.toContain('ideaDepth');
    expect(keys).toHaveLength(7);
  });
});

describe('formatDelta', () => {
  it('signs the delta', () => {
    expect(formatDelta(4)).toBe('+4');
    expect(formatDelta(-3)).toBe('-3');
    expect(formatDelta(0)).toBe('±0');
  });
});

describe('scoreTone', () => {
  it('bands scores at 80 and 60', () => {
    expect(scoreTone(100)).toBe('success');
    expect(scoreTone(80)).toBe('success');
    expect(scoreTone(79)).toBe('warning');
    expect(scoreTone(60)).toBe('warning');
    expect(scoreTone(59)).toBe('danger');
    expect(scoreTone(0)).toBe('danger');
  });
});
