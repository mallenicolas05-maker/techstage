-- Source coverage is intentionally private operational data. New search hits
-- are not treated as verified publishers until first-party evidence or review.
alter table public.source_registry
  add column if not exists verification_method text,
  add column if not exists verification_evidence jsonb,
  add column if not exists websub_status text not null default 'unsubscribed'
    check (websub_status in ('unsubscribed','pending','active','failed')),
  add column if not exists websub_last_delivery_at timestamptz;

alter table public.discovery_targets
  add column if not exists priority integer not null default 100,
  add column if not exists discovery_intent text not null default 'appearance-gap'
    check (discovery_intent in ('source-coverage','appearance-gap','event-recovery','manual-follow-up')),
  add column if not exists query_cooldown_until timestamptz;
create index if not exists discovery_targets_source_coverage_idx
  on public.discovery_targets (target_kind, status, priority, next_attempt_at);

create table if not exists public.youtube_discovery_query_runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references public.discovery_targets(id) on delete set null,
  intent text not null,
  query text not null,
  resource_type text not null check (resource_type in ('video','channel')),
  result_count integer not null default 0,
  accepted_count integer not null default 0,
  proposed_source_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists youtube_discovery_query_runs_target_idx
  on public.youtube_discovery_query_runs(target_id, created_at desc);

create table if not exists public.manual_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  submitted_url text not null,
  canonical_url text,
  provider text,
  external_id text,
  note text check (length(note) <= 2000),
  transcript_storage_path text,
  transcript_status text not null default 'none' check (transcript_status in ('none','received','processed','purged')),
  status text not null default 'received' check (status in ('received','resolved','queued','duplicate','needs-review','blocked')),
  candidate_id uuid references public.ingestion_candidates(id) on delete set null,
  duplicate_of_candidate_id uuid references public.ingestion_candidates(id) on delete set null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists manual_submissions_user_created_idx on public.manual_submissions(submitted_by, created_at desc);
create unique index if not exists manual_submissions_user_url_uniq
  on public.manual_submissions(submitted_by, submitted_url);

alter table public.youtube_discovery_query_runs enable row level security;
alter table public.manual_submissions enable row level security;
revoke all on public.youtube_discovery_query_runs, public.manual_submissions from public, anon, authenticated;
grant all on public.youtube_discovery_query_runs, public.manual_submissions to service_role;

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd)
values ('youtube-source-coverage','daily','02:30','source-coverage-audit',false,false,0)
on conflict(id) do update set job_kind=excluded.job_kind, paid_operation=false, maximum_usd=0;
