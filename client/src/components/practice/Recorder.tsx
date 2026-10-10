import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { blobToWav } from '../../lib/wavEncoder';
import Alert from '../ui/Alert';
import { Card, CardHeader } from '../ui/Card';
import Spinner from '../ui/Spinner';

interface RecorderProps {
  onRecorded: (wavBlob: Blob) => void;
}

const formatElapsed = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/** Records the microphone with MediaRecorder and hands back a 16 kHz mono WAV for whisper.cpp. */
export default function Recorder({ onRecorded }: RecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Release the microphone if the user navigates away mid-recording.
  useEffect(
    () => () => {
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      releaseMicrophone();
    },
    [],
  );

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [recording]);

  const start = async () => {
    setError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support audio recording.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access was denied or is unavailable. Allow microphone access for this site and try again.');
      return;
    }

    streamRef.current = stream;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      releaseMicrophone();
      setProcessing(true);
      try {
        const wav = await blobToWav(new Blob(chunks, { type: recorder.mimeType }));
        onRecorded(wav);
      } catch {
        setError('Could not process the recording. Try again.');
      } finally {
        setProcessing(false);
      }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setElapsedSec(0);
    setRecording(true);
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const status = processing
    ? 'Preparing audio…'
    : recording
      ? 'Recording — press stop when you have finished'
      : 'Press the button and answer out loud';

  return (
    <Card className="flex flex-col p-5">
      <CardHeader title="Your answer" description="Speak naturally; filler words and pauses are part of the feedback." />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <div className="relative">
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" aria-hidden="true" />}
          <button
            type="button"
            disabled={processing}
            onClick={recording ? stop : start}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            className={`relative flex size-20 items-center justify-center rounded-full text-white shadow-lg transition disabled:opacity-50 ${
              recording ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {processing ? (
              <Spinner className="size-6" />
            ) : recording ? (
              <Square className="size-6 fill-current" aria-hidden="true" />
            ) : (
              <Mic className="size-7" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="text-center" aria-live="polite">
          <p className={`font-mono text-2xl font-medium tabular-nums ${recording ? 'text-danger' : 'text-subtle'}`}>{formatElapsed(elapsedSec)}</p>
          <p className="mt-1 text-sm text-muted">{status}</p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
    </Card>
  );
}
