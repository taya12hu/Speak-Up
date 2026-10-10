import { useEffect, useState } from 'react';
import { getHealth, type HealthStatus } from '../../lib/api';

type State = { kind: 'loading' } | { kind: 'offline' } | { kind: 'ready' } | { kind: 'degraded'; problems: string[] };

function evaluate(health: HealthStatus): State {
  const problems = [
    !health.gemini.configured && 'Gemini API key is not set',
    !health.whisper.binary && 'whisper.cpp binary not found',
    !health.whisper.model && 'whisper model not found',
    health.auth?.configured === false && 'Supabase is not configured on the server',
  ].filter((p): p is string => Boolean(p));
  return problems.length ? { kind: 'degraded', problems } : { kind: 'ready' };
}

const DISPLAY = {
  loading: { dot: 'bg-subtle', label: 'Checking…' },
  ready: { dot: 'bg-success', label: 'Ready' },
  degraded: { dot: 'bg-warning', label: 'Setup needed' },
  offline: { dot: 'bg-danger', label: 'Server offline' },
} as const;

/** Small readiness indicator backed by GET /api/health; the tooltip names what is missing. */
export default function SystemStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    getHealth()
      .then((health) => setState(evaluate(health)))
      .catch(() => setState({ kind: 'offline' }));
  }, []);

  const { dot, label } = DISPLAY[state.kind];
  const detail =
    state.kind === 'degraded'
      ? state.problems.join('; ')
      : state.kind === 'offline'
        ? 'Start the API with `npm run dev` from the repository root.'
        : state.kind === 'ready'
          ? 'Gemini, whisper.cpp and Supabase are configured.'
          : undefined;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted"
      title={detail}
      role="status"
      aria-label={detail ? `${label}: ${detail}` : label}
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </div>
  );
}
