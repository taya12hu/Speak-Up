import { config as loadEnv } from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFile, writeFile, mkdir, rm, rename } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '.env') });

const { askJSON, MODEL_FAST, MODEL_SMART } = await import('./lib/ai.js');
const { transcribeWav } = await import('./lib/whisper.js');
const { TOPICS_SCHEMA, VOCAB_SCHEMA, INTERVIEW_SAMPLE_SCHEMA, ANALYSIS_SCHEMA, GRAMMAR_CATEGORIES } = await import('./lib/schemas.js');

const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const TMP_DIR = path.join(DATA_DIR, 'tmp');

await mkdir(TMP_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
const upload = multer({ dest: TMP_DIR });

if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not set. AI features will fail until you add it to server/.env');
}

// ---- Topic generation ----
app.post('/api/topics', async (req, res) => {
  try {
    const { category = 'general', difficulty = 'Medium', theme, count = 5, interview = false } = req.body;
    const themeLine = theme ? ` Bias the topics toward this theme: "${theme}".` : '';
    const kind = interview
      ? 'behavioral or professional interview questions (things an interviewer would actually ask, e.g. "Tell me about a time you..." or "How would you handle...")'
      : `impromptu speaking topics in the "${category}" category`;

    const prompt = `Generate ${count} ${kind}. Difficulty: ${difficulty}. Each item should be a short phrase or question, under 15 words, suitable for a 1-5 minute spontaneous spoken answer, appropriate for a general adult audience.${themeLine} Return ONLY a JSON array of strings, no numbering, no commentary, no markdown.`;

    const topics = await askJSON({ model: MODEL_FAST, prompt, schema: TOPICS_SCHEMA, maxTokens: 512 });
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// ---- Vocab ----
app.post('/api/vocab', async (_req, res) => {
  try {
    const prompt = `Pick one useful English vocabulary word at CEFR level B1-C1 (intermediate to upper-intermediate), not one you've picked before in this conversation. Return ONLY a JSON object with keys: "word", "definition" (one line), "example" (one natural example sentence), and "speakingAngle" (a short prompt encouraging the learner to use this word in their own spontaneous sentence about a personal or everyday topic). No markdown, no commentary.`;
    const entry = await askJSON({ model: MODEL_FAST, prompt, schema: VOCAB_SCHEMA, maxTokens: 300 });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// ---- Interview sample answer ----
app.post('/api/interview-sample', async (req, res) => {
  try {
    const { question, framework } = req.body;
    const prompt = `Here is an interview question: "${question}". Write a concise sample spoken answer (~150 words) using the ${framework} framework. Label each part of the framework inline (e.g. "Situation: ...") so the learner can see the structure clearly. Return ONLY a JSON object: {"sample": "..."}. No markdown, no commentary.`;
    const result = await askJSON({ model: MODEL_FAST, prompt, schema: INTERVIEW_SAMPLE_SCHEMA, maxTokens: 500 });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// ---- Transcription ----
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const uploadedPath = req.file?.path;
  const wavPath = uploadedPath ? `${uploadedPath}.wav` : null;
  try {
    if (!uploadedPath) return res.status(400).json({ error: 'No audio file uploaded' });
    await rename(uploadedPath, wavPath);
    const result = await transcribeWav(wavPath);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  } finally {
    if (uploadedPath) await rm(uploadedPath, { force: true }).catch(() => {});
    if (wavPath) await rm(wavPath, { force: true }).catch(() => {});
  }
});

// ---- Combined analysis: native rewrite + grammar + pronunciation + scoring ----
app.post('/api/analyze', async (req, res) => {
  try {
    const { topic, transcript, metrics } = req.body;
    const prompt = buildAnalysisPrompt(topic, transcript, metrics);
    const result = await askJSON({ model: MODEL_SMART, prompt, schema: ANALYSIS_SCHEMA, maxTokens: 3000 });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

function buildAnalysisPrompt(topic, transcript, metrics) {
  const stuckLoops = metrics.stuckLoops ?? [];
  const stuckLoopsLine = stuckLoops.length
    ? `Detected repeated phrases (the speaker said these 3+ times close together, a sign they got stuck searching for their next idea): ${stuckLoops
        .map((l) => `"${l.phrase}" (repeated ${l.occurrences}x)`)
        .join('; ')}.`
    : 'No repeated stuck-phrases were detected.';

  return `You are an English speaking coach analyzing a learner's spontaneous spoken answer.

Topic: "${topic}"
Transcript (verbatim, includes fillers/disfluencies): "${transcript}"

Measured stats (already computed, use them, don't recompute): filler word count = ${metrics.fillerCount}, pace = ${metrics.wpm} words per minute, pause count (>1.5s gaps) = ${metrics.pauseCount}, longest pause = ${metrics.longestPauseSec}s, total pause time = ${metrics.totalPauseSec}s. ${stuckLoopsLine}

Produce a JSON object with exactly these keys:
- "nativeRewrite": a fluent, idiomatic, native-English-speaker rewrite of the transcript. Same meaning and roughly same length, no new ideas added.
- "grammarIssues": array (max 5) of {"original", "corrected", "explanation", "category"} — the most important grammar or word-choice issues, quoting the exact original phrase and a short one-sentence rule-based explanation. "category" must be exactly one of: ${GRAMMAR_CATEGORIES.map((c) => `"${c}"`).join(', ')} — pick whichever single category best fits, using "other" only if truly nothing else fits. Empty array if there are none worth flagging.
- "pronunciationTips": array (max 3) of {"phrase", "tip"} — words or phrases in the transcript that learners commonly mispronounce or misstress, with a short actionable tip. Base this only on the text (no audio available), so focus on words that are frequently tricky (e.g. commonly confused stress patterns, silent letters, "th" sounds). Empty array if nothing stands out.
- "fluencyCommentary": one short paragraph (2-3 sentences) commenting on pacing, pauses, and filler word usage using the measured stats above, written directly to the learner ("You...").
- "topicRelevanceNote": one short paragraph (2-3 sentences), written directly to the learner, on how directly and thoroughly they addressed the given topic. Name specifically what they covered, and call out anything that drifted off-topic, dodged the actual question, or stayed too surface-level/generic to clearly be about this topic. Be specific — reference actual content from their answer, not generic advice.
- "ideaDepthNote": one short paragraph (2-3 sentences), written directly to the learner, on the substance and quality of their reasoning — not grammar, not topic relevance, but whether their argument had real depth (specific examples, nuance, considering a counterpoint, concrete reasoning) versus being shallow or generic (vague platitudes, unsupported claims, could-apply-to-anything statements). Be specific — reference actual content from their answer.
- "stuckPoints": array of {"phrase", "suggestion"} — one entry per detected repeated phrase listed above (empty array if none were detected, do not invent any). For each, "phrase" is the exact repeated phrase, and "suggestion" is a short, concrete alternative the learner could say instead in that exact moment — e.g. a natural transition phrase to bridge to their next point ("That said, ..." / "To put it another way, ...") or, if their argument had genuinely run out at that point, a suggestion for what content to add there instead. Never just say "avoid repeating yourself" — always give the actual words or content to use.
- "scores": object with integers 0-100 for "grammar", "coherence", "vocabulary", "fluency", "fillerWords", "confidence", "topicRelevance", "ideaDepth", and "overall" (weighted average: grammar 15%, coherence 10%, vocabulary 10%, fluency 15%, fillerWords 10%, confidence 10%, topicRelevance 15%, ideaDepth 15%, rounded to nearest integer). For fillerWords: 100 = zero fillers, deduct roughly 5 points per filler per minute of speech. For fluency: consider pace consistency and pause behavior from the stats. For coherence: judge logical flow and structure/transitions between ideas, NOT topic relevance or idea depth (those are scored separately). For topicRelevance: 100 = the answer squarely and thoroughly addresses the given topic throughout; deduct heavily for tangents, dodging the actual question, or answers that could apply to almost any topic. For ideaDepth: 100 = specific, well-reasoned, substantive; deduct heavily for vague platitudes, unsupported generalizations, or answers with no real reasoning behind them.
- "summary": one sentence, encouraging but honest, summarizing the overall performance.

Return ONLY the JSON object. No markdown, no commentary.`;
}

// ---- Session history (local JSON file, no cloud) ----
async function loadSessions() {
  try {
    return JSON.parse(await readFile(SESSIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

app.get('/api/sessions', async (_req, res) => {
  const sessions = await loadSessions();
  res.json(sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)));
});

app.post('/api/sessions', async (req, res) => {
  const sessions = await loadSessions();
  sessions.push(req.body);
  await writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
