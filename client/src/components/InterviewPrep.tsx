import { useState } from 'react';
import { generateInterviewSample, generateTopics } from '../lib/api';
import { FRAMEWORKS, type Framework } from '../lib/frameworks';
import PracticeFlow from './PracticeFlow';

export default function InterviewPrep() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<Framework>(FRAMEWORKS[0]);
  const [sample, setSample] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);

  const loadQuestions = async () => {
    setLoading(true);
    setSelectedQuestion(null);
    setSample(null);
    try {
      const result = await generateTopics({ category: 'professional', difficulty: 'Medium', count: 5, interview: true });
      setQuestions(result);
    } finally {
      setLoading(false);
    }
  };

  const showSample = async () => {
    if (!selectedQuestion) return;
    setSampleLoading(true);
    try {
      const s = await generateInterviewSample(selectedQuestion, selectedFramework.id);
      setSample(s);
    } finally {
      setSampleLoading(false);
    }
  };

  if (practicing && selectedQuestion) {
    return <PracticeFlow topic={selectedQuestion} mode="interview" onReset={() => setPracticing(false)} />;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {FRAMEWORKS.map((fw) => (
          <button
            key={fw.id}
            onClick={() => setSelectedFramework(fw)}
            className={`rounded-lg border p-4 text-left ${
              selectedFramework.id === fw.id ? 'border-violet-600 bg-violet-950/30' : 'border-gray-800 bg-gray-900/50'
            }`}
          >
            <p className="font-medium text-gray-100">{fw.name}</p>
            <p className="mt-1 text-xs text-gray-500">{fw.bestFor}</p>
            {selectedFramework.id === fw.id && (
              <ul className="mt-2 space-y-1 text-xs text-gray-400">
                {fw.steps.map((s) => (
                  <li key={s.label}>
                    <span className="font-medium text-violet-400">{s.label}:</span> {s.detail}
                  </li>
                ))}
              </ul>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={loadQuestions}
        disabled={loading}
        className="rounded-md bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Get interview questions'}
      </button>

      {questions.length > 0 && (
        <div className="flex w-full max-w-2xl flex-col gap-2">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedQuestion(q);
                setSample(null);
              }}
              className={`rounded-lg border px-4 py-3 text-left text-sm ${
                selectedQuestion === q ? 'border-violet-600 bg-gray-900' : 'border-gray-800 bg-gray-900/50 hover:bg-gray-900'
              } text-gray-200`}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {selectedQuestion && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
            <button
              onClick={showSample}
              disabled={sampleLoading}
              className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
              {sampleLoading ? 'Loading…' : `Show me a sample ${selectedFramework.id} answer`}
            </button>
            <button
              onClick={() => setPracticing(true)}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Practice this question
            </button>
          </div>
          {sample && (
            <div className="max-w-xl rounded-lg border border-violet-900 bg-violet-950/20 p-4 text-left text-sm text-gray-200">
              {sample}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
