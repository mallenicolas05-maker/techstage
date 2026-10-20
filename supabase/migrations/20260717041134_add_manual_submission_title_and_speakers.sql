alter table public.manual_submissions
  add column if not exists title text check (length(title) <= 500),
  add column if not exists speaker_names text[] not null default '{}'::text[]
    check (cardinality(speaker_names) <= 20);
