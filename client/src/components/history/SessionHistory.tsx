import { ChevronDown, History as HistoryIcon, RotateCcw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { describeError, getSessions } from '../../lib/api';
import { computeHistoryStats } from '../../lib/insights';
import { formatDelta } from '../../lib/scores';
import type { PracticeMode, Session } from '../../types';
import AnalysisReport from '../report/AnalysisReport';
import { ScorePill } from '../report/ScoreDisplay';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';
import Spinner from '../ui/Spinner';
import Insights from './Insights';

interface SessionHistoryProps {
  onRetry: (session: Session) => void;
}

const MODE_LABELS: Record<PracticeMode, string> = { random: 'Random topic', interview: 'Interview', vocab: 'Vocabulary' };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Past attempts: headline stats, weak-point insights, overall score trend, and each session's full report. */
export default function SessionHistory({ onRetry }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false));
  }, []);

  const header = <PageHeader title="History" description="Track your progress and revisit past feedback." />;

  if (loading) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
          <Spinner className="size-4" /> Loading history…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {header}
        <Alert>Could not load your history: {error}</Alert>
      </div>
    );
  }

  const stats = computeHistoryStats(sessions);
  if (!stats) {
    return (
      <div>
        {header}
        <EmptyState
          icon={<HistoryIcon className="size-5" />}
          title="No sessions yet"
          description="Complete a practice attempt and your scores and feedback will appear here."
        />
      </div>
    );
  }

  const chartData = sessions
    .slice()
    .reverse()
    .map((s, i) => ({ attempt: i + 1, overall: s.analysis.scores.overall, date: new Date(s.date).toLocaleDateString() }));

  return (
    <div className="flex flex-col gap-6">
      {header}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Sessions" value={stats.count} />
        <StatTile label="Average score" value={stats.average} />
        <StatTile label="Best score" value={stats.best} />
        <StatTile
          label="Last attempt"
          value={sessions[0].analysis.scores.overall}
          detail={
            stats.lastChange !== null && (
              <span className={stats.lastChange > 0 ? 'text-success' : stats.lastChange < 0 ? 'text-danger' : 'text-subtle'}>
                {formatDelta(stats.lastChange)} vs previous
              </span>
            )
          }
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card as="section" className="p-6">
          <CardHeader title="Overall score over time" description="Each point is one practice attempt, oldest to newest." />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="attempt" tickLine={false} axisLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--subtle)', fontSize: 12 }} />
                <Tooltip
                  cursor={{ stroke: 'var(--line-strong)' }}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12, color: 'var(--fg)' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                  formatter={(value) => [value, 'Overall score']}
                />
                <Area
                  type="monotone"
                  dataKey="overall"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#scoreFill)"
                  dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--accent)', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Insights sessions={sessions} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-fg">All sessions</h2>
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const open = expanded === s.id;
            return (
              <li key={s.id}>
                <Card className="overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : s.id)}
                    className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-surface-2/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{s.topic}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                        <Badge>{MODE_LABELS[s.mode] ?? s.mode}</Badge>
                        {dateFormat.format(new Date(s.date))}
                      </p>
                    </div>
                    <ScorePill score={s.analysis.scores.overall} />
                    <ChevronDown className={`size-4 shrink-0 text-subtle transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="flex flex-col gap-6 border-t border-line bg-canvas/60 p-4 sm:p-6">
                      <div>
                        <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => onRetry(s)}>
                          Practise this topic again
                        </Button>
                      </div>
                      <AnalysisReport transcript={s.transcript} metrics={s.metrics} analysis={s.analysis} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: number; detail?: ReactNode }) {
  return (
    <Card className="p-4">
      <dt className="text-xs font-medium text-subtle">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</dd>
      {detail && <dd className="mt-0.5 text-xs">{detail}</dd>}
    </Card>
  );
}
