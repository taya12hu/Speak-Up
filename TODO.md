# TODO

Status of the project after the October 2026 refactor and the multi-user migration. An item is listed under **Completed** only if it was implemented *and* verified; the verification method is given next to each one. Nothing is marked done on the strength of the code alone.

## Completed (verified)

### Correctness and reliability
- [x] **Gemini calls were failing with `400 INVALID_ARGUMENT`.** The `-latest` alias now resolves to `gemini-3.5-flash-lite`, which rejects `thinkingBudget: 0`; that setting has been removed. *Verified with live calls to `/topics`, `/vocab`, `/interview-sample` and `/analyze`; the untouched original code was confirmed to fail the same way.*
- [x] **History could be wiped.** An unreadable or corrupted `sessions.json` used to be treated as empty and then overwritten. Reads now fail closed, writes are atomic, and appends are serialised. *Tests: corrupted-file, concurrent-append and temp-file cleanup cases in `sessionStore.test.js`.* (Superseded by the move to Postgres below; the JSON store and its tests were removed.)
- [x] **A failed history save no longer replaces a finished report** with an error screen; it shows a warning instead. *Implemented in `PracticeFlow`; checked by code review and type-check. No automated UI test.*
- [x] **Overall score** is computed on the server from weighted dimensions instead of by the model, with scores clamped to 0–100. *Tests in `scoring.test.js` and `app.test.js`; a live analysis response matched the weighted average.*
- [x] **Stereo recordings were downmixed by summing channels** (possible clipping). They now go through the standard 1-channel destination downmix. *Type-checked and build-verified. Not exercised with a real stereo microphone (see Pending).*
- [x] **Speaking timer `-30s` could increase the remaining time** when under 30 s. Fixed, and expiry now shows "Restart". *Verified in the browser.*
- [x] **Microphone released on unmount and immediately on stop.** *Code review; the browser pane blocks mic capture, so this was not observed live.*
- [x] **Interview Prep, Vocab and History now show errors** instead of failing silently (History used to show "No sessions yet" when the request failed). *The error messages come from `ApiError` (tested in `api.test.ts`); the rendering was checked by code review only.*
- [x] **Temp uploads are deleted before the response is sent**, including on failure. *Tests in `app.test.js`. A test caught the original ordering bug.*
- [x] **whisper.cpp runs with a timeout**, and a missing binary is reported as a clear `503`. *Tests: `whisper.integration.test.js`.*
- [x] **Silent recordings no longer reach Gemini** when whisper returns an empty transcript, and the server rejects blank transcripts. *The server side is tested in `app.test.js`; the client check was verified by code review only. This does not cover whisper's hallucinated text on silence (see Pending).*

### Security
- [x] **Network exposure locked down:**
  - the server binds to `127.0.0.1` (*verified with `netstat`*);
  - the `cors` dependency is removed and no CORS headers are sent (*verified with a foreign `Origin`*);
  - the client is same-origin through the Vite proxy and Express static serving (*verified in the browser, dev and production*).
- [x] **Cross-site browser requests are rejected** via `Sec-Fetch-Site`. *Tests in `app.test.js`; same-origin browser traffic through the proxy confirmed working.*
- [x] **Input validation on every route**, plus an upload size limit, a UUID upload filename, JSON-escaped prompt interpolation, and generic `500` messages. *Tests: `app.test.js`, `prompts.test.js`.*
- [x] **`npm audit` reports 0 vulnerabilities** in the root, server and client packages (semver-compatible fixes only).

