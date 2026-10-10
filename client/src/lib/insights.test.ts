import { describe, expect, it } from 'vitest';
import type { GrammarCategory, Scores, Session } from '../types';
import { computeHistoryStats, computeInsights, RECENT_WINDOW } from './insights';

const baseScores: Scores = {
  grammar: 80,
  coherence: 80,
  vocabulary: 80,
  fluency: 80,
  fillerWords: 80,
  confidence: 80,
  topicRelevance: 80,
  ideaDepth: 80,
  overall: 80,
};

let nextId = 0;
function session(scores: Partial<Scores> = {}, categories: (GrammarCategory | undefined)[] = []): Session {
  return {
    id: String(nextId++),
    date: new Date().toISOString(),
    mode: 'random',
    topic: 't',
    transcript: 'x',
    metrics: { fillerCount: 0, fillerBreakdown: {}, wpm: 120, pauseCount: 0, longestPauseSec: 0, totalPauseSec: 0 },
    analysis: {
      nativeRewrite: '',
      grammarIssues: categories.map((category) => ({ original: 'a', corrected: 'b', explanation: 'c', category })),
      pronunciationTips: [],
      fluencyCommentary: '',
      scores: { ...baseScores, ...scores },
      summary: '',
    },
  };
}

describe('computeHistoryStats', () => {
  it('returns null with no sessions', () => {
    expect(computeHistoryStats([])).toBeNull();
  });

  it('summarises overall scores, newest first', () => {
    const sessions = [session({ overall: 70 }), session({ overall: 81 }), session({ overall: 60 })];
    expect(computeHistoryStats(sessions)).toEqual({ count: 3, average: 70, best: 81, lastChange: -11 });
  });

  it('has no change figure for a single session', () => {
    expect(computeHistoryStats([session({ overall: 50 })])?.lastChange).toBeNull();
  });
});

describe('computeInsights', () => {
  it('needs at least three sessions', () => {
    expect(computeInsights([session(), session()])).toBeNull();
  });

  it('returns the three lowest-averaging dimensions, lowest first', () => {
    const sessions = [
      session({ grammar: 40, fluency: 60, vocabulary: 70 }),
      session({ grammar: 50, fluency: 60, vocabulary: 70 }),
      session({ grammar: 60, fluency: 60, vocabulary: 70 }),
    ];
    const result = computeInsights(sessions);
    expect(result?.weakest.map((w) => [w.key, w.avg])).toEqual([
      ['grammar', 50],
      ['fluency', 60],
      ['vocabulary', 70],
    ]);
  });

  it('only considers the most recent sessions', () => {
    const recent = Array.from({ length: RECENT_WINDOW }, () => session({ confidence: 50 }));
    const old = Array.from({ length: 5 }, () => session({ grammar: 0 }));
    const result = computeInsights([...recent, ...old]);
    expect(result?.windowSize).toBe(RECENT_WINDOW);
    expect(result?.weakest[0]).toMatchObject({ key: 'confidence', avg: 50 });
  });

  it('skips dimensions with too few scored sessions (legacy data)', () => {
    const sessions = [session({ topicRelevance: 10 }), session({ topicRelevance: undefined }), session({ topicRelevance: undefined })];
    const keys = computeInsights(sessions)?.weakest.map((w) => w.key) ?? [];
    expect(keys).not.toContain('topicRelevance');
  });

  it('counts recurring grammar categories once per session', () => {
    const sessions = [
      session({}, ['articles', 'articles', 'articles', 'verb tense']),
      session({}, ['articles']),
      session({}, ['prepositions', undefined]),
    ];
    expect(computeInsights(sessions)?.recurringCategories).toEqual([{ category: 'articles', sessionCount: 2 }]);
  });
});
