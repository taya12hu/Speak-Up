import { useState } from 'react';
import { describeError, generateTopics } from '../../lib/api';
import { CATEGORIES, DIFFICULTIES } from '../../lib/practiceOptions';
import type { Difficulty } from '../../types';
import PracticeFlow from '../practice/PracticeFlow';

export default function TopicGenerator() {
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState(5);
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const spin = async () => {
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      const result = await generateTopics({ category, difficulty, theme: theme || undefined, count });
      setTopics(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  if (selected) {
    return <PracticeFlow topic={selected} mode="random" onReset={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id} title={c.description}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
        >
          {[3, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n} topics
            </option>
          ))}
        </select>
      </div>

      <input
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="Optional: steer topics toward a theme (e.g. 'career', 'travel')"
        className="w-full max-w-xl rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
      />

      <button
        onClick={spin}
        disabled={loading}
        className="rounded-md bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? 'Spinning…' : 'Spin for topics'}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {topics.length > 0 && (
        <div className="flex w-full max-w-xl flex-col gap-2">
          {topics.map((t, i) => (
            <button
              key={i}
              onClick={() => setSelected(t)}
              className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 text-left text-sm text-gray-200 hover:border-violet-600 hover:bg-gray-900"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
