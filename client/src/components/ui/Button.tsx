import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-sm hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-fg shadow-sm hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}