### Structure, tooling and docs
- [x] **Server split into a layered structure:** composition root, app, routes, services, prompts, schemas, validation and scoring.
- [x] **Client components grouped by flow.** Pure logic moved into `lib/`: score tables that were duplicated three times are now in `scores.ts`, Insights logic is in `insights.ts`, and the duplicated timer SVG is the shared `ProgressRing`.
- [x] **Types made honest:** a `PracticeMode`/`Tab` split, and legacy session fields marked optional. *Verified by rendering a real legacy session in History.*
- [x] **Dead code and template leftovers removed.**
- [x] **History lazy-loaded.** *Build verified: the main chunk dropped from 571 kB to 222 kB (251 kB after the UI redesign) and the chunk-size warning is gone.*
- [x] **UI redesign:**
  - semantic light/dark design tokens and shared UI primitives;
  - an app header with a readiness indicator;
  - labelled form fields;
  - a step indicator and recording timer;
  - a redesigned report and History screen.

  *Verified in the browser on every screen up to the microphone prompt: desktop dark mode, and light mode at phone width (375 px) with no horizontal overflow.*
- [x] **Tests added:**
  - server: 57 tests, including a real whisper.cpp integration test;
  - client: 28 tests;
  - lint now fails on warnings;
  - root scripts: `test`, `lint`, `build`, `start`, `check`.
- [x] **Production mode:** `npm start` serves the built client. *Verified in the browser.*
- [x] **Documentation:** README, ARCHITECTURE, DESIGN_DECISIONS, `.env.example` and this file.

### Multi-user (October 2026)

Verified against the owner's real Supabase project (ES256 signing keys) with throwaway test users, which were deleted afterwards. The project was left with no users and no rows.

- [x] **Supabase Auth.**
  - Sign-in, sign-out, persistent session, and the "session expired" path.
  - *Browser:* wrong password → "Incorrect email or password."; sign-in → app; sign-out → sign-in screen with the stored session cleared.
- [x] **Expired and invalid tokens.**
  - *Unit tests:* the real verifier with generated keys; the client's single refresh-and-retry.
  - *Browser, valid refresh token:* a tampered access token → 401 → refresh → retry 200, and the user stays signed in.
  - *Browser, tampered refresh token too:* one 401, no retry loop, local sign-out with "Your session has expired".
- [x] **Every API route except `/api/health` requires a verified token.** *HTTP tests:* each private route returns 401 without a token; unauthenticated uploads never reach the disk.
- [x] **The owner is derived from the token only.** *HTTP tests, plus the real project:* a forged `user_id` in the body is ignored. *Browser:* a save from the signed-in page, sent with a forged `user_id`, was stored under the signed-in user.
- [x] **`practice_sessions` table** with constraints, an index, RLS policies and least-privilege grants (`supabase/migrations/`).
  - *Real project:* B cannot select, insert-as-A or delete A's rows directly in the database (`42501`).
  - Even the owner cannot update (`42501`), and clients cannot set `created_at` (`42501`).
- [x] **History isolation.**
  - *Real project:* A lists only A's sessions; B's list is empty; B's delete of A's session returns 404 and the row survives; concurrent writes from both users stay separate.
  - *Browser:* B's History was empty while A had a private session.
- [x] **Delete a session** (two-step confirm). *Browser:* the row was removed from Postgres.
- [x] **Database failures** return 503 `db_unavailable` (unreachable), a generic 500 (server error), 401 (JWT rejected) or 400 (constraint). *Contract tests* against a local PostgREST stand-in.
- [x] **Explicit-owner legacy import script.** *Unit tests:* planning and validation. *Locally:* all 10 real legacy records plan cleanly. **Not yet run against the database** (see below).
- [x] **Temporary audio is unchanged:** deleted per request, with distinct files for concurrent uploads (HTTP test). No audio is stored permanently.

## In progress

Nothing is currently in progress.

## Pending: not yet verified end-to-end

- [ ] **Full record → transcribe → analyze → save flow in a real browser with a microphone.** The browser pane used for verification blocks microphone capture. Each stage was verified separately instead:
  - real whisper on a generated WAV;
  - live Gemini analysis via the API;
  - authenticated topic generation in the browser;
  - an authenticated save from the browser to Postgres.

  Run one real session before relying on this.
