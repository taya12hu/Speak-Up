import { lazy, Suspense, useState } from 'react';
import InterviewPrep from './components/modes/InterviewPrep';
import TopicGenerator from './components/modes/TopicGenerator';
import VocabMode from './components/modes/VocabMode';
import PracticeFlow from './components/practice/PracticeFlow';
import type { Session, Tab } from './types';

// History pulls in recharts (most of the bundle), so load it only when the tab is opened.
const SessionHistory = lazy(() => import('./components/history/SessionHistory'));

const TABS: { id: Tab; label: string }[] = [
  { id: 'random', label: 'Random Topic' },
  { id: 'interview', label: 'Interview Prep' },
  { id: 'vocab', label: 'Vocab' },
  { id: 'history', label: 'History' },
];

function App() {
  const [tab, setTab] = useState<Tab>('random');
  // Set when the user re-attempts a past topic from History; takes over the main area.
  const [retrySession, setRetrySession] = useState<Session | null>(null);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <h1 className="mb-1 text-center text-3xl font-semibold text-gray-100">Speak Up</h1>
      <p className="mb-8 text-center text-sm text-gray-500">Impromptu English speaking practice, with AI feedback</p>

      <nav className="mb-8 flex justify-center gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setRetrySession(null);
              setTab(t.id);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex justify-center">
        {retrySession ? (
          <PracticeFlow
            topic={retrySession.topic}
            mode={retrySession.mode}
            compareTo={retrySession}
            onReset={() => setRetrySession(null)}
          />
        ) : (
          <>
            {tab === 'random' && <TopicGenerator />}
            {tab === 'interview' && <InterviewPrep />}
            {tab === 'vocab' && <VocabMode />}
            {tab === 'history' && (
              <Suspense fallback={<p className="text-sm text-gray-500">Loading history…</p>}>
                <SessionHistory onRetry={setRetrySession} />
              </Suspense>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
