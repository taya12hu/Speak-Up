/** A practice mode; stored on each session. */
export type PracticeMode = 'random' | 'interview' | 'vocab';

/** A top-level navigation tab: the practice modes plus the history view. */
export type Tab = PracticeMode | 'history';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Random';

export interface TopicRequest {
  category: string;
  difficulty: Difficulty;
  theme?: string;
  count: number;
  interview?: boolean;
}

export interface VocabEntry {
  word: string;
  definition: string;
  example: string;
  speakingAngle: string;
}

// Keep in sync with GRAMMAR_CATEGORIES in server/src/schemas.js (the model is constrained to these).
export const GRAMMAR_CATEGORIES = [
  'verb tense',
  'subject-verb agreement',
  'articles',
  'prepositions',
  'word choice',
  'pluralization',
  'sentence structure',
  'punctuation or contractions',
  'other',
] as const;

export type GrammarCategory = (typeof GRAMMAR_CATEGORIES)[number];

// Fields marked "legacy" are always returned by the current server but are missing from
// sessions saved by earlier versions, which still appear in History.

export interface GrammarIssue {
  original: string;
  corrected: string;
  explanation: string;
  /** Legacy: absent in early sessions. */
  category?: GrammarCategory;
}

export interface PronunciationTip {
  phrase: string;
  tip: string;
}

export interface Scores {
  grammar: number;
  coherence: number;
  vocabulary: number;
  fluency: number;
  fillerWords: number;
  confidence: number;
  /** Legacy: absent in early sessions. */
  topicRelevance?: number;
  /** Legacy: absent in early sessions. */
  ideaDepth?: number;
  /** Weighted average of the dimensions, computed by the server. */
  overall: number;
}

export type ScoreKey = keyof Scores;

export interface StuckPoint {
  phrase: string;
  suggestion: string;
}

export interface AnalysisResult {
  nativeRewrite: string;
  grammarIssues: GrammarIssue[];
  pronunciationTips: PronunciationTip[];
  fluencyCommentary: string;
  /** Legacy: absent in early sessions. */
  topicRelevanceNote?: string;
  /** Legacy: absent in early sessions. */
  ideaDepthNote?: string;
  /** Legacy: absent in early sessions. */
  stuckPoints?: StuckPoint[];
  scores: Scores;
  summary: string;
}

export interface TranscribeSegment {
  text: string;
  start: number;
  end: number;
}

export interface TranscribeResult {
  text: string;
  segments: TranscribeSegment[];
  durationSec: number;
}

export interface StuckLoop {
  phrase: string;
  occurrences: number;
}

export interface FluencyMetrics {
  fillerCount: number;
  fillerBreakdown: Record<string, number>;
  wpm: number;
  pauseCount: number;
  longestPauseSec: number;
  totalPauseSec: number;
  /** Legacy: absent in early sessions. */
  stuckLoops?: StuckLoop[];
}

export interface OutlineNotes {
  opening: string;
  example: string;
  closing: string;
}

/** A practice attempt as submitted by the client; the server adds `id` and `date`. */
export interface NewSession {
  mode: PracticeMode;
  topic: string;
  transcript: string;
  metrics: FluencyMetrics;
  analysis: AnalysisResult;
}

export interface Session extends NewSession {
  id: string;
  date: string;
}
