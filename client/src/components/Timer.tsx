import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  onExpire?: () => void;
}

const PRESETS = [60, 180, 300];

export default function Timer({ onExpire }: TimerProps) {
  const [durationSec, setDurationSec] = useState(180);
  const [remainingSec, setRemainingSec] = useState(180);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalRef.current!);
          setRunning(false);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running, onExpire]);

  const setPreset = (sec: number) => {
    setDurationSec(sec);
    setRemainingSec(sec);
    setRunning(false);
  };

  const adjust = (deltaSec: number) => {
    setDurationSec((d) => Math.max(30, d + deltaSec));
    setRemainingSec((r) => Math.max(30, r + deltaSec));
  };

  const reset = () => {
    setRunning(false);
    setRemainingSec(durationSec);
  };

  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');
  const pct = (remainingSec / durationSec) * 100;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-md px-3 py-1 text-sm ${
              durationSec === p ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {p / 60} min
          </button>
        ))}
      </div>

      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#a855f7"
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-3xl font-mono text-gray-100">
          {mm}:{ss}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => adjust(-30)} className="rounded-md bg-gray-800 px-3 py-1 text-gray-300 hover:bg-gray-700">
          -30s
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          className="rounded-md bg-violet-600 px-6 py-2 font-medium text-white hover:bg-violet-500"
        >
          {running ? 'Pause' : remainingSec === durationSec ? 'Start' : 'Resume'}
        </button>
        <button onClick={() => adjust(30)} className="rounded-md bg-gray-800 px-3 py-1 text-gray-300 hover:bg-gray-700">
          +30s
        </button>
      </div>
      <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">
        Reset
      </button>
    </div>
  );
}
