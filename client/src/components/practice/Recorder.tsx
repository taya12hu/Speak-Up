import { useEffect, useRef, useState } from 'react';
import { blobToWav } from '../../lib/wavEncoder';

interface RecorderProps {
  onRecorded: (wavBlob: Blob) => void;
}

/** Records the microphone with MediaRecorder and hands back a 16 kHz mono WAV for whisper.cpp. */
export default function Recorder({ onRecorded }: RecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError('Microphone access was denied or unavailable.');
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
    setRecording(true);
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        disabled={processing}
        onClick={recording ? stop : start}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition disabled:opacity-40 ${
          recording ? 'animate-pulse bg-red-600 hover:bg-red-500' : 'bg-violet-600 hover:bg-violet-500'
        }`}
      >
        {recording ? '■' : '●'}
      </button>
      <p className="text-sm text-gray-400">
        {processing ? 'Processing audio…' : recording ? 'Recording — click to stop' : 'Click to record your answer'}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
