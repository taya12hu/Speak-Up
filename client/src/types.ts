export type Mode = 'random' | 'interview' | 'vocab' | 'history';

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

export interface FrameworkId {
  id: 'STAR' | 'PREP' | 'PPF' | 'MECE';
}

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

export interface GrammarIssue {
  original: string;
  corrected: string;
  explanation: string;
  category: GrammarCategory;
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
  topicRelevance: number;
  ideaDepth: number;
  overall: number;
}

export interface StuckPoint {
  phrase: string;
  suggestion: string;
}

export interface AnalysisResult {
  nativeRewrite: string;
  grammarIssues: GrammarIssue[];
  pronunciationTips: PronunciationTip[];
  fluencyCommentary: string;
  topicRelevanceNote: string;
  ideaDepthNote: string;
  stuckPoints: StuckPoint[];
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
  stuckLoops: StuckLoop[];
}

export interface OutlineNotes {
  opening: string;
  example: string;
  closing: string;
}

export interface Session {
  id: string;
  date: string;
  mode: Mode;
  topic: string;
  transcript: string;
  metrics: FluencyMetrics;
  analysis: AnalysisResult;
}
