import { useState } from 'react';
import { generateVocab } from '../lib/api';
import type { VocabEntry } from '../types';
import PracticeFlow from './PracticeFlow';

export default function VocabMode() {
  const [entry, setEntry] = useState<VocabEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);

  const next = async () => {
    setLoading(true);
    setPracticing(false);
    try {
      setEntry(await generateVocab());
    } finally {
      setLoading(false);
    }
  };

  if (practicing && entry) {
    return (
      <PracticeFlow
        topic={`Use the word "${entry.word}": ${entry.speakingAngle}`}
        mode="vocab"
        onReset={() => setPracticing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={next}
        disabled={loading}
        className="rounded-md bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? 'Loading…' : entry ? 'Next word' : 'Get a word'}
      </button>

      {entry && (
        <div className="w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-left">
          <p className="text-2xl font-medium text-violet-300">{entry.word}</p>
          <p className="mt-1 text-sm text-gray-400">{entry.definition}</p>
          <p className="mt-3 text-sm italic text-gray-300">"{entry.example}"</p>
          <div className="mt-4 rounded-lg bg-violet-950/30 p-3 text-sm text-gray-200">
            <span className="font-medium text-violet-400">Speaking angle: </span>
            {entry.speakingAngle}
          </div>
          <button
            onClick={() => setPracticing(true)}
            className="mt-4 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Practice using this word
          </button>
        </div>
      )}
    </div>
  );
}
