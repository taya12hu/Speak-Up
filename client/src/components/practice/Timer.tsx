import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
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
    <Card className="flex flex-col p-5">
      <CardHeader
        title="Speaking timer"
        description={remainingSec === 0 ? "Time's up — wrap up your answer." : 'Optional pacing aid.'}
      />

      <div role="group" aria-label="Timer length" className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={durationSec === p}
            onClick={() => setPreset(p)}
            className={`rounded-md py-1.5 text-sm font-medium transition ${
              durationSec === p ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
            }`}
          >
            {p / 60} min
          </button>
        ))}
      </div>

      <ProgressRing remainingSec={remainingSec} totalSec={durationSec} className="mx-auto my-6 size-36 text-3xl" />

      <div className="flex items-center justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => adjust(-STEP_SEC)} aria-label="Remove 30 seconds">
          −30s
        </Button>
        <Button size="sm" onClick={togglePrimary} icon={running ? <Pause className="size-4" /> : <Play className="size-4" />} className="min-w-24">
          {primaryLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => adjust(STEP_SEC)} aria-label="Add 30 seconds">
          +30s
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset timer" icon={<RotateCcw className="size-4" />} />
      </div>
    </Card>
  );
}
