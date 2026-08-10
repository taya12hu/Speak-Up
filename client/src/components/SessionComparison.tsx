import type { AnalysisResult, Session } from '../types';

interface SessionComparisonProps {
  previous: Session;
  currentAnalysis: AnalysisResult;
  currentTranscript: string;
}

const DIMENSION_LABELS: [keyof AnalysisResult['scores'], string][] = [
  ['overall', 'Overall'],
  ['topicRelevance', 'Topic Relevance'],
  ['ideaDepth', 'Idea Depth'],
  ['grammar', 'Grammar'],
  ['coherence', 'Coherence'],
  ['vocabulary', 'Vocabulary'],
  ['fluency', 'Fluency'],
  ['fillerWords', 'Filler Words'],
  ['confidence', 'Confidence'],
];

function deltaColor(delta: number) {
  if (delta > 0) return 'text-emerald-400';
  if (delta < 0) return 'text-red-400';
  return 'text-gray-500';
}

function formatDelta(delta: number) {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : String(delta);
}

export default function SessionComparison({ previous, currentAnalysis, currentTranscript }: SessionComparisonProps) {
  const rows = DIMENSION_LABELS.filter(
    ([key]) => typeof previous.analysis.scores[key] === 'number' && typeof currentAnalysis.scores[key] === 'number',
  ).map(([key, label]) => ({
    key,
    label,
    before: previous.analysis.scores[key],
    after: currentAnalysis.scores[key],
    delta: currentAnalysis.scores[key] - previous.analysis.scores[key],
  }));

  const overallDelta = rows.find((r) => r.key === 'overall')?.delta ?? 0;

  return (
    <section className="w-full max-w-2xl rounded-xl border border-violet-900 bg-violet-950/20 p-5 text-left">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-medium text-violet-300">Compared to your last attempt</h3>
        <span className={`text-lg font-bold ${deltaColor(overallDelta)}`}>{formatDelta(overallDelta)}</span>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Previous attempt: {new Date(previous.date).toLocaleDateString()}
      </p>

      <div className="mb-4 flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between text-sm">
            <span className="text-gray-300">{r.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-gray-500">
                {r.before} → {r.after}
              </span>
              <span className={`w-10 text-right font-medium ${deltaColor(r.delta)}`}>{formatDelta(r.delta)}</span>
            </span>
          </div>
        ))}
      </div>

      <details className="text-sm text-gray-400">
        <summary className="cursor-pointer text-gray-300">Compare transcripts</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Previous attempt</p>
            <p className="whitespace-pre-wrap rounded-lg bg-gray-800/50 p-3">{previous.transcript}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">This attempt</p>
            <p className="whitespace-pre-wrap rounded-lg bg-gray-800/50 p-3">{currentTranscript}</p>
          </div>
        </div>
      </details>
    </section>
  );
}
