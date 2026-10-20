begin;

create extension if not exists citext;

create table public.digest_settings (
  id boolean primary key default true check (id),
  panel_threshold integer not null default 4 check (panel_threshold between 1 and 20),
  freshness_backstop_days integer not null default 7 check (freshness_backstop_days between 1 and 31),
  approval_required boolean not null default true check (approval_required),
  delivery_kill_switch boolean not null default true,
  generation_enabled boolean not null default false,
  delivery_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.digest_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number bigint generated always as identity unique,
  slug text not null unique,
  status text not null default 'pending' check (status in ('pending','generating','needs_review','approved','sending','sent','failed')),
  trigger_reason text not null check (trigger_reason in ('panel_threshold','freshness_backstop','manual')),
  title text not null default '',
  deck text not null default '',
  big_picture text not null default '',
  through_line jsonb not null default '[]'::jsonb,
  agreements jsonb not null default '[]'::jsonb,
  tensions jsonb not null default '[]'::jsonb,
  watch_next jsonb not null default '[]'::jsonb,
  reading_minutes integer not null default 1 check (reading_minutes between 1 and 90),
  prompt_version text not null,
  template_version text not null,
  estimated_usd numeric(12,6) not null default 0,
  actual_usd numeric(12,6),
  scheduled_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  sent_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved','sending','sent') or approved_at is not null),
  check (status <> 'sent' or sent_at is not null)
);

create table public.digest_panels (
  id uuid primary key default gen_random_uuid(),
  digest_issue_id uuid not null references public.digest_issues(id) on delete cascade,
  appearance_id uuid not null references public.appearances(id) on delete restrict,
  position integer not null check (position between 1 and 20),
  title text not null,
  source_url text not null check (source_url ~ '^https://'),
  editorial_sections jsonb not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(digest_issue_id, appearance_id),
  unique(digest_issue_id, position),
  check (jsonb_typeof(editorial_sections) = 'array')
);

create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  digest_issue_id uuid references public.digest_issues(id) on delete set null,
  trigger_reason text not null,
  status text not null check (status in ('queued','running','needs_review','complete','failed','blocked','dry-run')),
  selected_appearance_ids uuid[] not null default '{}',
  idempotency_key text not null unique,
  prompt_version text not null,
  model text not null,
  estimated_usd numeric(12,6) not null default 0,
  actual_usd numeric(12,6),
  detail text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  status text not null default 'pending' check (status in ('pending','confirmed','paused','unsubscribed')),
  source text not null,
  confirmation_token_hash text,
  unsubscribe_token_hash text not null,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  digest_issue_id uuid not null references public.digest_issues(id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sending','delivered','bounced','complained','failed','suppressed')),
  provider_message_id text unique,
  idempotency_key text not null unique,
  attempt_count integer not null default 0,
  last_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(digest_issue_id, subscriber_id)
);

create index digest_issues_status_idx on public.digest_issues(status, created_at desc);
create index digest_panels_appearance_idx on public.digest_panels(appearance_id);
create index newsletter_subscribers_status_idx on public.newsletter_subscribers(status);
create index digest_deliveries_queue_idx on public.digest_deliveries(status, created_at) where status in ('queued','failed');

insert into public.digest_settings(id) values(true) on conflict(id) do nothing;

alter table public.digest_settings enable row level security;
alter table public.digest_issues enable row level security;
alter table public.digest_panels enable row level security;
alter table public.digest_runs enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.digest_deliveries enable row level security;

create policy public_sent_digest_read on public.digest_issues for select using(status='sent');
create policy public_sent_digest_panels_read on public.digest_panels for select using(exists(select 1 from public.digest_issues d where d.id=digest_issue_id and d.status='sent'));

create policy admin_digest_settings_all on public.digest_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_digest_issues_all on public.digest_issues for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_digest_panels_all on public.digest_panels for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_digest_runs_all on public.digest_runs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_newsletter_subscribers_all on public.newsletter_subscribers for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_digest_deliveries_all on public.digest_deliveries for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd) values
  ('stage-notes-threshold-scan','realtime','after publication','digest-threshold-scan',false,true,0.50),
  ('stage-notes-freshness-backstop','daily','08:00','digest-freshness-scan',false,true,0.50),
  ('stage-notes-delivery-retry','daily','08:30','digest-delivery-retry',false,true,0.25)
on conflict(id) do nothing;

insert into public.prompt_versions(id,route,model,schema_version,prompt_digest,active) values
  ('digest-v1-four-panel','stage-notes','gemini-2.5-flash-lite','1','configure-after-editorial-evaluation',false)
on conflict(id) do nothing;

commit;
