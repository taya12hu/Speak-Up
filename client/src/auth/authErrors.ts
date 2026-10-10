/** Turns Supabase Auth errors into messages written for the person signing in. */
export function describeAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Please confirm your email address first: check your inbox for the confirmation link.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  if (code === 'weak_password' || /password should be/i.test(message)) return message || 'Please choose a stronger password.';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (/fetch|network/i.test(message)) return 'Could not reach the sign-in service. Check your connection and try again.';
  return message || 'Something went wrong. Please try again.';
}
