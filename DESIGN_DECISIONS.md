# Design Decisions

Each entry records a significant choice, the alternatives that were considered, and the trade-off that was accepted. Entries are short on purpose; [ARCHITECTURE.md](ARCHITECTURE.md) shows how the pieces fit together.

---

## 1. Transcribe locally with whisper.cpp

**Decision.** Speech-to-text runs on the learner's machine through the whisper.cpp CLI with the `base.en` model.

**Alternatives.** Cloud speech-to-text (Google, Azure, OpenAI); sending audio directly to a multimodal Gemini model.

**Why.**
- **Cost and privacy:** this is a free personal tool, and recordings of someone practising a language are personal.
- **Timestamps:** whisper.cpp with `-ml 1` gives near-word-level timestamps, which the pause metrics depend on.

**Trade-offs.**
- A ~150 MB model and a platform-specific binary that must be installed separately.
- CPU-bound latency, a few seconds per minute of audio on a modern laptop.
- No phoneme-level data, so pronunciation feedback is text-based (see #4).

## 2. Structured output with a response schema for every Gemini call

**Decision.** Every call passes a `responseSchema`, not only `responseMimeType: application/json`. Grammar categories are a fixed enum.

**Why.**
- Without a schema, the model's JSON mode occasionally dropped closing braces or duplicated text on long replies.
- The enum means grammar issues can be aggregated exactly across sessions (the "recurring issues" insight) with no fuzzy matching.

**Trade-off.** The schemas in `server/src/schemas.js` must be kept in step with the TypeScript types in `client/src/types.ts` by hand (see #10).

## 3. Measure what can be measured; let the model judge the rest

**Decision.** The client computes the fluency metrics deterministically from whisper's timestamps: filler counts, words per minute, pause statistics and stuck-loop detection. They go into the prompt as fixed facts ("use them, don't recompute"). The model supplies only qualitative judgments and per-dimension scores, and the **server computes the weighted overall score** (`server/src/scoring.js`).

**Alternatives.** Let the model count fillers and compute the weighted average, as an earlier version did.

**Why.**
- LLMs miscount and mis-add.
- The overall score drives the history chart and the comparison deltas, so it must be exact and reproducible.
- Deterministic code can be unit-tested; the model's arithmetic cannot.

**Trade-off.** The weights live in code rather than in the prompt, so changing them is a code change. That is arguably a benefit.

## 4. Text-based pronunciation tips

**Decision.** Pronunciation feedback flags words in the transcript that learners commonly mispronounce, and the report says so.

**Alternative.** A phoneme-level assessment API, such as Azure Speech Pronunciation Assessment.

**Why.** It adds no extra service, key or cost. The limitation is documented rather than hidden, and real phonetic scoring is listed in [TODO.md](TODO.md).

## 5. Store history in a JSON file, written atomically

**Decision.** One `sessions.json` array. Writes go to a temp file and are renamed into place, appends are serialised through an in-process promise queue, and reads **fail closed**: only a missing file counts as empty history.

**Alternatives.** SQLite; a document store; browser `localStorage`.

**Why.**
- A single user produces at most a few sessions a day, so a database would add a native dependency and migrations for no gain.
- The file is human-readable and easy to back up.
- The original implementation treated *any* read error as "no history" and then overwrote the file on the next save. The fail-closed read fixes that data-loss path.

**Trade-offs.**
- Every append rewrites the whole file: O(n) per write, which is fine below thousands of sessions.
- Only one server process can safely write at a time; this is documented in `sessionStore.js`.
- If either limit becomes a problem, SQLite is the natural next step.

## 6. A single origin, no CORS, loopback bind

**Decision.**
- The browser always talks to the API on its own origin: through Vite's `/api` proxy in development, and through Express serving `client/dist` in production.
- The server sends no CORS headers, binds to `127.0.0.1` by default, and rejects cross-site browser requests using `Sec-Fetch-Site`.

**Alternatives.** Keep `cors()` open to all origins (the original setup); allow-list the dev origin.

**Why.** Open CORS on `0.0.0.0` meant any website the user visited, and any device on the same network, could read their practice history and spend their Gemini quota. Same-origin removes the need for CORS entirely, and removes the `cors` dependency with it.

**Trade-off.** The client relies on the proxy, so pointing a separately hosted front end at the API would need explicit CORS configuration. That is not a supported deployment.

## 7. Composition root and dependency-injected routes

**Decision.** `server/src/index.js` builds the config and services, and passes them into `createApp(deps)`. The routers are factories that receive the services they need.

**Alternatives.** Modules that construct their own clients at import time (the original `ai.js` created the Gemini client when imported, which forced `server.js` to use dynamic `await import()` after loading `.env`).

**Why.**
- Import order no longer matters.
- Tests can build the real Express app with stub services, covering validation, status codes and error mapping without network access or the whisper binary.
- No DI container or framework is needed: it is just function arguments.

## 8. Hand-written request validation

**Decision.** Small validators in `server/src/validation.js` (`string`, `integer`, `oneOf`, …) throw `HttpError(400)` with a field-specific message.

**Alternative.** A schema library such as zod.

**Why.** There are six endpoints with flat inputs, and about 60 lines of validators cover them with clear messages and no dependency.

**Trade-off.** Nested payloads are validated shallowly. `POST /sessions` checks the structure the history views rely on, not every nested field (see [TODO.md](TODO.md)). If the API grows, zod would be the better choice.

## 9. Gemini model alias, without a thinking configuration

**Decision.** The default model is the `gemini-flash-lite-latest` alias (overridable with `GEMINI_MODEL`), and requests carry **no** `thinkingConfig`.

**Why.**
- The free tier's daily quota for `flash-latest` is too small for regular practice; `flash-lite` handles schema-constrained output well.
- During this refactor the alias began resolving to `gemini-3.5-flash-lite`, which rejects the `thinkingBudget: 0` setting the app used to send. Every AI call was failing with `400 INVALID_ARGUMENT`.
- The replacement setting, `thinkingLevel`, is rejected by 2.5-series models. Omitting the configuration works on both families, and the flash-lite default spends ~0 thinking tokens (measured).

**Trade-off.** A `-latest` alias can change behaviour without warning, as this incident showed. Pinning a concrete model gives reproducibility but requires manual upgrades; the env var makes that a one-line change.

## 10. Two independent packages, with no shared code module

**Decision.** `client/` and `server/` are separate npm packages, orchestrated by root scripts (`install:all`, `dev`, `test`, `lint`, `check`). Three small constant lists are duplicated, each with a comment pointing at its counterpart: grammar categories, topic-category ids and interview-framework ids.

**Alternatives.** npm workspaces with a `shared/` package.

**Why.**
- The client is TypeScript bundled by Vite and the server is plain Node ESM. Sharing code would need build or path configuration in both, plus a third package, all for about 20 lines of constants.
- Server-side validation turns any drift into an immediate, visible `400` rather than silent misbehaviour.

**Trade-off.** The lists are synchronised by hand. Revisit this if the shared surface grows, for example by generating the TypeScript types from the server schemas.

## 11. Keep sessions from older versions readable without migrating them

**Decision.** Fields added over time are optional in the TypeScript types, and every view treats a missing value as "not available": sections are hidden, and comparisons and insights skip the dimension.

**Alternative.** A one-off migration script that backfills or drops old sessions.

**Why.** No migration infrastructure is needed, the user's real history is never rewritten, and the type system now *forces* every consumer to handle the absent case. Previously the types claimed these fields were always present while the components guarded against their absence.

## 12. Tests: `node:test` for the server, Vitest for the client

**Decision.** The server uses Node's built-in test runner; the client uses Vitest.

**Why.**
- The server is plain ESM, so `node:test` needs no dependency or transpilation.
- Vitest reuses the client's Vite config and handles TypeScript natively.
- HTTP tests use the global `fetch` against an ephemeral port instead of adding supertest.

**Trade-off.** Two runners with slightly different APIs. The root `npm test` runs both.

## 13. Lazy-load the History view

**Decision.** `SessionHistory` is loaded with `React.lazy`.

**Why.** Recharts accounted for most of a 571 kB bundle, which triggered Vite's chunk-size warning, and is only needed on one tab. That is one `Suspense` boundary, with no other build configuration. After the UI redesign (#14) the initial bundle is ~251 kB (78 kB gzipped) and the History chunk ~356 kB.

## 14. Semantic design tokens and in-house UI primitives

**Decision.**
- Colours are defined once in `index.css` as semantic CSS variables (`surface`, `muted`, `accent`, `danger`…), with light and dark values chosen by `prefers-color-scheme`, and exposed to Tailwind through `@theme inline`.
- Screens are composed from about ten small components in `components/ui/`.
- Icons come from `lucide-react`.

**Alternatives.** A component library such as MUI, Chakra or shadcn/ui; keeping per-component Tailwind colour classes, as the original did.

**Why.**
- The original UI repeated colour and spacing class strings in every component and was dark-only.
- Semantic tokens give one place to change the look, and make light and dark mode free for every component, the Recharts chart included (via `var(--accent)` and similar).
- A full component library would add a far larger dependency and styling system than about ten primitives warrant.
- `lucide-react` is tree-shaken, so only the ~35 icons used ship.

**Trade-off.** The primitives are hand-maintained and cover only what this app needs. There is no theme toggle; the theme follows the OS setting.
