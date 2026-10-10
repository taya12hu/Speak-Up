import { ArrowLeft, Check, ListChecks, RotateCcw, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { analyzeSpeech, describeError, saveSession, transcribeAudio } from '../../lib/api';
import type { AnalysisResult, FluencyMetrics, OutlineNotes, PracticeMode, Session } from '../../types';
import { computeFluencyMetrics } from '../../lib/fluency';
import AnalysisReport from '../report/AnalysisReport';
import SessionComparison from '../report/SessionComparison';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import Spinner from '../ui/Spinner';
import PrepTimer from './PrepTimer';
import Recorder from './Recorder';
import StageStepper from './StageStepper';
import Timer from './Timer';

interface PracticeFlowProps {
  topic: string;
  mode: PracticeMode;
  onReset: () => void;
  /** A previous attempt at the same topic to compare the new result against. */
  compareTo?: Session;
}

type Stage = 'prep' | 'practice' | 'transcribing' | 'analyzing' | 'report' | 'error';

const PREP_SECONDS = 60;

const MODE_LABELS: Record<PracticeMode, string> = { random: 'Random topic', interview: 'Interview', vocab: 'Vocabulary' };

// Errors can only happen after recording (transcription or analysis), so they sit on the "Analyse" step.
const STEP_INDEX: Record<Stage, number> = { prep: 0, practice: 1, transcribing: 2, analyzing: 2, error: 2, report: 3 };

/**
 * One practice attempt: prep → record → transcribe (local whisper) → metrics (client-side)
 * → analysis (Gemini) → report, saving the result to history.
 */
export default function PracticeFlow({ topic, mode, onReset, compareTo }: PracticeFlowProps) {
  const [stage, setStage] = useState<Stage>('prep');
  const [transcript, setTranscript] = useState('');
  const [metrics, setMetrics] = useState<FluencyMetrics | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saveWarning, setSaveWarning] = useState('');
  const [outline, setOutline] = useState<OutlineNotes | null>(null);

  const fail = (message: string) => {
    setErrorMsg(message);
    setStage('error');
  };

  const handleRecorded = async (wavBlob: Blob) => {
    setStage('transcribing');
    setSaveWarning('');

    let text: string;
    let computedMetrics: FluencyMetrics;
    let result: AnalysisResult;
    try {
      const transcribed = await transcribeAudio(wavBlob);
      text = transcribed.text;
      if (!text) return fail('No speech was detected in the recording. Check your microphone and try again.');
      computedMetrics = computeFluencyMetrics(transcribed);
      setTranscript(text);
      setMetrics(computedMetrics);

      setStage('analyzing');
      result = await analyzeSpeech({ topic, transcript: text, metrics: computedMetrics });
    } catch (err) {
      return fail(describeError(err));
    }

    setAnalysis(result);
    setStage('report');

    // The report is already on screen; a failed save should not take it away.
    try {
      await saveSession({ mode, topic, transcript: text, metrics: computedMetrics, analysis: result });
    } catch (err) {
      setSaveWarning(`This attempt could not be saved to your history: ${describeError(err)}`);
    }
  };

  const hasOutline = outline && (outline.opening || outline.example || outline.closing);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={onReset} className="-ml-2">
          {compareTo ? 'Back to history' : 'Choose another topic'}
        </Button>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{MODE_LABELS[mode]}</Badge>
          {compareTo && <Badge>Retry · compared with {new Date(compareTo.date).toLocaleDateString()}</Badge>}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-balance text-fg sm:text-2xl">{topic}</h1>
        <div className="mt-5 border-t border-line pt-4">
          <StageStepper current={STEP_INDEX[stage]} />
        </div>
      </Card>

      {stage === 'prep' && (
        <PrepTimer
          seconds={PREP_SECONDS}
          onDone={(notes) => {
            setOutline(notes);
            setStage('practice');
          }}
        />
      )}

      {stage === 'practice' && (
        <>
          {hasOutline && (
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                <ListChecks className="size-4 text-subtle" aria-hidden="true" /> Your outline
              </p>
              <ol className="grid gap-2 text-sm sm:grid-cols-3">
                {[outline.opening, outline.example, outline.closing].map((note, i) =>
                  note ? (
                    <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-fg">
                      <span className="mr-1.5 font-semibold text-subtle">{i + 1}.</span>
                      {note}
                    </li>
                  ) : null,
                )}
              </ol>
            </Card>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <Recorder onRecorded={handleRecorded} />
            <Timer />
          </div>
        </>
      )}

      {(stage === 'transcribing' || stage === 'analyzing') && (
        <Card className="p-8" as="section">
          <div role="status" aria-live="polite" className="mx-auto flex max-w-sm flex-col gap-4">
            <p className="text-center text-base font-semibold text-fg">Generating your feedback</p>
            <ProcessingStep label="Transcribing speech locally" state={stage === 'transcribing' ? 'active' : 'done'} />
            <ProcessingStep label="Analysing your answer with AI" state={stage === 'analyzing' ? 'active' : 'pending'} />
          </div>
        </Card>
      )}

      {stage === 'error' && (
        <Card className="flex flex-col gap-4 p-6">
          <Alert>{errorMsg}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button icon={<RotateCcw className="size-4" />} onClick={() => setStage('practice')}>
              Try again
            </Button>
            <Button variant="secondary" onClick={onReset}>
              Choose another topic
            </Button>
          </div>
        </Card>
      )}

      {stage === 'report' && analysis && metrics && (
        <>
          {saveWarning && <Alert tone="warning">{saveWarning}</Alert>}
          {compareTo && <SessionComparison previous={compareTo} currentAnalysis={analysis} currentTranscript={transcript} />}
          <AnalysisReport transcript={transcript} metrics={metrics} analysis={analysis} />
          <div className="flex flex-wrap justify-center gap-2 border-t border-line pt-6">
            <Button icon={<Shuffle className="size-4" />} onClick={onReset}>
              Practise another topic
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ProcessingStep({ label, state }: { label: string; state: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line px-4 py-3">
      <span className="flex size-5 items-center justify-center">
        {state === 'done' ? (
          <Check className="size-4 text-success" aria-hidden="true" />
        ) : state === 'active' ? (
          <Spinner className="size-4 text-accent-text" />
        ) : (
          <span className="size-2 rounded-full bg-line-strong" aria-hidden="true" />
        )}
      </span>
      <span className={`text-sm ${state === 'pending' ? 'text-subtle' : 'text-fg'}`}>{label}</span>
    </div>
  );
}
