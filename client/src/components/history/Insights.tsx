import { computeInsights } from '../../lib/insights';
import type { Session } from '../../types';

interface InsightsProps {
  /** Newest first. */
  sessions: Session[];
}

/** Weak-point summary across recent sessions; renders nothing until there is enough history. */
export default function Insights({ sessions }: InsightsProps) {
  const insights = computeInsights(sessions);
  if (!insights) return null;
  const { windowSize, weakest, recurringCategories } = insights;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <h3 className="mb-1 text-lg font-medium text-gray-100">Weak Points</h3>
      <p className="mb-4 text-xs text-gray-500">Based on your last {windowSize} sessions</p>

      {weakest.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Lowest-scoring areas</p>
          <div className="flex flex-col gap-2">
            {weakest.map((w) => (
              <div key={w.key} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{w.label}</span>
                <span className="font-medium text-amber-400">{Math.round(w.avg)} avg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recurringCategories.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Recurring grammar issues</p>
          <div className="flex flex-col gap-1">
            {recurringCategories.map(({ category, sessionCount }) => (
              <p key={category} className="text-sm text-gray-300">
                <span className="capitalize text-gray-100">{category}</span> — {sessionCount} of your last {windowSize} sessions
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
