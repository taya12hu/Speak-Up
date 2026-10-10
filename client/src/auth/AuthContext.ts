import type { User } from '@supabase/supabase-js';
import { createContext } from 'react';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'unconfigured';

export interface SignUpResult {
  /** True when the project requires email confirmation before the first sign-in. */
  needsConfirmation: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Shown on the sign-in screen, e.g. after a session expired. */
  notice: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
