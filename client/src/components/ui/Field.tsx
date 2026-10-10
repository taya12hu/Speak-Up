import { ChevronDown } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const CONTROL =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg shadow-sm transition-colors placeholder:text-subtle hover:border-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

interface FieldProps {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}

/** Label + control + optional hint, wired together with a generated id. */
export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={`${CONTROL} appearance-none pr-9 ${className}`} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
    </div>
  );
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...rest} />;
}
