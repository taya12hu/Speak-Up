import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import Button from '../ui/Button';

/** Signed-in account and sign-out action, shown in the header. */
export default function AccountMenu() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const email = user.email ?? 'Signed in';
  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden size-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted uppercase sm:flex"
        title={email}
        aria-hidden="true"
      >
        {email.charAt(0)}
      </span>
      <span className="hidden max-w-44 truncate text-sm text-muted xl:inline" title={email}>
        {email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        loading={busy}
        icon={<LogOut className="size-4" />}
        aria-label={`Sign out ${email}`}
        onClick={async () => {
          setBusy(true);
          await signOut();
        }}
      >
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
