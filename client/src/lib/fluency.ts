import type { FluencyMetrics, StuckLoop, TranscribeResult } from '../types';

const FILLER_PATTERNS: [string, RegExp][] = [
  ['um', /\bum+\b/gi],
  ['uh', /\buh+\b/gi],
  ['erm', /\berm+\b/gi],
  ['hmm', /\bhmm+\b/gi],
  ['like', /\blike\b/gi],
  ['you know', /\byou know\b/gi],
  ['i mean', /\bi mean\b/gi],
  ['sort of', /\bsort of\b/gi],
  ['kind of', /\bkind of\b/gi],
];

const PAUSE_THRESHOLD_SEC = 1.5;

/**
 * Deterministic speaking metrics from the transcript and whisper's near-word-level segments.
 * Computed here rather than by the model so the numbers are exact and reproducible; the
 * analysis prompt is told to use them as given.
 */
export function computeFluencyMetrics(result: TranscribeResult): Required<FluencyMetrics> {
  const fillerBreakdown: Record<string, number> = {};
  let fillerCount = 0;
  for (const [name, pattern] of FILLER_PATTERNS) {
    const matches = result.text.match(pattern);
    if (matches?.length) {
      fillerBreakdown[name] = matches.length;
      fillerCount += matches.length;
    }
  }

  const wordCount = result.text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(result.durationSec / 60, 1 / 60);
  const wpm = Math.round(wordCount / minutes);

  let pauseCount = 0;
  let longestPauseSec = 0;
  let totalPauseSec = 0;
  for (let i = 1; i < result.segments.length; i++) {
    const gap = result.segments[i].start - result.segments[i - 1].end;
    if (gap >= PAUSE_THRESHOLD_SEC) {
      pauseCount++;
      totalPauseSec += gap;
      longestPauseSec = Math.max(longestPauseSec, gap);
    }
  }

  return {
    fillerCount,
    fillerBreakdown,
    wpm,
    pauseCount,
    longestPauseSec: Math.round(longestPauseSec * 10) / 10,
    totalPauseSec: Math.round(totalPauseSec * 10) / 10,
    stuckLoops: detectStuckLoops(result.text),
  };
}

const LOOP_MIN_GRAM = 3;
const LOOP_MAX_GRAM = 7;
const LOOP_PROXIMITY_WORDS = 20;

/**
 * Finds short phrases the speaker repeated close together — the "stuck, searching for the
 * next idea" pattern (e.g. "it's better if you just... it's better if you just...").
 * Greedily matches longer phrases first so a repeated 6-word phrase isn't also reported
 * as several overlapping shorter ones.
 */
function detectStuckLoops(text: string): StuckLoop[] {
  const words = text
    .toLowerCase()
    .replace(/[.,!?"]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const claimed = new Array(words.length).fill(false);
  const found: { phrase: string; occurrences: number; firstIndex: number }[] = [];

  for (let n = LOOP_MAX_GRAM; n >= LOOP_MIN_GRAM; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      if (claimed.slice(i, i + n).some(Boolean)) continue;

      const gram = words.slice(i, i + n).join(' ');
      const positions = [i];
      let j = i + n;
      while (j + n <= words.length && j - (i + n) <= LOOP_PROXIMITY_WORDS) {
        if (!claimed.slice(j, j + n).some(Boolean) && words.slice(j, j + n).join(' ') === gram) {
          positions.push(j);
          j += n;
        } else {
          j++;
        }
      }

      // A short phrase repeating twice can just be natural speech emphasis — only flag it
      // as a "stuck" loop if it repeats 3+ times, or repeats twice but is a long phrase.
      const isRealLoop = positions.length >= 3 || (positions.length >= 2 && n >= 5);
      if (isRealLoop) {
        found.push({ phrase: gram, occurrences: positions.length, firstIndex: i });
        for (const p of positions) for (let k = p; k < p + n; k++) claimed[k] = true;
      }
    }
  }

  return found.sort((a, b) => a.firstIndex - b.firstIndex).map(({ phrase, occurrences }) => ({ phrase, occurrences }));
}
