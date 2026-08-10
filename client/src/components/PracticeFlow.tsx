import { useState } from 'react';
import Timer from './Timer';
import Recorder from './Recorder';
import PrepTimer from './PrepTimer';
import AnalysisReport from './AnalysisReport';
import SessionComparison from './SessionComparison';
import { analyzeSpeech, saveSession, transcribeAudio } from '../lib/api';
import { computeFluencyMetrics } from '../lib/fluency';
import type { AnalysisResult, FluencyMetrics, Mode, OutlineNotes, Session } from '../types';

interface PracticeFlowProps {
  topic: string;
  mode: Mode;
  onReset: () => void;
  compareTo?: Session;
}

type Stage = 'prep' | 'practice' | 'transcribing' | 'analyzing' | 'report' | 'error';

export default function PracticeFlow({ topic, mode, onReset, compareTo }: PracticeFlowProps) {
  const [stage, setStage] = useState<Stage>('prep');
  const [transcript, setTranscript] = useState('');
  const [metrics, setMetrics] = useState<FluencyMetrics | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [outline, setOutline] = useState<OutlineNotes | null>(null);

  const handleRecorded = async (wavBlob: Blob) => {
    setStage('transcribing');
    try {
      const transcribed = await transcribeAudio(wavBlob);
      const computedMetrics = computeFluencyMetrics(transcribed);
      setTranscript(transcribed.text);
      setMetrics(computedMetrics);

      setStage('analyzing');
      const result = await analyzeSpeech({ topic, transcript: transcribed.text, metrics: computedMetrics });
      setAnalysis(result);
      setStage('report');

      await saveSession({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        mode,
        topic,
        transcript: transcribed.text,
        metrics: computedMetrics,
        analysis: result,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong during analysis.');
      setStage('error');
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
          seconds={60}
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
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-gray-400">
            {stage === 'transcribing' ? 'Transcribing your speech…' : 'Analyzing your answer…'}
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{errorMsg}</div>
      )}

      {stage === 'report' && analysis && metrics && (
        <>
          {compareTo && (
            <SessionComparison previous={compareTo} currentAnalysis={analysis} currentTranscript={transcript} />
          )}
          <AnalysisReport transcript={transcript} metrics={metrics} analysis={analysis} />
        </>
      )}

      {(stage === 'report' || stage === 'error') && (
        <button onClick={onReset} className="rounded-md bg-violet-600 px-5 py-2 text-white hover:bg-violet-500">
          Practice another topic
        </button>
      )}
    </div>
  );
}
