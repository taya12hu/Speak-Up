import { Briefcase, Check, Lightbulb, Mic, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { describeError, generateInterviewSample, generateTopics } from '../../lib/api';
import { FRAMEWORKS, type Framework } from '../../lib/practiceOptions';
import PracticeFlow from '../practice/PracticeFlow';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';

export default function InterviewPrep() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<Framework>(FRAMEWORKS[0]);
  const [sample, setSample] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [error, setError] = useState('');

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    setSelectedQuestion(null);
    setSample(null);
    try {
      const result = await generateTopics({ category: 'professional', difficulty: 'Medium', count: 5, interview: true });
      setQuestions(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const showSample = async () => {
    if (!selectedQuestion) return;
    setSampleLoading(true);
    setError('');
    try {
      setSample(await generateInterviewSample(selectedQuestion, selectedFramework.id));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSampleLoading(false);
    }
  };

  if (practicing && selectedQuestion) {
    return <PracticeFlow topic={selectedQuestion} mode="interview" onReset={() => setPracticing(false)} />;
  }

  return (
    <div>
      <PageHeader
        title="Interview Prep"
        description="Structure your answer with a proven framework, then practise a realistic interview question."
      />

      <div className="flex flex-col gap-8">
        <StepSection number={1} title="Choose a framework">
          <div role="radiogroup" aria-label="Answer framework" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FRAMEWORKS.map((fw) => {
              const active = selectedFramework.id === fw.id;
              return (
                <button
                  key={fw.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setSelectedFramework(fw);
                    setSample(null);
                  }}
                  className={`relative rounded-xl border p-4 text-left shadow-sm transition ${
                    active ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  {active && <Check className="absolute top-3 right-3 size-4 text-accent-text" aria-hidden="true" />}
                  <p className="font-semibold text-fg">{fw.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{fw.bestFor}</p>
                </button>
              );
            })}
          </div>

          <Card className="mt-3 p-4">
            <ol className="grid gap-3 sm:grid-cols-2">
              {selectedFramework.steps.map((s, i) => (
                <li key={`${s.label}-${i}`} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{s.label}</p>
                    <p className="text-sm text-muted">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </StepSection>

        <StepSection
          number={2}
          title="Pick a question"
          action={
            <Button
              variant={questions.length ? 'secondary' : 'primary'}
              size="sm"
              loading={loading}
              icon={<RefreshCw className="size-4" />}
              onClick={loadQuestions}
            >
              {questions.length ? 'New questions' : 'Generate questions'}
            </Button>
          }
        >
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
            </div>
          )}
          {questions.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title="No questions yet"
              description="Generate a set of behavioural and professional questions an interviewer might ask."
            />
          ) : (
            <div role="radiogroup" aria-label="Interview question" className="flex flex-col gap-2">
              {questions.map((q, i) => {
                const active = selectedQuestion === q;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedQuestion(q);
                      setSample(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm shadow-sm transition ${
                      active ? 'border-accent bg-accent-soft text-fg ring-1 ring-accent' : 'border-line bg-surface text-fg hover:border-line-strong'
                    }`}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-accent bg-accent' : 'border-line-strong'}`}
                      aria-hidden="true"
                    >
                      {active && <span className="size-1.5 rounded-full bg-accent-fg" />}
                    </span>
                    <span className="font-medium">{q}</span>
                  </button>
                );
              })}
            </div>
          )}
        </StepSection>

        {selectedQuestion && (
          <StepSection number={3} title="Practise">
            <Card className="p-5">
              <p className="text-sm text-muted">Selected question</p>
              <p className="mt-1 font-medium text-fg">{selectedQuestion}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button icon={<Mic className="size-4" />} onClick={() => setPracticing(true)}>
                  Practise this question
                </Button>
                <Button variant="secondary" loading={sampleLoading} icon={<Lightbulb className="size-4" />} onClick={showSample}>
                  Show a sample {selectedFramework.id} answer
                </Button>
              </div>

              {sample && (
                <div className="mt-5 rounded-lg border border-accent-line bg-accent-soft/50 p-4">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-accent-text uppercase">Sample answer · {selectedFramework.name}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg">{highlightLabels(sample, selectedFramework)}</p>
                </div>
              )}
            </Card>
          </StepSection>
        )}
      </div>
    </div>
  );
}

function StepSection({ number, title, action, children }: { number: number; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-fg">
          <span className="flex size-6 items-center justify-center rounded-full bg-fg text-xs text-canvas">{number}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Bolds the framework's step labels (e.g. "Situation:") that the model writes inline. */
function highlightLabels(text: string, framework: Framework): ReactNode[] {
  const labels = [...new Set(framework.steps.map((s) => s.label))].map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${labels.join('|')}):`, 'g');
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-accent-text">
        {part}:
      </strong>
    ) : (
      part
    ),
  );
}
