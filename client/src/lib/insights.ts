import type { GrammarCategory, Session } from '../types';
import { SCORE_DIMENSIONS } from './scores';

export const RECENT_WINDOW = 10;
/** Minimum sessions (and minimum scored values per dimension) before weak points are shown. */
export const MIN_SESSIONS = 3;
/** A grammar category must appear in at least this many recent sessions to count as recurring. */
const MIN_RECURRING_COUNT = 2;

export interface WeakDimension {
  key: string;
  label: string;
  avg: number;
}

export interface RecurringCategory {
  category: GrammarCategory;
  sessionCount: number;
}

export interface Insights {
  windowSize: number;
  weakest: WeakDimension[];
  recurringCategories: RecurringCategory[];
}

export interface HistoryStats {
  count: number;
  average: number;
  best: number;
  /** Latest overall score minus the one before it; null with fewer than two sessions. */
  lastChange: number | null;
}

/** Headline numbers for the History page. @param sessions newest first */
export function computeHistoryStats(sessions: Session[]): HistoryStats | null {
  if (sessions.length === 0) return null;
  const overall = sessions.map((s) => s.analysis.scores.overall);
  return {
    count: sessions.length,
    average: Math.round(overall.reduce((a, b) => a + b, 0) / overall.length),
    best: Math.max(...overall),
    lastChange: overall.length > 1 ? overall[0] - overall[1] : null,
  };
}

/**
 * Weak points across the most recent sessions: the three lowest-averaging score dimensions and
 * the grammar categories that keep coming back. Returns null when there is too little data.
 *
 * @param sessions newest first, as returned by the API
 */
export function computeInsights(sessions: Session[]): Insights | null {
  if (sessions.length < MIN_SESSIONS) return null;
  const recent = sessions.slice(0, RECENT_WINDOW);

  const weakest = SCORE_DIMENSIONS.flatMap(({ key, label }) => {
    const values = recent.map((s) => s.analysis.scores[key]).filter((v): v is number => typeof v === 'number');
    if (values.length < MIN_SESSIONS) return [];
    return [{ key, label, avg: values.reduce((a, b) => a + b, 0) / values.length }];
  })
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  // Count sessions (not issues) per category, so one answer with five article mistakes
  // doesn't outweigh a habit that shows up across many sessions.
  const sessionCounts = new Map<GrammarCategory, number>();
  for (const s of recent) {
    const categories = new Set(s.analysis.grammarIssues.map((i) => i.category).filter((c) => c !== undefined));
    for (const category of categories) sessionCounts.set(category, (sessionCounts.get(category) ?? 0) + 1);
  }
  const recurringCategories = [...sessionCounts.entries()]
    .filter(([, count]) => count >= MIN_RECURRING_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, sessionCount]) => ({ category, sessionCount }));

  if (weakest.length === 0 && recurringCategories.length === 0) return null;
  return { windowSize: recent.length, weakest, recurringCategories };
}
