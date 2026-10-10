-- Practice history, one row per completed attempt, owned by a Supabase Auth user.
--
-- Security model:
--   * Row Level Security restricts every read and write to rows whose user_id equals the
--     caller's verified JWT subject (auth.uid()). The API server queries with the user's own
--     token, so RLS applies to the server's queries as well as to any direct client access.
--   * Sessions are immutable: there is deliberately no UPDATE grant or policy.
--   * Column-level INSERT grants stop clients from choosing id or created_at.
--   * The anon role (signed-out callers) has no access at all.

create table public.practice_sessions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  mode        text        not null check (mode in ('random', 'interview', 'vocab')),
  topic       text        not null check (char_length(topic) between 1 and 1000),
  transcript  text        not null check (char_length(transcript) between 1 and 50000),
  metrics     jsonb       not null check (jsonb_typeof(metrics) = 'object'),
  analysis    jsonb       not null check (
                jsonb_typeof(analysis) = 'object'
                and jsonb_typeof(analysis -> 'scores') = 'object'
                and jsonb_typeof(analysis -> 'scores' -> 'overall') = 'number'
                and jsonb_typeof(analysis -> 'grammarIssues') = 'array'
              )
);

comment on table public.practice_sessions is 'Completed speaking-practice attempts; each row is private to its owner (RLS).';
comment on column public.practice_sessions.metrics is 'Client-computed fluency metrics (fillers, pace, pauses, stuck loops).';
comment on column public.practice_sessions.analysis is 'Gemini analysis with server-computed overall score.';

-- History is always listed per user, newest first.
create index practice_sessions_user_id_created_at_idx
  on public.practice_sessions (user_id, created_at desc);

alter table public.practice_sessions enable row level security;

-- (select auth.uid()) is evaluated once per statement instead of once per row.
create policy "Users can read their own practice sessions"
  on public.practice_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create practice sessions for themselves"
  on public.practice_sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own practice sessions"
  on public.practice_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Privileges: start from nothing, then grant exactly what the policies above need.
revoke all on table public.practice_sessions from anon, authenticated;
grant select, delete on table public.practice_sessions to authenticated;
grant insert (user_id, mode, topic, transcript, metrics, analysis) on table public.practice_sessions to authenticated;
