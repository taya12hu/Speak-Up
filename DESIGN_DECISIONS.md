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

## 5. Store history in a JSON file, written atomically *(superseded by #16)*

> Superseded when the app became multi-user: history now lives in Supabase Postgres (#16). The entry is kept as a record of the single-user design; the legacy file can be imported with `npm run import:legacy` (#18).

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

**Update for multi-user (#15–#19).** Network position is no longer the main protection: every route except `/api/health` now requires a verified user. The loopback bind and `Sec-Fetch-Site` check remain as defence in depth. Authentication uses a Bearer header rather than cookies, so browsers never attach credentials automatically and classic CSRF does not apply.

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

---

The decisions below were made when Speak Up became a multi-user application.

## 15. Verify Supabase access tokens locally on the API server

**Decision.** `requireAuth` verifies each Bearer token with `jose`: signature, issuer, audience `authenticated`, expiry, `role = authenticated` and a UUID `sub`. Keys come from the project's public JWKS, fetched once and cached; legacy projects can set `SUPABASE_JWT_SECRET` for HS256 instead. The verified `sub` is the only source of the user id.

**Alternatives.**
- Call `supabase.auth.getUser(token)` on every request.
- Trust a user id sent by the client.
- Use session cookies.

**Why.**
- Local verification is cryptographically sound, adds no per-request network round-trip to Supabase, and keeps working while the Auth API is slow. It is also the approach Supabase recommends for asymmetric keys.
- Trusting a client-supplied id would make every other control meaningless.
- Bearer headers (rather than cookies) mean browsers never attach credentials on their own, so CSRF does not apply.

**Trade-off.** Local verification cannot see server-side revocation. After "sign out everywhere" or a password change, an already-issued access token stays valid until it expires (Supabase default: 1 hour). Shorten the JWT expiry in the dashboard, or switch `verifyToken` to `getUser`, if that window is unacceptable. Expired, invalid and unverifiable tokens get distinct codes (`token_expired`, `token_invalid`, `auth_unavailable`), so the client can refresh and retry instead of failing.

## 16. Postgres with Row Level Security, queried with the user's own token

**Decision.** Practice history is the `practice_sessions` table in Supabase Postgres. The API server creates a fresh supabase-js client per request using the **public** publishable key plus the caller's access token. Every query therefore runs as that user, and the RLS policies (`(select auth.uid()) = user_id`) apply to the server's own queries. The repository also filters by `user_id` explicitly.

**Alternatives.**
- Give the server the service-role key and filter by `user_id` in code (RLS would then only protect direct client access).
- Connect with `pg` and set `request.jwt.claims` per transaction.

**Why.**
- With the service-role key, a single missing `where user_id = …` would leak every user's history. With the user's token, Postgres refuses to return other users' rows even if the API code is wrong. This is defence in depth that the integration tests check directly against the database.
- The running server holds no key that bypasses RLS.
- A per-request client means there is no shared mutable state between users.
- supabase-js over PostgREST needs no connection pooling or SQL driver.

**Trade-offs.**
- Each request constructs a small client object, which is negligible next to the network call.
- The publishable key is public, so signed-in users can also reach PostgREST directly. RLS confines them to their own rows, and the check constraints still apply, but they could store unusual (well-formed) sessions in their *own* history.
- The two JSON columns are schemaless beyond the check constraints, which is deliberate (see ARCHITECTURE: data model).

## 17. Least-privilege table grants; immutable sessions; delete as the only mutation

**Decision.**
- All privileges are revoked from `anon` and `authenticated`.
- `authenticated` gets `select`, `delete`, and `insert` on only `user_id, mode, topic, transcript, metrics, analysis`.
- There is no `update` grant or policy.
- The API gained `DELETE /api/sessions/:id`.

**Why.**
- RLS policies say *which rows*; grants say *which operations and columns*. Both are needed so that clients cannot backdate `created_at`, choose ids, or edit past feedback.
- A practice attempt is a historical record, so editing has no product use.
- Users should be able to remove their own data, and deleting the account cascades.
- A delete that matches nothing returns the same 404 whether the row is missing or someone else's, so ids cannot be probed.

## 18. Legacy JSON history is imported explicitly, never assigned automatically

**Decision.** The old `sessions.json` is imported with an operator-run script (`npm run import:legacy`) that:

- requires `--user-id` and checks that the account exists;
- prints the owner's email and dry-runs by default;
- validates records and keeps their ids and dates;
- skips existing ids, so it is idempotent and never re-assigns.

**Alternatives.**
- Assign everything to the first account that signs up.
- An in-app "claim old sessions" button.
- Drop the data.

**Why.** The legacy data has no owner, and any automatic rule would hand one person's practice history to whoever matched the rule. An in-app claim would let any user take it. Only the operator knows whose data it is, so the operator must say so. The script needs the service-role key (it writes rows for another user and sets `created_at`), which is why it is a local tool and not part of the server.

## 19. Require sign-in for every API route, not only history

**Decision.** Everything except `/api/health` sits behind `requireAuth`, including topic generation, vocab, sample answers, analysis and transcription. The whole client UI is behind the sign-in screen.

**Why.**
- In a multi-user deployment the AI routes spend the operator's Gemini quota and the transcription route spends server CPU and disk. Leaving them open would let anyone on the internet use them anonymously.
- Authenticating before multer means unauthenticated uploads are never written to disk.
- Hiding UI is not treated as a control: each endpoint enforces auth itself, and the HTTP tests call every private route without a token.

**Trade-off.** There is no anonymous "try it" mode. Per-user rate limiting is not implemented yet (see TODO).
