import { ArrowRight, AudioLines, Gauge, Hourglass, Lightbulb, MessageCircleWarning, PauseCircle, Repeat, SpellCheck, Target, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { SCORE_DIMENSIONS } from '../../lib/scores';
import type { AnalysisResult, FluencyMetrics } from '../../types';
import Badge from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { ScoreBar, ScoreGauge, ScorePill } from './ScoreDisplay';

interface AnalysisReportProps {
  transcript: string;
  metrics: FluencyMetrics;
  analysis: AnalysisResult;
}

const ICON = 'size-4';

/** Full feedback for one attempt. Also renders legacy sessions, which lack some sections. */
export default function AnalysisReport({ transcript, metrics, analysis }: AnalysisReportProps) {
  const { scores } = analysis;
  const fillers = Object.entries(metrics.fillerBreakdown);

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      <Card as="section" className="p-6">
        <div className="grid gap-8 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-1 md:border-r md:border-line md:pr-8">
            <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Overall score</p>
            <ScoreGauge score={scores.overall} />
          </div>
          <div>
            <p className="text-base leading-relaxed text-fg">{analysis.summary}</p>
            <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {SCORE_DIMENSIONS.map(({ key, label }) => {
                const score = scores[key];
                // Sessions saved before a dimension existed simply omit it.
                return typeof score === 'number' ? <ScoreBar key={key} label={label} score={score} /> : null;
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card as="section" className="p-6">
        <CardHeader icon={<Gauge className={ICON} />} title="Fluency" description="Measured from your recording, not estimated." />
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<MessageCircleWarning className={ICON} />} label="Filler words" value={String(metrics.fillerCount)} />
          <Stat icon={<AudioLines className={ICON} />} label="Pace" value={String(metrics.wpm)} unit="wpm" />
          <Stat icon={<PauseCircle className={ICON} />} label="Pauses" value={String(metrics.pauseCount)} unit="> 1.5s" />
          <Stat icon={<Hourglass className={ICON} />} label="Longest pause" value={String(metrics.longestPauseSec)} unit="s" />
        </dl>
        {fillers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-subtle">Fillers used:</span>
            {fillers.map(([word, count]) => (
              <Badge key={word}>
                “{word}” × {count}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm leading-relaxed text-muted">{analysis.fluencyCommentary}</p>
      </Card>

      {(typeof scores.topicRelevance === 'number' || typeof scores.ideaDepth === 'number') && (
        <div className="grid gap-6 md:grid-cols-2">
          {typeof scores.topicRelevance === 'number' && (
            <NoteCard icon={<Target className={ICON} />} title="Staying on topic" score={scores.topicRelevance} note={analysis.topicRelevanceNote} />
          )}
          {typeof scores.ideaDepth === 'number' && (
            <NoteCard icon={<Lightbulb className={ICON} />} title="Idea depth" score={scores.ideaDepth} note={analysis.ideaDepthNote} />
          )}
        </div>
      )}

      {analysis.stuckPoints && analysis.stuckPoints.length > 0 && (
        <Card as="section" className="border-warning/30 p-6">
          <CardHeader
            icon={<Repeat className={`${ICON} text-warning`} />}
            title="Where you got stuck"
            description="Phrases you repeated while searching for your next idea, with what to say instead."
          />
          <ul className="mt-4 flex flex-col gap-3">
            {analysis.stuckPoints.map((point, i) => (
              <li key={i} className="grid gap-2 rounded-lg bg-surface-2 p-3.5 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <p>
                  <span className="block text-xs text-subtle">You repeated</span>
                  <span className="font-medium text-warning">“{point.phrase}”</span>
                </p>
                <ArrowRight className="hidden size-4 text-subtle sm:block" aria-hidden="true" />
                <p>
                  <span className="block text-xs text-subtle">Try instead</span>
                  <span className="font-medium text-success">{point.suggestion}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" className="p-6">
          <CardHeader title="Your transcript" description="Exactly as transcribed, including fillers." />
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-muted">{transcript}</p>
        </Card>
        <Card as="section" className="border-accent-line bg-accent-soft/30 p-6">
          <CardHeader title="Native-speaker version" description="Same ideas, phrased fluently." />
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-fg">{analysis.nativeRewrite}</p>
        </Card>
      </div>

      {analysis.grammarIssues.length > 0 && (
        <Card as="section" className="p-6">
          <CardHeader
            icon={<SpellCheck className={ICON} />}
            title="Grammar & word choice"
            aside={<Badge>{analysis.grammarIssues.length} {analysis.grammarIssues.length === 1 ? 'issue' : 'issues'}</Badge>}
          />
          <ul className="mt-4 divide-y divide-line">
            {analysis.grammarIssues.map((issue, i) => (
              <li key={i} className="py-4 first:pt-0 last:pb-0">
                {issue.category && (
                  <div className="mb-2">
                    <Badge>{issue.category}</Badge>
                  </div>
                )}
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p className="rounded-md bg-danger-soft px-3 py-2 text-danger line-through decoration-danger/50">{issue.original}</p>
                  <p className="rounded-md bg-success-soft px-3 py-2 text-success">{issue.corrected}</p>
                </div>
                <p className="mt-2 text-sm text-muted">{issue.explanation}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {analysis.pronunciationTips.length > 0 && (
        <Card as="section" className="p-6">
          <CardHeader
            icon={<Volume2 className={ICON} />}
            title="Pronunciation tips"
            description="Based on words that are commonly mispronounced; your audio is not scored phonetically."
          />
          <ul className="mt-4 flex flex-col gap-3">
            {analysis.pronunciationTips.map((tip, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
                <span className="shrink-0 font-semibold text-fg sm:w-40">{tip.phrase}</span>
                <span className="text-muted">{tip.tip}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-subtle">
        {icon}
        {label}
      </dt>
      <dd className="mt-1.5 text-xl font-semibold text-fg tabular-nums">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-subtle">{unit}</span>}
      </dd>
    </div>
  );
}

function NoteCard({ icon, title, score, note }: { icon: ReactNode; title: string; score: number; note?: string }) {
  return (
    <Card as="section" className="p-6">
      <CardHeader icon={icon} title={title} aside={<ScorePill score={score} />} />
      {note && <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>}
    </Card>
  );
}
