import { GRAMMAR_CATEGORIES } from './schemas.js';

// Prompt builders for every Gemini call. User-supplied text is embedded with JSON.stringify so
// quotes or newlines in it cannot break out of the quoted value in the prompt.

/** Topic categories offered by the client (keep ids in sync with client/src/lib/practiceOptions.ts). */
export const TOPIC_CATEGORIES = {
  general: 'General: everyday impromptu topics',
  opinion: 'Opinion / Persuasion: argue a stance, defend a take',
  eli5: 'Explain Simply (ELI5): simplify a complex idea for a beginner',
  professional: 'Professional / Interview: workplace and career scenarios',
  storytelling: 'Storytelling: narrate a personal experience',
};

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Random'];

export const INTERVIEW_FRAMEWORKS = ['STAR', 'PREP', 'PPF', 'MECE'];

export function buildTopicsPrompt({ category, difficulty, theme, count, interview }) {
  const themeLine = theme ? ` Bias the topics toward this theme: ${JSON.stringify(theme)}.` : '';
  const kind = interview
    ? 'behavioral or professional interview questions (things an interviewer would actually ask, e.g. "Tell me about a time you..." or "How would you handle...")'
    : `impromptu speaking topics in the category ${JSON.stringify(TOPIC_CATEGORIES[category])}`;

  return `Generate ${count} ${kind}. Difficulty: ${difficulty}. Each item should be a short phrase or question, under 15 words, suitable for a 1-5 minute spontaneous spoken answer, appropriate for a general adult audience.${themeLine} Return ONLY a JSON array of strings, no numbering, no commentary, no markdown.`;
}

export function buildVocabPrompt() {
  return `Pick one useful English vocabulary word at CEFR level B1-C1 (intermediate to upper-intermediate). Return ONLY a JSON object with keys: "word", "definition" (one line), "example" (one natural example sentence), and "speakingAngle" (a short prompt encouraging the learner to use this word in their own spontaneous sentence about a personal or everyday topic). No markdown, no commentary.`;
}

export function buildInterviewSamplePrompt({ question, framework }) {
  return `Here is an interview question: ${JSON.stringify(question)}. Write a concise sample spoken answer (~150 words) using the ${framework} framework. Label each part of the framework inline (e.g. "Situation: ...") so the learner can see the structure clearly. Return ONLY a JSON object: {"sample": "..."}. No markdown, no commentary.`;
}

export function buildAnalysisPrompt({ topic, transcript, metrics }) {
  const stuckLoops = metrics.stuckLoops ?? [];
  const stuckLoopsLine = stuckLoops.length
    ? `Detected repeated phrases (the speaker said these 3+ times close together, a sign they got stuck searching for their next idea): ${stuckLoops
        .map((l) => `${JSON.stringify(l.phrase)} (repeated ${l.occurrences}x)`)
        .join('; ')}.`
    : 'No repeated stuck-phrases were detected.';

  return `You are an English speaking coach analyzing a learner's spontaneous spoken answer.

Topic: ${JSON.stringify(topic)}
Transcript (verbatim, includes fillers/disfluencies): ${JSON.stringify(transcript)}

Measured stats (already computed, use them, don't recompute): filler word count = ${metrics.fillerCount}, pace = ${metrics.wpm} words per minute, pause count (>1.5s gaps) = ${metrics.pauseCount}, longest pause = ${metrics.longestPauseSec}s, total pause time = ${metrics.totalPauseSec}s. ${stuckLoopsLine}

Produce a JSON object with exactly these keys:
- "nativeRewrite": a fluent, idiomatic, native-English-speaker rewrite of the transcript. Same meaning and roughly same length, no new ideas added.
- "grammarIssues": array (max 5) of {"original", "corrected", "explanation", "category"} — the most important grammar or word-choice issues, quoting the exact original phrase and a short one-sentence rule-based explanation. "category" must be exactly one of: ${GRAMMAR_CATEGORIES.map((c) => `"${c}"`).join(', ')} — pick whichever single category best fits, using "other" only if truly nothing else fits. Empty array if there are none worth flagging.
- "pronunciationTips": array (max 3) of {"phrase", "tip"} — words or phrases in the transcript that learners commonly mispronounce or misstress, with a short actionable tip. Base this only on the text (no audio available), so focus on words that are frequently tricky (e.g. commonly confused stress patterns, silent letters, "th" sounds). Empty array if nothing stands out.
- "fluencyCommentary": one short paragraph (2-3 sentences) commenting on pacing, pauses, and filler word usage using the measured stats above, written directly to the learner ("You...").
- "topicRelevanceNote": one short paragraph (2-3 sentences), written directly to the learner, on how directly and thoroughly they addressed the given topic. Name specifically what they covered, and call out anything that drifted off-topic, dodged the actual question, or stayed too surface-level/generic to clearly be about this topic. Be specific — reference actual content from their answer, not generic advice.
- "ideaDepthNote": one short paragraph (2-3 sentences), written directly to the learner, on the substance and quality of their reasoning — not grammar, not topic relevance, but whether their argument had real depth (specific examples, nuance, considering a counterpoint, concrete reasoning) versus being shallow or generic (vague platitudes, unsupported claims, could-apply-to-anything statements). Be specific — reference actual content from their answer.
- "stuckPoints": array of {"phrase", "suggestion"} — one entry per detected repeated phrase listed above (empty array if none were detected, do not invent any). For each, "phrase" is the exact repeated phrase, and "suggestion" is a short, concrete alternative the learner could say instead in that exact moment — e.g. a natural transition phrase to bridge to their next point ("That said, ..." / "To put it another way, ...") or, if their argument had genuinely run out at that point, a suggestion for what content to add there instead. Never just say "avoid repeating yourself" — always give the actual words or content to use.
- "scores": object with integers 0-100 for "grammar", "coherence", "vocabulary", "fluency", "fillerWords", "confidence", "topicRelevance", and "ideaDepth". For fillerWords: 100 = zero fillers, deduct roughly 5 points per filler per minute of speech. For fluency: consider pace consistency and pause behavior from the stats. For coherence: judge logical flow and structure/transitions between ideas, NOT topic relevance or idea depth (those are scored separately). For topicRelevance: 100 = the answer squarely and thoroughly addresses the given topic throughout; deduct heavily for tangents, dodging the actual question, or answers that could apply to almost any topic. For ideaDepth: 100 = specific, well-reasoned, substantive; deduct heavily for vague platitudes, unsupported generalizations, or answers with no real reasoning behind them.
- "summary": one sentence, encouraging but honest, summarizing the overall performance.

Return ONLY the JSON object. No markdown, no commentary.`;
}
