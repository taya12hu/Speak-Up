// Gemini responseSchema definitions. Passing a schema (not just responseMimeType: json)
// is what actually gets reliable, complete structured output — see lib/ai.js for why.

export const TOPICS_SCHEMA = {
  type: 'ARRAY',
  items: { type: 'STRING' },
};

export const VOCAB_SCHEMA = {
  type: 'OBJECT',
  properties: {
    word: { type: 'STRING' },
    definition: { type: 'STRING' },
    example: { type: 'STRING' },
    speakingAngle: { type: 'STRING' },
  },
  required: ['word', 'definition', 'example', 'speakingAngle'],
};

export const INTERVIEW_SAMPLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sample: { type: 'STRING' },
  },
  required: ['sample'],
};

// Fixed categories (not free text) so grammar issues can be aggregated exactly across
// sessions for weak-point tracking, instead of needing fuzzy text matching later.
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
];

export const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nativeRewrite: { type: 'STRING' },
    grammarIssues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          original: { type: 'STRING' },
          corrected: { type: 'STRING' },
          explanation: { type: 'STRING' },
          category: { type: 'STRING', enum: GRAMMAR_CATEGORIES },
        },
        required: ['original', 'corrected', 'explanation', 'category'],
      },
    },
    pronunciationTips: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phrase: { type: 'STRING' },
          tip: { type: 'STRING' },
        },
        required: ['phrase', 'tip'],
      },
    },
    fluencyCommentary: { type: 'STRING' },
    topicRelevanceNote: { type: 'STRING' },
    ideaDepthNote: { type: 'STRING' },
    stuckPoints: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phrase: { type: 'STRING' },
          suggestion: { type: 'STRING' },
        },
        required: ['phrase', 'suggestion'],
      },
    },
    scores: {
      type: 'OBJECT',
      properties: {
        grammar: { type: 'INTEGER' },
        coherence: { type: 'INTEGER' },
        vocabulary: { type: 'INTEGER' },
        fluency: { type: 'INTEGER' },
        fillerWords: { type: 'INTEGER' },
        confidence: { type: 'INTEGER' },
        topicRelevance: { type: 'INTEGER' },
        ideaDepth: { type: 'INTEGER' },
        overall: { type: 'INTEGER' },
      },
      required: [
        'grammar', 'coherence', 'vocabulary', 'fluency', 'fillerWords',
        'confidence', 'topicRelevance', 'ideaDepth', 'overall',
      ],
    },
    summary: { type: 'STRING' },
  },
  required: [
    'nativeRewrite', 'grammarIssues', 'pronunciationTips', 'fluencyCommentary',
    'topicRelevanceNote', 'ideaDepthNote', 'stuckPoints', 'scores', 'summary',
  ],
};
