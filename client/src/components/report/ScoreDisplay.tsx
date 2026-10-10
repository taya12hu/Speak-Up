import { SCORE_TONE_LABELS, scoreTone, type ScoreTone } from '../../lib/scores';

const TEXT: Record<ScoreTone, string> = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' };
const STROKE: Record<ScoreTone, string> = { success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger' };
const FILL: Record<ScoreTone, string> = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Circular 0–100 gauge for the overall score, coloured by score band. */
export function ScoreGauge({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-32" role="img" aria-label={`Overall score ${score} out of 100, ${SCORE_TONE_LABELS[tone]}`}>
        <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" className="stroke-surface-2" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
            className={STROKE[tone]}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tracking-tight text-fg tabular-nums">{score}</span>
          <span className="text-xs text-subtle">of 100</span>
        </div>
      </div>
      <span className={`text-sm font-medium ${TEXT[tone]}`}>{SCORE_TONE_LABELS[tone]}</span>
    </div>
  );
}

/** Labelled horizontal bar for one score dimension. */
export function ScoreBar({ label, score }: { label: string; score: number }) {
  const tone = scoreTone(score);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-fg tabular-nums">{score}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

/** Compact "72/100" pill used in section headers. */
export function ScorePill({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <span className={`shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-sm font-semibold tabular-nums ${TEXT[tone]}`}>
      {score}
      <span className="font-normal text-subtle">/100</span>
    </span>
  );
}
