import { ArrowDownRight, ArrowUpRight, GitCompare, Minus } from 'lucide-react';
import { compareScores, formatDelta } from '../../lib/scores';
import type { AnalysisResult, Session } from '../../types';
import { Card, CardHeader } from '../ui/Card';

interface SessionComparisonProps {
  previous: Session;
  currentAnalysis: AnalysisResult;
  currentTranscript: string;
}

function deltaClass(delta: number) {
  if (delta > 0) return 'text-success';
  if (delta < 0) return 'text-danger';
  return 'text-subtle';
}

function DeltaIcon({ delta }: { delta: number }) {
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return <Icon className="size-3.5" aria-hidden="true" />;
}

/** Score-by-score and transcript comparison against an earlier attempt at the same topic. */
export default function SessionComparison({ previous, currentAnalysis, currentTranscript }: SessionComparisonProps) {
  const rows = compareScores(previous.analysis.scores, currentAnalysis.scores);
  const overall = rows.find((r) => r.key === 'overall');
  const dimensions = rows.filter((r) => r.key !== 'overall');

  return (
    <Card as="section" className="border-accent-line p-6">
      <CardHeader
        icon={<GitCompare className="size-4" />}
        title="Compared with your previous attempt"
        description={`Previous attempt on ${new Date(previous.date).toLocaleDateString()}`}
        aside={
          overall && (
            <div className="text-right">
              <p className={`flex items-center justify-end gap-1 text-2xl font-semibold tabular-nums ${deltaClass(overall.delta)}`}>
                <DeltaIcon delta={overall.delta} />
                {formatDelta(overall.delta)}
              </p>
              <p className="text-xs text-subtle tabular-nums">
                {overall.before} → {overall.after} overall
              </p>
            </div>
          )
        }
      />

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-subtle">
            <th scope="col" className="pb-2 font-medium">Dimension</th>
            <th scope="col" className="pb-2 text-right font-medium">Before</th>
            <th scope="col" className="pb-2 text-right font-medium">After</th>
            <th scope="col" className="pb-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {dimensions.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="py-2 text-left font-normal text-fg">{r.label}</th>
              <td className="py-2 text-right text-muted tabular-nums">{r.before}</td>
              <td className="py-2 text-right text-fg tabular-nums">{r.after}</td>
              <td className={`py-2 text-right font-medium tabular-nums ${deltaClass(r.delta)}`}>{formatDelta(r.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="group mt-5 rounded-lg border border-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-fg select-none hover:bg-surface-2">
          Compare transcripts
        </summary>
        <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">Previous attempt</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{previous.transcript}</p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">This attempt</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg">{currentTranscript}</p>
          </div>
        </div>
      </details>
    </Card>
  );
}
