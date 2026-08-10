import type { Session } from '../types';

interface InsightsProps {
  sessions: Session[];
}

const DIMENSION_LABELS: Record<string, string> = {
  topicRelevance: 'Topic Relevance',
  ideaDepth: 'Idea Depth',
  grammar: 'Grammar',
  coherence: 'Coherence',
  vocabulary: 'Vocabulary',
  fluency: 'Fluency',
  fillerWords: 'Filler Words',
  confidence: 'Confidence',
};

const RECENT_WINDOW = 10;
const MIN_SESSIONS = 3;
const MIN_RECURRING_COUNT = 2;

export default function Insights({ sessions }: InsightsProps) {
  if (sessions.length < MIN_SESSIONS) return null;

  // sessions arrive newest-first from the API
  const recent = sessions.slice(0, RECENT_WINDOW);

  const dimensionAverages = Object.entries(DIMENSION_LABELS)
    .map(([key, label]) => {
      const values = recent
        .map((s) => s.analysis.scores[key as keyof typeof s.analysis.scores])
        .filter((v): v is number => typeof v === 'number');
      if (values.length < MIN_SESSIONS) return null;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return { key, label, avg, count: values.length };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const weakest = [...dimensionAverages].sort((a, b) => a.avg - b.avg).slice(0, 3);

  const categorySessionCounts = new Map<string, number>();
  for (const s of recent) {
    const categoriesInSession = new Set((s.analysis.grammarIssues ?? []).map((i) => i.category).filter(Boolean));
    for (const cat of categoriesInSession) {
      categorySessionCounts.set(cat, (categorySessionCounts.get(cat) ?? 0) + 1);
    }
  }
  const recurringCategories = [...categorySessionCounts.entries()]
    .filter(([, count]) => count >= MIN_RECURRING_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (weakest.length === 0 && recurringCategories.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <h3 className="mb-1 text-lg font-medium text-gray-100">Weak Points</h3>
      <p className="mb-4 text-xs text-gray-500">Based on your last {recent.length} sessions</p>

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
            {recurringCategories.map(([cat, count]) => (
              <p key={cat} className="text-sm text-gray-300">
                <span className="capitalize text-gray-100">{cat}</span> — {count} of your last {recent.length} sessions
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
