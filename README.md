# Speak Up — Personal English Speaking Practice

Impromptu speaking topics + timer + AI feedback on your spoken answers. Built for personal practice, no accounts, no billing — everything runs locally except the two AI API calls (Gemini for text, your local whisper.cpp for transcription).

## How it works

- **Frontend** (`client/`): React + Vite + Tailwind. Timer, topic generator, recorder, report UI.
- **Backend** (`server/`): Express. Proxies Gemini API calls (keeps your API key off the browser), runs whisper.cpp for transcription, stores session history in a local JSON file.
- **Transcription**: `whisper.cpp` runs locally (prebuilt Windows binary, already set up in `whisper/`) — no per-minute cost, audio never leaves your machine.
- **Analysis**: One Gemini API call per practice session, using the free tier of `gemini-2.5-flash`.

## One-time setup

1. **Install dependencies** (from the project root):
   ```
   npm run install:all
   ```

2. **Add your free Gemini API key**:
   - Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with any Google account
   - Click "Create API key" — no credit card, no billing setup, genuinely free (rate-limited, but plenty for personal practice)
   - Open `server/.env` and paste your key:
     ```
     GEMINI_API_KEY=...
     ```

3. **whisper.cpp is already set up** in `whisper/` (prebuilt binary + the `base.en` model, ~150MB). Nothing more to do here. If you ever want better transcription accuracy at the cost of speed, download a larger model (e.g. `ggml-small.en.bin`) from https://huggingface.co/ggerganov/whisper.cpp and point `WHISPER_MODEL_PATH` in `server/.env` at it.

## Running it

```
npm run dev
```

This starts both the backend (`http://localhost:4000`) and frontend (`http://localhost:5173`) together. Open the frontend URL in your browser (Chrome or Edge — microphone recording needs a Chromium-based browser or Firefox, not needed to be any specific one, just needs `MediaRecorder` support, which all modern browsers have).

## Using it

1. Pick a mode: **Random Topic**, **Interview Prep**, or **Vocab**.
2. Configure category/difficulty (Random Topic) or pick a framework (Interview Prep — STAR, PREP, PPF, MECE).
3. Generate topics, pick one, start the timer, hit record, speak.
4. Stop recording — it automatically transcribes and analyzes your answer.
5. Review: transcript, native-speaker rewrite, grammar corrections, pronunciation tips, filler/pacing stats, and 6-dimension scores.
6. Check the **History** tab to see your overall score trend over time.

## Notes

- Everything is stored locally: session history in `server/data/sessions.json`, no cloud storage.
- Pronunciation feedback is text-based (whisper.cpp gives a transcript, not audio-level phonetics), so it flags commonly-tricky words rather than scoring your actual pronunciation. If you want real phoneme-level scoring later, Azure AI Speech's Pronunciation Assessment API has a free tier and could be added as a `server/lib/pronunciation.js` module.
- Multi-language support was intentionally left out — this is English-only, on purpose.
- No cost at all — Gemini's free tier has no billing step, and whisper.cpp/transcription is fully local. The free tier is rate-limited (requests per minute/day), which is a non-issue for one person practicing.

## Project structure

```
client/            React frontend
server/            Express backend
  lib/ai.js        Gemini API wrapper
  lib/whisper.js   Shells out to whisper.cpp for transcription
  data/            Local session history (JSON)
whisper/
  bin/             Prebuilt whisper.cpp Windows binary
  models/          ggml-base.en.bin model
```
