import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { OutlineNotes } from '../../types';
import Button from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Field, TextInput } from '../ui/Field';
import ProgressRing from './ProgressRing';

interface PrepTimerProps {
  seconds?: number;
  onDone: (outline: OutlineNotes) => void;
}

const EMPTY_OUTLINE: OutlineNotes = { opening: '', example: '', closing: '' };

const OUTLINE_FIELDS: { key: keyof OutlineNotes; label: string; placeholder: string }[] = [
  { key: 'opening', label: 'Opening point', placeholder: 'Your main answer in one line' },
  { key: 'example', label: 'Example or reason', placeholder: 'A specific example to back it up' },
  { key: 'closing', label: 'Closing point', placeholder: 'How you will wrap up' },
];

/** Planning countdown with optional outline notes; hands the notes over when time is up or the user skips. */
export default function PrepTimer({ seconds = 60, onDone }: PrepTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [outline, setOutline] = useState<OutlineNotes>(EMPTY_OUTLINE);
  const outlineRef = useRef(outline);
  outlineRef.current = outline;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (remaining <= 0) {
      onDoneRef.current(outlineRef.current);
      return;
    }
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  const setField = (field: keyof OutlineNotes) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setOutline((o) => ({ ...o, [field]: e.target.value }));

  return (
    <Card className="p-6">
      <CardHeader title="Plan your answer" description="Use this minute to organise your thoughts. Notes are for you only and are not graded." />

      <div className="mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <ProgressRing remainingSec={remaining} totalSec={seconds} tone="info" className="mx-auto size-36 text-2xl" />

        <div className="flex flex-col gap-3">
          {OUTLINE_FIELDS.map(({ key, label, placeholder }) => (
            <Field key={key} label={label}>
              {(id) => <TextInput id={id} value={outline[key]} onChange={setField(key)} placeholder={placeholder} />}
            </Field>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end border-t border-line pt-4">
        <Button onClick={() => setRemaining(0)} icon={<ArrowRight className="size-4" />}>
          I'm ready to speak
        </Button>
      </div>
    </Card>
  );
}
