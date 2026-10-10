-- Contract v1.1: hackathon entries. Paste into the Supabase SQL editor and run once. Safe to re-run.
-- A hackathon entry is only a claim until the student finishes a viva on its repo.

create table if not exists hackathons (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  event          text not null,
  year           int not null check (year between 2000 and 2100),
  result         text not null check (result in ('winner', 'finalist', 'participant')),
  team_size      int not null check (team_size between 1 and 20),
  repo_full_name text not null,
  created_at     timestamptz not null default now()
);

create index if not exists hackathons_student on hackathons (student_id);

-- Same rule as every other table: only the backend's service-role key can read or write.
alter table hackathons enable row level security;
