import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { describeError, generateTopics } from '../../lib/api';
import { CATEGORIES, DIFFICULTIES } from '../../lib/practiceOptions';
import type { Difficulty } from '../../types';
import PracticeFlow from '../practice/PracticeFlow';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { Field, Select, TextInput } from '../ui/Field';
import PageHeader from '../ui/PageHeader';

const TOPIC_COUNTS = [3, 5, 10];

export default function TopicGenerator() {
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState(5);
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      setTopics(await generateTopics({ category, difficulty, theme: theme.trim() || undefined, count }));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  if (selected) {
    return <PracticeFlow topic={selected} mode="random" onReset={() => setSelected(null)} />;
  }

  const categoryDescription = CATEGORIES.find((c) => c.id === category)?.description;

  return (
    <div>
      <PageHeader title="Random Topic" description="Generate impromptu topics, pick one, and answer it out loud." />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <form onSubmit={generate} className="flex flex-col gap-4">
            <Field label="Category" hint={categoryDescription}>
              {(id) => (
                <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Difficulty">
                {(id) => (
                  <Select id={id} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Topics">
                {(id) => (
                  <Select id={id} value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {TOPIC_COUNTS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <Field label="Theme" hint="Optional — steer topics toward a subject.">
              {(id) => (
                <TextInput id={id} value={theme} maxLength={100} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. career, travel" />
              )}
            </Field>

            <Button type="submit" loading={loading} icon={<Sparkles className="size-4" />} className="w-full">
              {loading ? 'Generating…' : topics.length ? 'Generate new topics' : 'Generate topics'}
            </Button>
          </form>
        </Card>

        <div className="flex flex-col gap-3">
          {error && <Alert>{error}</Alert>}

          {topics.length === 0 ? (
            <EmptyState
              icon={<MessageSquareText className="size-5" />}
              title="No topics yet"
              description="Choose a category and difficulty, then generate a set of topics to practise with."
            />
          ) : (
            <>
              <p className="text-sm text-muted">Select a topic to start a timed attempt.</p>
              <ul className="flex flex-col gap-2">
                {topics.map((t, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelected(t)}
                      className="group flex w-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 text-left shadow-sm transition hover:border-accent-line hover:bg-accent-soft/40"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold text-muted tabular-nums">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-fg">{t}</span>
                      <ArrowRight className="size-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-text" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
