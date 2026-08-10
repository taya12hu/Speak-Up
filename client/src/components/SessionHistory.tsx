import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getSessions } from '../lib/api';
import type { Session } from '../types';
import AnalysisReport from './AnalysisReport';
import Insights from './Insights';

interface SessionHistoryProps {
  onRetry: (session: Session) => void;
}

export default function SessionHistory({ onRetry }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading history…</p>;
  if (sessions.length === 0) return <p className="text-sm text-gray-500">No sessions yet — go practice something first.</p>;

  const chartData = sessions
    .slice()
    .reverse()
    .map((s, i) => ({ index: i + 1, overall: s.analysis.scores.overall, date: new Date(s.date).toLocaleDateString() }));

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <Insights sessions={sessions} />

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-3 text-lg font-medium text-gray-100">Score over time</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="index" stroke="#6b7280" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
            />
            <Line type="monotone" dataKey="overall" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <button className="flex w-full items-center justify-between text-left" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div>
                <p className="text-sm text-gray-200">{s.topic}</p>
                <p className="text-xs text-gray-500">
                  {new Date(s.date).toLocaleString()} · {s.mode}
                </p>
              </div>
              <span className="text-lg font-semibold text-violet-400">{s.analysis.scores.overall}</span>
            </button>
            {expanded === s.id && (
              <div className="mt-4 flex flex-col items-center gap-4 border-t border-gray-800 pt-4">
                <button
                  onClick={() => onRetry(s)}
                  className="rounded-md border border-violet-700 px-4 py-1.5 text-sm text-violet-300 hover:bg-violet-950/40"
                >
                  Practice this topic again
                </button>
                <AnalysisReport transcript={s.transcript} metrics={s.metrics} analysis={s.analysis} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
