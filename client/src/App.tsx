import { lazy, Suspense, useState } from 'react';
import AppHeader from './components/layout/AppHeader';
import InterviewPrep from './components/modes/InterviewPrep';
import TopicGenerator from './components/modes/TopicGenerator';
import VocabMode from './components/modes/VocabMode';
import PracticeFlow from './components/practice/PracticeFlow';
import Spinner from './components/ui/Spinner';
import type { Session, Tab } from './types';

// History pulls in recharts (most of the bundle), so load it only when the tab is opened.
const SessionHistory = lazy(() => import('./components/history/SessionHistory'));

function App() {
  const [tab, setTab] = useState<Tab>('random');
  // Set when the user re-attempts a past topic from History; takes over the main area.
  const [retrySession, setRetrySession] = useState<Session | null>(null);

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        activeTab={tab}
        onSelect={(next) => {
          setRetrySession(null);
          setTab(next);
        }}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
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
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted">
                    <Spinner className="size-4" /> Loading history…
                  </div>
                }
              >
                <SessionHistory onRetry={setRetrySession} />
              </Suspense>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-line py-5 text-center text-xs text-subtle">
        Audio is transcribed locally with whisper.cpp; only text is sent to Gemini for feedback.
      </footer>
    </div>
  );
}

export default App;
