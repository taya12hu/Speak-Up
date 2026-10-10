import { Check } from 'lucide-react';

const STEPS = ['Prepare', 'Speak', 'Analyse', 'Review'] as const;

/** Horizontal progress indicator for the four phases of a practice attempt. */
export default function StageStepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Attempt progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done ? 'bg-accent text-accent-fg' : active ? 'bg-accent-soft text-accent-text ring-1 ring-accent' : 'bg-surface-2 text-subtle'
              }`}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-sm font-medium ${active ? 'text-fg' : done ? 'text-muted' : 'text-subtle'} hidden sm:inline`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-accent' : 'bg-line'}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
