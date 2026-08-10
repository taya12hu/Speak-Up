import { useEffect, useRef, useState } from 'react';
import type { OutlineNotes } from '../types';

interface PrepTimerProps {
  seconds?: number;
  onDone: (outline: OutlineNotes) => void;
}

const EMPTY_OUTLINE: OutlineNotes = { opening: '', example: '', closing: '' };

export default function PrepTimer({ seconds = 60, onDone }: PrepTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [outline, setOutline] = useState<OutlineNotes>(EMPTY_OUTLINE);
  const outlineRef = useRef(outline);
  outlineRef.current = outline;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (remaining <= 0) {
      onDoneRef.current(outlineRef.current);
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = (remaining / seconds) * 100;

  const setField = (field: keyof OutlineNotes) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setOutline((o) => ({ ...o, [field]: e.target.value }));

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <p className="text-sm text-gray-400">Take a moment to think about your answer</p>

      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-mono text-gray-100">
          {mm}:{ss}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          Jot a quick outline — just for you, not graded
        </p>
        <input
          value={outline.opening}
          onChange={setField('opening')}
          placeholder="Opening point…"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
        />
        <input
          value={outline.example}
          onChange={setField('example')}
          placeholder="Example or reason…"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
        />
        <input
          value={outline.closing}
          onChange={setField('closing')}
          placeholder="Closing point…"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
        />
      </div>

      <button
        onClick={() => setRemaining(0)}
        className="rounded-md bg-sky-600 px-6 py-2 font-medium text-white hover:bg-sky-500"
      >
        Start speaking now
      </button>
    </div>
  );
}
