import { useState } from 'react';
import type { Mode, Session } from './types';
import TopicGenerator from './components/TopicGenerator';
import InterviewPrep from './components/InterviewPrep';
import VocabMode from './components/VocabMode';
import SessionHistory from './components/SessionHistory';
import PracticeFlow from './components/PracticeFlow';

const TABS: { id: Mode; label: string }[] = [
  { id: 'random', label: 'Random Topic' },
  { id: 'interview', label: 'Interview Prep' },
  { id: 'vocab', label: 'Vocab' },
  { id: 'history', label: 'History' },
];

function App() {
  const [mode, setMode] = useState<Mode>('random');
  const [retrySession, setRetrySession] = useState<Session | null>(null);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-center text-3xl font-semibold text-gray-100">Speak Up</h1>
      <p className="mb-8 text-center text-sm text-gray-500">Impromptu English speaking practice, with AI feedback</p>

      <div className="mb-8 flex justify-center gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setRetrySession(null);
              setMode(t.id);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              mode === t.id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        {retrySession ? (
          <PracticeFlow
            topic={retrySession.topic}
            mode={retrySession.mode}
            compareTo={retrySession}
            onReset={() => setRetrySession(null)}
          />
        ) : (
          <>
            {mode === 'random' && <TopicGenerator />}
            {mode === 'interview' && <InterviewPrep />}
            {mode === 'vocab' && <VocabMode />}
            {mode === 'history' && <SessionHistory onRetry={setRetrySession} />}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
