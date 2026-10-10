import { describe, expect, it } from 'vitest';
import { describeAuthError } from './authErrors';

const authError = (message: string, code?: string) => Object.assign(new Error(message), code ? { code } : {});

describe('describeAuthError', () => {
  it('does not reveal whether the email or the password was wrong', () => {
    expect(describeAuthError(authError('Invalid login credentials', 'invalid_credentials'))).toBe('Incorrect email or password.');
  });

  it('explains unconfirmed email addresses', () => {
    expect(describeAuthError(authError('Email not confirmed', 'email_not_confirmed'))).toMatch(/confirm your email/);
  });

  it('points existing users to sign in', () => {
    expect(describeAuthError(authError('User already registered', 'user_already_exists'))).toMatch(/Sign in instead/);
  });

  it('explains rate limiting and network failures', () => {
    expect(describeAuthError(authError('Request rate limit reached', 'over_request_rate_limit'))).toMatch(/Too many attempts/);
    expect(describeAuthError(new TypeError('Failed to fetch'))).toMatch(/Could not reach the sign-in service/);
  });

  it('falls back to the original message, or a generic one', () => {
    expect(describeAuthError(authError('Signups not allowed for this instance'))).toBe('Signups not allowed for this instance');
    expect(describeAuthError('???')).toBe('Something went wrong. Please try again.');
  });
});