- [ ] **The sign-up flow through the UI.** It was not submitted, to avoid Supabase sending confirmation emails to fake addresses. The form, validation and the "check your email" screen exist; account creation itself was exercised through the Supabase admin API in tests. Sign up once with a real address to confirm the email template and redirect URL.
- [ ] **Legacy import into a real account.** Run `npm run import:legacy --prefix server -- --user-id <your uuid>` (dry run), then add `--apply`.
- [ ] **Stereo-microphone recording** after the downmix change (most built-in microphones are mono).
- [ ] **whisper.cpp setup on macOS and Linux.** The README steps follow upstream's build instructions but were only tested on Windows.

## Pending: known limitations

- [ ] **whisper hallucinates on silence** (e.g. returns "You" for a silent clip). Options: whisper's `--vad` with a Silero VAD model, or a client-side loudness check before upload.
- [ ] **Filler detection is regex-based**, so "like", "kind of" and "sort of" are counted even when used literally ("I like dogs"). Context-aware detection would need part-of-speech tagging or the model.
- [ ] **Pronunciation tips are inferred from text**, not audio. Real assessment needs a phoneme-level service such as Azure Pronunciation Assessment.
- [ ] **Vocab words can repeat**: each request is independent. The server could pass recently used words in the prompt.
- [ ] **No retry or backoff for Gemini `429`/`5xx`.** The user sees a clear message and must retry by hand.
- [ ] **Sessions can be deleted but not exported**, and there is no in-app account deletion. Deleting a user in the Supabase dashboard cascades to their sessions.
- [ ] **Signed-out tokens stay valid until they expire.** Verification is local (DESIGN_DECISIONS #15), so "sign out everywhere" or a password change only takes effect at token expiry (default 1 h).
- [ ] **No password reset, email change or OAuth providers** in the UI. Supabase supports all of them; only email + password sign-in and sign-up are wired up.
- [ ] **No per-user rate limiting.** A signed-in user can call the AI routes as fast as Gemini's quota allows.
- [ ] **Signed-in users can write to their own rows directly** via PostgREST, using the public key and their token, bypassing Express validation. RLS and the check constraints still confine this to well-formed rows in their *own* history.
- [ ] **Supabase's default email sender is heavily rate-limited** and only for development. Configure custom SMTP before real users sign up.
- [ ] **Prep time is fixed at 60 s**, and the speaking timer does not stop the recording when it expires (by design; could be an option).

## Pending: technical debt

- [ ] **No automated tests for React components or end-to-end browser flows.** React Testing Library for `PracticeFlow`'s state machine and a Playwright smoke test are the most valuable next tests.
- [ ] **No CI workflow.** `npm run check` is the intended CI entry point, but no pipeline was added because it could not be run from here.
- [ ] **Constants duplicated between client and server** (grammar categories, topic-category ids, framework ids). Drift is caught at runtime by validation, not at build time. See DESIGN_DECISIONS #10.
- [ ] **`POST /sessions` validates the payload shallowly** (top-level fields, `scores.overall`, `grammarIssues`), not every nested field.
- [ ] **An unreachable database takes ~7 s to report.** supabase-js retries network failures with backoff. A shorter fetch timeout would fail faster.
- [ ] **The real-project test suite is opt-in** (`RUN_SUPABASE_TESTS=1`) and needs a service-role key, so it would only run in CI if a dedicated test project and secret were configured.
- [ ] **Orphaned uploads in `data/tmp/`**, left if the process is killed mid-transcription, are never swept at startup.
- [ ] **The `gemini-flash-lite-latest` alias can change behaviour without notice** (it already has once). Consider pinning a concrete model in `GEMINI_MODEL`.
- [ ] **No code formatter** (Prettier or similar) is configured; style is consistent by convention only.
- [ ] **Accessibility is only partial:**
  - in place: labelled form fields, ARIA labels on the recorder, timers, meters, alerts, radio groups and navigation, and visible focus rings;
  - missing: a full audit (keyboard flow, colour contrast in both themes, screen reader).
- [ ] **No manual theme toggle**: the theme always follows the OS setting.
