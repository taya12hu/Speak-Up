import { useRef, useState } from 'react';
import { blobToWav } from '../lib/wavEncoder';

interface RecorderProps {
  onRecorded: (wavBlob: Blob) => void;
  disabled?: boolean;
}

export default function Recorder({ onRecorded, disabled }: RecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const wav = await blobToWav(blob);
          onRecorded(wav);
        } catch {
          setError('Could not process the recording. Try again.');
        } finally {
          setProcessing(false);
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Microphone access was denied or unavailable.');
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        disabled={disabled || processing}
        onClick={recording ? stop : start}
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
