import { BookOpen, Mic, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { describeError, generateVocab } from '../../lib/api';
import type { VocabEntry } from '../../types';
import PracticeFlow from '../practice/PracticeFlow';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';

export default function VocabMode() {
  const [entry, setEntry] = useState<VocabEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [error, setError] = useState('');

  const next = async () => {
    setLoading(true);
    setPracticing(false);
    setError('');
    try {
      setEntry(await generateVocab());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  if (practicing && entry) {
    return (
      <PracticeFlow topic={`Use the word "${entry.word}": ${entry.speakingAngle}`} mode="vocab" onReset={() => setPracticing(false)} />
    );
  }

  return (
    <div>
      <PageHeader
        title="Vocabulary"
        description="Learn an intermediate-to-advanced word, then use it naturally in a short spoken answer."
        actions={
          entry && (
            <Button variant="secondary" loading={loading} icon={<RefreshCw className="size-4" />} onClick={next}>
              Next word
            </Button>
          )
        }
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        {entry ? (
          <Card className="overflow-hidden">
            <div className="border-b border-line p-6">
              <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Word of the session</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">{entry.word}</p>
              <p className="mt-2 text-base text-muted">{entry.definition}</p>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">Example</p>
                <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-fg italic">{entry.example}</blockquote>
              </div>
              <div className="rounded-lg border border-accent-line bg-accent-soft/60 p-4">
                <p className="mb-1 text-xs font-semibold tracking-wide text-accent-text uppercase">Your speaking prompt</p>
                <p className="text-sm text-fg">{entry.speakingAngle}</p>
              </div>
              <div>
                <Button icon={<Mic className="size-4" />} onClick={() => setPracticing(true)}>
                  Practise using “{entry.word}”
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title="Build your active vocabulary"
            description="Get a B1–C1 level word with a definition, an example sentence and a prompt to use it in your own words."
            action={
              <Button loading={loading} onClick={next}>
                Get a word
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
