import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Use "section" for landmark-worthy blocks such as report sections. */
  as?: 'div' | 'section';
}

export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return <Tag className={`rounded-xl border border-line bg-surface shadow-sm ${className}`}>{children}</Tag>;
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Right-aligned content, e.g. a score or a button. */
  aside?: ReactNode;
}

export function CardHeader({ title, description, icon, aside }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 text-subtle">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}
