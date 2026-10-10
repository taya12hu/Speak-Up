import { TrendingDown } from 'lucide-react';
import { computeInsights, MIN_SESSIONS } from '../../lib/insights';
import { scoreTone } from '../../lib/scores';
import type { Session } from '../../types';
import { Card, CardHeader } from '../ui/Card';

interface InsightsProps {
  /** Newest first. */
  sessions: Session[];
}

const TONE_TEXT = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' } as const;

/** Weak-point summary across recent sessions. */
export default function Insights({ sessions }: InsightsProps) {
  const insights = computeInsights(sessions);

  if (!insights) {
    return (
      <Card as="section" className="p-6">
        <CardHeader icon={<TrendingDown className="size-4" />} title="Focus areas" />
        <p className="mt-3 text-sm text-muted">
          Complete at least {MIN_SESSIONS} sessions to see your weakest areas and recurring grammar issues.
        </p>
      </Card>
    );
  }

  const { windowSize, weakest, recurringCategories } = insights;

  return (
    <Card as="section" className="p-6">
      <CardHeader icon={<TrendingDown className="size-4" />} title="Focus areas" description={`Based on your last ${windowSize} sessions`} />

      {weakest.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Lowest-scoring</p>
          <ul className="flex flex-col gap-2">
            {weakest.map((w) => (
              <li key={w.key} className="flex items-center justify-between text-sm">
                <span className="text-fg">{w.label}</span>
                <span className={`font-semibold tabular-nums ${TONE_TEXT[scoreTone(w.avg)]}`}>{Math.round(w.avg)} avg</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recurringCategories.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Recurring grammar issues</p>
          <ul className="flex flex-col gap-2.5">
            {recurringCategories.map(({ category, sessionCount }) => (
              <li key={category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-fg capitalize">{category}</span>
                  <span className="text-xs text-subtle tabular-nums">
                    {sessionCount}/{windowSize} sessions
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-warning" style={{ width: `${(sessionCount / windowSize) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
