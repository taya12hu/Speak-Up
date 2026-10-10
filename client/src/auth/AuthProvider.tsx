import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configureApiAuth } from '../lib/api';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

/**
 * Owns the Supabase Auth session: restores it on load (supabase-js persists it in localStorage
 * and refreshes the access token automatically), tracks sign-in/out, and gives the API client
 * a way to read and refresh the token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });

    configureApiAuth({
      // getSession() returns the stored session, refreshing it first if the access token expired.
      getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      refreshAccessToken: async () => (await client.auth.refreshSession()).data.session?.access_token ?? null,
      onSessionExpired: () => {
        setNotice(SESSION_EXPIRED);
        // Local sign-out: the server already rejected the session, so there is nothing to revoke.
        void client.auth.signOut({ scope: 'local' });
      },
    });

    return () => {
      subscription.subscription.unsubscribe();
      configureApiAuth(null);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Sign-in is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setNotice(null);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Sign-in is not configured.');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) throw error;
    setNotice(null);
    // With email confirmation enabled, Supabase creates the user but returns no session yet.
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    setNotice(null);
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user: session?.user ?? null, notice, signIn, signUp, signOut }),
    [status, session, notice, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
