import { AlertTriangle, CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'error' | 'warning' | 'info';

const TONES: Record<Tone, { className: string; Icon: typeof Info }> = {
  error: { className: 'border-danger/30 bg-danger-soft text-danger', Icon: CircleAlert },
  warning: { className: 'border-warning/30 bg-warning-soft text-warning', Icon: AlertTriangle },
  info: { className: 'border-info/30 bg-info-soft text-info', Icon: Info },
};

export default function Alert({ tone = 'error', children }: { tone?: Tone; children: ReactNode }) {
  const { className, Icon } = TONES[tone];
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={`flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
