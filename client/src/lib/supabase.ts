import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Browser Supabase client, used only for authentication (sign-up, sign-in, token refresh).
 * Practice data goes through the Express API, which verifies the token on every request.
 * Only the public publishable key belongs in the browser; it grants nothing beyond what
 * Row Level Security allows the signed-in user. Null when the client env is not configured.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
