interface ProgressRingProps {
  remainingSec: number;
  totalSec: number;
  /** Stroke color of the progress arc. */
  color: string;
  /** Tailwind size + text classes for the wrapper, e.g. "h-40 w-40 text-3xl". */
  className: string;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Circular countdown showing mm:ss, shared by the prep and speaking timers. */
export default function ProgressRing({ remainingSec, totalSec, color, className }: ProgressRingProps) {
  const fraction = totalSec > 0 ? Math.min(1, Math.max(0, remainingSec / totalSec)) : 0;
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  return (
    <div className={`relative ${className}`} role="timer" aria-label={`${mm} minutes ${ss} seconds remaining`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#27272a" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-gray-100">
        {mm}:{ss}
      </div>
    </div>
  );
}
