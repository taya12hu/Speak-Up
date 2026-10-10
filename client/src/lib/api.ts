import type { AnalysisResult, FluencyMetrics, NewSession, Session, TopicRequest, TranscribeResult, VocabEntry } from '../types';

// Relative URLs: in development Vite proxies /api to the Express server (see vite.config.ts),
// and in production Express serves the built client itself, so the API is always same-origin.
const BASE = '/api';

/** An API failure carrying the server's `{ error, code }`; the message is written to be user-facing. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** How the API client obtains credentials; provided by the auth layer (see auth/AuthProvider). */
export interface ApiAuth {
  /** Current access token, or null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Forces a token refresh; resolves to the new token, or null if the session cannot be renewed. */
  refreshAccessToken(): Promise<string | null>;
  /** Called when the server still rejects the user after a refresh: the session is over. */
  onSessionExpired(): void;
}

let auth: ApiAuth | null = null;

export function configureApiAuth(next: ApiAuth | null) {
  auth = next;
}

const TOKEN_REJECTED = new Set(['token_expired', 'token_invalid']);

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const token = await auth?.getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is it running (npm run dev)?');
  }

  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  const { message, code } = await readError(res);
  if (res.status === 401 && auth) {
    // A stale token (e.g. after the laptop slept): refresh once and retry the same request.
    if (!isRetry && code && TOKEN_REJECTED.has(code) && (await auth.refreshAccessToken())) {
      return request<T>(path, init, true);
    }
    auth.onSessionExpired();
  }
  throw new ApiError(res.status, message, code);
}

async function readError(res: Response): Promise<{ message: string; code?: string }> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return { message: body.error, code: typeof body.code === 'string' ? body.code : undefined };
  } catch {
    // Not JSON (e.g. the dev proxy's own error page when the server is down).
  }
  return { message: res.status >= 500 ? 'The server ran into a problem. Check the server logs.' : `Request failed (${res.status})` };
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function generateTopics(params: TopicRequest): Promise<string[]> {
  return post('/topics', params);
}

export function generateVocab(): Promise<VocabEntry> {
  return post('/vocab', {});
}

export async function generateInterviewSample(question: string, framework: string): Promise<string> {
  const { sample } = await post<{ sample: string }>('/interview-sample', { question, framework });
  return sample;
}

export function transcribeAudio(wavBlob: Blob): Promise<TranscribeResult> {
  const form = new FormData();
  form.append('audio', wavBlob, 'recording.wav');
  return request('/transcribe', { method: 'POST', body: form });
}

export function analyzeSpeech(params: { topic: string; transcript: string; metrics: FluencyMetrics }): Promise<AnalysisResult> {
  return post('/analyze', params);
}

export function saveSession(session: NewSession): Promise<Session> {
  return post('/sessions', session);
}

/** The signed-in user's sessions, newest first. The server scopes this to the token's owner. */
export function getSessions(): Promise<Session[]> {
  return request('/sessions');
}

export function deleteSession(id: string): Promise<void> {
  return request(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface HealthStatus {
  gemini: { configured: boolean };
  whisper: { binary: boolean; model: boolean };
  auth?: { configured: boolean };
}

export function getHealth(): Promise<HealthStatus> {
  return request('/health');
}

/** Message to show the user for any thrown value. */
export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}
