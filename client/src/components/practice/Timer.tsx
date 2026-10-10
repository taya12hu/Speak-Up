import { useEffect, useState } from 'react';
import ProgressRing from './ProgressRing';

const PRESETS = [60, 180, 300];
const DEFAULT_SEC = 180;
const MIN_DURATION_SEC = 30;
const STEP_SEC = 30;

/** Speaking countdown. Purely a pacing aid: it does not stop the recording when it expires. */
export default function Timer() {
  const [durationSec, setDurationSec] = useState(DEFAULT_SEC);
  const [remainingSec, setRemainingSec] = useState(DEFAULT_SEC);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setRemainingSec((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Stop once time runs out (state adjusted during render, so the interval is cleared on the next commit).
  if (running && remainingSec === 0) setRunning(false);

  const setPreset = (sec: number) => {
    setDurationSec(sec);
    setRemainingSec(sec);
    setRunning(false);
  };

  const adjust = (deltaSec: number) => {
    setDurationSec((d) => Math.max(MIN_DURATION_SEC, d + deltaSec));
    setRemainingSec((r) => Math.max(0, r + deltaSec));
  };

  const reset = () => {
    setRunning(false);
    setRemainingSec(durationSec);
  };

  const togglePrimary = () => {
    if (remainingSec === 0) {
      setRemainingSec(durationSec);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  };

  const primaryLabel = remainingSec === 0 ? 'Restart' : running ? 'Pause' : remainingSec === durationSec ? 'Start' : 'Resume';

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

      <ProgressRing remainingSec={remainingSec} totalSec={durationSec} color="#a855f7" className="h-40 w-40 text-3xl" />

      <div className="flex items-center gap-2">
        <button onClick={() => adjust(-STEP_SEC)} className="rounded-md bg-gray-800 px-3 py-1 text-gray-300 hover:bg-gray-700">
          -30s
        </button>
        <button onClick={togglePrimary} className="rounded-md bg-violet-600 px-6 py-2 font-medium text-white hover:bg-violet-500">
          {primaryLabel}
        </button>
        <button onClick={() => adjust(STEP_SEC)} className="rounded-md bg-gray-800 px-3 py-1 text-gray-300 hover:bg-gray-700">
          +30s
        </button>
      </div>
      <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300">
        Reset
      </button>
    </div>
  );
}
