import { LogIn, MailCheck, Mic, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { describeAuthError } from '../../auth/authErrors';
import { useAuth } from '../../auth/useAuth';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, TextInput } from '../ui/Field';

type Mode = 'signIn' | 'signUp';

const MIN_PASSWORD_LENGTH = 8;

/** Sign-in / create-account screen shown to signed-out visitors. */
export default function AuthScreen() {
  const { status, notice, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setConfirmationSentTo(email.trim());
      }
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
            <Mic className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Speak Up</h1>
          <p className="mt-1 text-sm text-muted">Impromptu English speaking practice with AI feedback</p>
        </div>

        {status === 'unconfigured' ? (
          <Alert>
            Sign-in is not configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in{' '}
            <code>client/.env.local</code> and restart the dev server.
          </Alert>
        ) : confirmationSentTo ? (
          <Card className="p-6 text-center">
            <MailCheck className="mx-auto mb-3 size-8 text-success" aria-hidden="true" />
            <p className="font-semibold text-fg">Check your email</p>
            <p className="mt-1 text-sm text-muted">
              We sent a confirmation link to <span className="font-medium text-fg">{confirmationSentTo}</span>. Open it, then sign in.
            </p>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              onClick={() => {
                setConfirmationSentTo(null);
                switchMode('signIn');
              }}
            >
              Back to sign in
            </Button>
          </Card>
        ) : (
          <Card className="p-6">
            <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
              {(['signIn', 'signUp'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded-md py-1.5 text-sm font-medium transition ${mode === m ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`}
                >
                  {m === 'signIn' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              {notice && mode === 'signIn' && <Alert tone="warning">{notice}</Alert>}
              {error && <Alert>{error}</Alert>}

              <Field label="Email">
                {(id) => (
                  <TextInput id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
              </Field>
              <Field label="Password" hint={mode === 'signUp' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="password"
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'signUp' ? MIN_PASSWORD_LENGTH : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>

              <Button
                type="submit"
                loading={busy}
                icon={mode === 'signIn' ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
                className="w-full"
              >
                {mode === 'signIn' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-subtle">
          Your practice history is private to your account. Audio is transcribed and then deleted; only text is stored.
        </p>
      </div>
    </div>
  );
}
