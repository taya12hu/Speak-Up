import type { AnalysisResult, FluencyMetrics } from '../types';

interface AnalysisReportProps {
  transcript: string;
  metrics: FluencyMetrics;
  analysis: AnalysisResult;
}

const SCORE_LABELS: [keyof AnalysisResult['scores'], string][] = [
  ['topicRelevance', 'Topic Relevance'],
  ['ideaDepth', 'Idea Depth'],
  ['grammar', 'Grammar'],
  ['coherence', 'Coherence'],
  ['vocabulary', 'Vocabulary'],
  ['fluency', 'Fluency'],
  ['fillerWords', 'Filler Words'],
  ['confidence', 'Confidence'],
];

function scoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function AnalysisReport({ transcript, metrics, analysis }: AnalysisReportProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 text-left">
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-100">Overall Score</h3>
          <span className="text-2xl font-bold text-violet-400">{analysis.scores.overall}/100</span>
        </div>
        <p className="mb-4 text-sm text-gray-400">{analysis.summary}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SCORE_LABELS.filter(([key]) => typeof analysis.scores[key] === 'number').map(([key, label]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs text-gray-400">
                <span>{label}</span>
                <span>{analysis.scores[key]}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div className={`h-full ${scoreColor(analysis.scores[key])}`} style={{ width: `${analysis.scores[key]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {typeof analysis.scores.topicRelevance === 'number' && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-100">Staying On Topic</h3>
            <span className="text-sm font-semibold text-violet-400">{analysis.scores.topicRelevance}/100</span>
          </div>
          <p className="text-sm text-gray-400">{analysis.topicRelevanceNote}</p>
        </section>
      )}

      {typeof analysis.scores.ideaDepth === 'number' && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-100">Idea Depth</h3>
            <span className="text-sm font-semibold text-violet-400">{analysis.scores.ideaDepth}/100</span>
          </div>
          <p className="text-sm text-gray-400">{analysis.ideaDepthNote}</p>
        </section>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-2 text-lg font-medium text-gray-100">Fluency Stats</h3>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-300 sm:grid-cols-4">
          <Stat label="Filler words" value={String(metrics.fillerCount)} />
          <Stat label="Pace" value={`${metrics.wpm} wpm`} />
          <Stat label="Pauses" value={String(metrics.pauseCount)} />
          <Stat label="Longest pause" value={`${metrics.longestPauseSec}s`} />
        </div>
        {Object.keys(metrics.fillerBreakdown).length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {Object.entries(metrics.fillerBreakdown)
              .map(([w, n]) => `"${w}" ×${n}`)
              .join(', ')}
          </p>
        )}
        <p className="mt-3 text-sm text-gray-400">{analysis.fluencyCommentary}</p>
      </section>

      {analysis.stuckPoints?.length > 0 && (
        <section className="rounded-xl border border-amber-900 bg-amber-950/10 p-5">
          <h3 className="mb-1 text-lg font-medium text-amber-300">You Got Stuck Here</h3>
          <p className="mb-3 text-xs text-gray-500">
            Places where you repeated a phrase while searching for your next idea — with what to say instead.
          </p>
          <div className="flex flex-col gap-3">
            {analysis.stuckPoints.map((point, i) => (
              <div key={i} className="rounded-lg bg-gray-800/50 p-3 text-sm">
                <p className="text-amber-400">You repeated: "{point.phrase}"</p>
                <p className="mt-1 text-emerald-400">Try instead: {point.suggestion}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-2 text-lg font-medium text-gray-100">Your Transcript</h3>
        <p className="whitespace-pre-wrap text-sm text-gray-400">{transcript}</p>
      </section>

      <section className="rounded-xl border border-violet-900 bg-violet-950/20 p-5">
        <h3 className="mb-2 text-lg font-medium text-violet-300">Native Rewrite</h3>
        <p className="whitespace-pre-wrap text-sm text-gray-200">{analysis.nativeRewrite}</p>
      </section>

      {analysis.grammarIssues.length > 0 && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="mb-3 text-lg font-medium text-gray-100">Grammar & Word Choice</h3>
          <div className="flex flex-col gap-3">
            {analysis.grammarIssues.map((issue, i) => (
              <div key={i} className="rounded-lg bg-gray-800/50 p-3 text-sm">
                {issue.category && (
                  <span className="mb-1 inline-block rounded bg-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                    {issue.category}
                  </span>
                )}
                <p className="text-red-400 line-through decoration-red-600">{issue.original}</p>
                <p className="text-emerald-400">{issue.corrected}</p>
                <p className="mt-1 text-xs text-gray-500">{issue.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {analysis.pronunciationTips.length > 0 && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="mb-3 text-lg font-medium text-gray-100">Pronunciation Tips</h3>
          <div className="flex flex-col gap-2">
            {analysis.pronunciationTips.map((tip, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-gray-200">{tip.phrase}</span>
                <span className="text-gray-500"> — {tip.tip}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="text-base font-medium text-gray-100">{value}</p>
    </div>
  );
}
