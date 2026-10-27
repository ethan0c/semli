-- Finished syllabus reads, so a classmate's identical syllabus reads instantly and costs nothing.
-- Keyed by a SHA-256 of the PDF plus the term, the reader and the prompt version; the file itself
-- is never stored, and nothing here links a read to an account. Only syllabi and course schedules
-- are kept (never work schedules, which can name other people). Rows older than 150 days are
-- ignored by the site and can be pruned. apps/web/lib/syllabus-cache.ts, docs/import-speed.md.
create table public.syllabus_cache (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  detected_type text not null check (detected_type in ('syllabus', 'course_schedule')),
  extraction jsonb not null,
  created_at timestamptz not null default now()
);

-- No policies: only the site's service role reads and writes it.
alter table public.syllabus_cache enable row level security;
revoke all on public.syllabus_cache from anon, authenticated;
