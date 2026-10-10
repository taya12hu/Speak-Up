import { describe, expect, it } from 'vitest';
import type { TranscribeResult, TranscribeSegment } from '../types';
import { computeFluencyMetrics } from './fluency';

const transcript = (text: string, durationSec = 60, segments: TranscribeSegment[] = []): TranscribeResult => ({
  text,
  durationSec,
  segments,
});

const seg = (start: number, end: number): TranscribeSegment => ({ text: 'w', start, end });

describe('computeFluencyMetrics: fillers', () => {
  it('counts each filler type, case-insensitively', () => {
    const m = computeFluencyMetrics(transcript('Um, so, you know, UH I mean it was umm kind of fine. Hmm. Erm.'));
    expect(m.fillerBreakdown).toEqual({ um: 2, uh: 1, erm: 1, hmm: 1, 'you know': 1, 'i mean': 1, 'kind of': 1 });
    expect(m.fillerCount).toBe(8);
  });

  it('matches whole words only', () => {
    const m = computeFluencyMetrics(transcript('The umbrella was likely humming.'));
    expect(m.fillerCount).toBe(0);
    expect(m.fillerBreakdown).toEqual({});
  });
});

describe('computeFluencyMetrics: pace', () => {
  it('computes words per minute from the audio duration', () => {
    expect(computeFluencyMetrics(transcript('one two three four five six seven eight nine ten', 30)).wpm).toBe(20);
  });

  it('does not divide by zero for zero-length audio', () => {
    expect(computeFluencyMetrics(transcript('hello there', 0)).wpm).toBe(120);
  });

  it('reports zero pace for an empty transcript', () => {
    expect(computeFluencyMetrics(transcript('', 10)).wpm).toBe(0);
  });
});

describe('computeFluencyMetrics: pauses', () => {
  it('counts gaps of at least 1.5s between segments', () => {
    const segments = [seg(0, 1), seg(1.2, 2), seg(3.5, 4), seg(8.04, 9)];
    const m = computeFluencyMetrics(transcript('a b c d', 10, segments));
    expect(m.pauseCount).toBe(2);
    expect(m.longestPauseSec).toBe(4);
    expect(m.totalPauseSec).toBe(5.5);
  });

  it('reports no pauses for fewer than two segments', () => {
    const m = computeFluencyMetrics(transcript('a', 10, [seg(0, 1)]));
    expect(m).toMatchObject({ pauseCount: 0, longestPauseSec: 0, totalPauseSec: 0 });
  });
});

describe('computeFluencyMetrics: stuck loops', () => {
  const loops = (text: string) => computeFluencyMetrics(transcript(text)).stuckLoops;

  it('flags a short phrase repeated three times', () => {
    expect(loops('I think that, I think that. I think that we should go')).toEqual([{ phrase: 'i think that', occurrences: 3 }]);
  });

  it('does not flag a short phrase repeated only twice', () => {
    expect(loops('I think that I think that we should go')).toEqual([]);
  });

  it('flags a long phrase repeated twice', () => {
    expect(loops('we need to go there we need to go there now')).toEqual([{ phrase: 'we need to go there', occurrences: 2 }]);
  });

  it('reports the longest repeated phrase rather than its overlapping sub-phrases', () => {
    const result = loops('it is better if you just it is better if you just it is better if you just stop');
    expect(result).toEqual([{ phrase: 'it is better if you just', occurrences: 3 }]);
  });

  it('ignores repetitions too far apart to be a loop', () => {
    const gap = Array.from({ length: 25 }, (_, i) => `word${i}`).join(' ');
    expect(loops(`and then we ${gap} and then we and then we`)).toEqual([]);
  });

  it('returns loops in order of first appearance', () => {
    const text = 'so what i mean so what i mean so what i mean okay then because of that because of that because of that';
    expect(loops(text).map((l) => l.phrase)).toEqual(['so what i mean', 'because of that']);
  });
});
