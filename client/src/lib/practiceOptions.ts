import type { Difficulty } from '../types';

/** Answer-structuring frameworks taught in Interview Prep. Ids must match INTERVIEW_FRAMEWORKS in server/src/prompts.js. */
export interface Framework {
  id: 'STAR' | 'PREP' | 'PPF' | 'MECE';
  name: string;
  bestFor: string;
  steps: { label: string; detail: string }[];
}

export const FRAMEWORKS: Framework[] = [
  {
    id: 'STAR',
    name: 'STAR',
    bestFor: 'Behavioral questions ("Tell me about a time you...")',
    steps: [
      { label: 'Situation', detail: 'Set the scene — where, when, who was involved.' },
      { label: 'Task', detail: 'What were you responsible for? What was the goal?' },
      { label: 'Action', detail: 'What did you specifically do? Focus on your contribution.' },
      { label: 'Result', detail: 'What happened? Use numbers or concrete outcomes if you can.' },
    ],
  },
  {
    id: 'PREP',
    name: 'PREP',
    bestFor: 'Opinion or persuasion questions ("What do you think about...")',
    steps: [
      { label: 'Point', detail: 'State your main opinion in one clear sentence.' },
      { label: 'Reason', detail: 'Why do you believe that? Give the core justification.' },
      { label: 'Example', detail: 'Back it up with a specific example or evidence.' },
      { label: 'Point', detail: 'Restate your point to close the loop.' },
    ],
  },
  {
    id: 'PPF',
    name: 'PPF',
    bestFor: 'Case/strategy questions ("How would you approach...")',
    steps: [
      { label: 'Past', detail: 'How has this been handled before, or what\'s the current state?' },
      { label: 'Present', detail: 'What\'s the situation right now, and what\'s the core problem?' },
      { label: 'Future', detail: 'What would you do next, and what outcome do you expect?' },
    ],
  },
  {
    id: 'MECE',
    name: 'MECE',
    bestFor: 'Structuring a complex or multi-part answer clearly',
    steps: [
      { label: 'Mutually Exclusive', detail: 'Break your answer into categories that don\'t overlap.' },
      { label: 'Collectively Exhaustive', detail: 'Make sure those categories cover the whole picture, nothing left out.' },
      { label: 'Apply', detail: 'Walk through each category in turn, then summarize.' },
    ],
  },
];

/** Topic categories for Random Topic mode. Ids must match TOPIC_CATEGORIES in server/src/prompts.js. */
export const CATEGORIES = [
  { id: 'general', label: 'General', description: 'Everyday impromptu topics' },
  { id: 'opinion', label: 'Opinion / Persuasion', description: 'Argue a stance, defend a take' },
  { id: 'eli5', label: 'Explain Simply (ELI5)', description: 'Simplify a complex idea for a beginner' },
  { id: 'professional', label: 'Professional / Interview', description: 'Workplace and career scenarios' },
  { id: 'storytelling', label: 'Storytelling', description: 'Narrate a personal experience' },
] as const;

export const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard', 'Random'];
