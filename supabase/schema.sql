-- Proofolio schema. Paste into the Supabase SQL editor and run once. Safe to re-run.
-- Listings are not seeded here: the API loads seed/listings.json into `listings` on every start.

create table if not exists students (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  college         text not null,
  github_username text not null,
  interests       text[] not null default '{}',
  claimed_skills  jsonb not null default '[]',
  claimed_from    text not null check (claimed_from in ('resume', 'chips')),
  created_at      timestamptz not null default now()
);

create table if not exists repo_analyses (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  repo_full_name text not null,
  repo_meta      jsonb,
  build_history  jsonb,
  repo_skills    jsonb,
  files          jsonb,      -- the files we read, with their text, so answers can be scored against the code
  ai_usage       jsonb,      -- tokens and latency, for cost numbers
  created_at     timestamptz not null default now()
);

create table if not exists viva_sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  analysis_id uuid not null references repo_analyses(id) on delete cascade,
  status      text not null default 'in_progress' check (status in ('in_progress', 'done')),
  questions   jsonb not null,  -- includes each rubric, which never leaves the server
  created_at  timestamptz not null default now()
);

create table if not exists viva_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references viva_sessions(id) on delete cascade,
  question_id    text not null,
  is_follow_up   boolean not null default false,
  mode           text not null check (mode in ('voice', 'text')),
  answer_text    text,
  transcript     text,
  duration_s     int,
  pasted         boolean not null default false,
  score          int check (score between 0 and 10),
  covered        jsonb,
  missed         jsonb,
  evidence_quote text,
  follow_up      text,
  ai_usage       jsonb,
  created_at     timestamptz not null default now(),
  unique (session_id, question_id, is_follow_up)   -- a double-click can't record an answer twice
);

create table if not exists listings (
  id              text primary key,
  title           text not null,
  venture         text not null,
  description     text not null,
  required_skills jsonb not null,
  tags            text[] not null default '{}',
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists applications (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  listing_id    text not null references listings(id),
  match         int not null,
  share_consent boolean not null,
  status        text not null default 'applied',
  created_at    timestamptz not null default now(),
  unique (student_id, listing_id)
);

create table if not exists hackathons (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  event          text not null,
  year           int not null check (year between 2000 and 2100),
  result         text not null check (result in ('winner', 'finalist', 'participant')),
  team_size      int not null check (team_size between 1 and 20),
  repo_full_name text not null,   -- verified once the student finishes a viva on this repo
  created_at     timestamptz not null default now()
);

create index if not exists hackathons_student on hackathons (student_id);
create index if not exists repo_analyses_student on repo_analyses (student_id);
create index if not exists viva_sessions_student on viva_sessions (student_id);
create index if not exists viva_answers_session on viva_answers (session_id);
create index if not exists applications_listing on applications (listing_id);
create index if not exists applications_student on applications (student_id);

-- Row level security on, with no policies: the public anon key can read nothing.
-- Only the backend's service-role key (which bypasses RLS) can read or write.
alter table students      enable row level security;
alter table repo_analyses enable row level security;
alter table viva_sessions enable row level security;
alter table viva_answers  enable row level security;
alter table listings      enable row level security;
alter table applications  enable row level security;
alter table hackathons    enable row level security;
