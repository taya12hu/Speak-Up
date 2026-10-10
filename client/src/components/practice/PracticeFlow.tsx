import { useState } from 'react';
import { analyzeSpeech, describeError, saveSession, transcribeAudio } from '../../lib/api';
import { computeFluencyMetrics } from '../../lib/fluency';
import type { AnalysisResult, FluencyMetrics, OutlineNotes, PracticeMode, Session } from '../../types';
import AnalysisReport from '../report/AnalysisReport';
import SessionComparison from '../report/SessionComparison';
import PrepTimer from './PrepTimer';
import Recorder from './Recorder';
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

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="max-w-xl rounded-lg border border-gray-800 bg-gray-900/50 px-5 py-4 text-center">
        <p className="text-xs uppercase tracking-wide text-violet-400">Your topic</p>
        <p className="mt-1 text-lg text-gray-100">{topic}</p>
      </div>

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
          {outline && (outline.opening || outline.example || outline.closing) && (
            <div className="w-full max-w-xl rounded-lg border border-sky-900 bg-sky-950/20 px-4 py-3 text-sm text-gray-300">
              <p className="mb-1 text-xs uppercase tracking-wide text-sky-400">Your outline</p>
              {outline.opening && <p>1. {outline.opening}</p>}
              {outline.example && <p>2. {outline.example}</p>}
              {outline.closing && <p>3. {outline.closing}</p>}
            </div>
          )}
          <Timer />
          <Recorder onRecorded={handleRecorded} />
        </>
      )}

      {(stage === 'transcribing' || stage === 'analyzing') && (
        <div className="flex flex-col items-center gap-2 py-8" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-gray-400">
            {stage === 'transcribing' ? 'Transcribing your speech…' : 'Analyzing your answer…'}
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {stage === 'report' && analysis && metrics && (
        <>
          {saveWarning && (
            <div role="alert" className="w-full max-w-2xl rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              {saveWarning}
            </div>
          )}
          {compareTo && <SessionComparison previous={compareTo} currentAnalysis={analysis} currentTranscript={transcript} />}
          <AnalysisReport transcript={transcript} metrics={metrics} analysis={analysis} />
        </>
      )}

      {(stage === 'report' || stage === 'error') && (
        <div className="flex gap-3">
          {stage === 'error' && (
            <button onClick={() => setStage('practice')} className="rounded-md border border-gray-700 px-5 py-2 text-gray-300 hover:bg-gray-800">
              Try again
            </button>
          )}
          <button onClick={onReset} className="rounded-md bg-violet-600 px-5 py-2 text-white hover:bg-violet-500">
            Practice another topic
          </button>
        </div>
      )}
    </div>
  );
}
