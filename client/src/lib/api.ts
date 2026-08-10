import type { AnalysisResult, Difficulty, FluencyMetrics, Session, TranscribeResult, VocabEntry } from '../types';

const BASE = 'http://localhost:4000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export function generateTopics(params: {
  category: string;
  difficulty: Difficulty;
  theme?: string;
  count: number;
  interview?: boolean;
}): Promise<string[]> {
  return post('/api/topics', params);
}

export function generateVocab(): Promise<VocabEntry> {
  return post('/api/vocab', {});
}

export function generateInterviewSample(question: string, framework: string): Promise<string> {
  return post<{ sample: string }>('/api/interview-sample', { question, framework }).then((r) => r.sample);
}

export async function transcribeAudio(wavBlob: Blob): Promise<TranscribeResult> {
  const form = new FormData();
  form.append('audio', wavBlob, 'recording.wav');
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`transcribe failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export function analyzeSpeech(params: {
  topic: string;
  transcript: string;
  metrics: FluencyMetrics;
}): Promise<AnalysisResult> {
  return post('/api/analyze', params);
}

export async function saveSession(session: Session): Promise<void> {
  await post('/api/sessions', session);
}

export async function getSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE}/api/sessions`);
  if (!res.ok) throw new Error('failed to load sessions');
  return res.json();
}
