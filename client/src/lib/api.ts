import type { AnalysisResult, FluencyMetrics, NewSession, Session, TopicRequest, TranscribeResult, VocabEntry } from '../types';

// Relative URLs: in development Vite proxies /api to the Express server (see vite.config.ts),
// and in production Express serves the built client itself, so the API is always same-origin.
const BASE = '/api';

/** An API failure carrying the server's `{ error }` message, which is written to be user-facing. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is it running (npm run dev)?');
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return res.json() as Promise<T>;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Not JSON (e.g. the dev proxy's own error page when the server is down).
  }
  return res.status >= 500 ? 'The server ran into a problem. Check the server logs.' : `Request failed (${res.status})`;
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

export function getSessions(): Promise<Session[]> {
  return request('/sessions');
}

export interface HealthStatus {
  gemini: { configured: boolean };
  whisper: { binary: boolean; model: boolean };
}

export function getHealth(): Promise<HealthStatus> {
  return request('/health');
}

/** Message to show the user for any thrown value. */
export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}
