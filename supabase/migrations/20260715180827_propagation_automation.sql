begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;
grant usage on schema internal to authenticated, service_role;

create table if not exists public.provider_budget_groups (
  id text primary key,
  period text not null default 'month' check (period = 'month'),
  hard_limit_usd numeric(18,9) not null check (hard_limit_usd >= 0),
  reserved_usd numeric(18,9) not null default 0 check (reserved_usd >= 0),
  actual_usd numeric(18,9) not null default 0 check (actual_usd >= 0),
  resets_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_reservations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  provider text not null,
  budget_group_id text references public.provider_budget_groups(id),
  reserved_usd numeric(18,9) not null default 0 check (reserved_usd >= 0),
  actual_usd numeric(18,9),
  reserved_requests integer not null default 0 check (reserved_requests >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  status text not null default 'reserved' check (status in ('reserved','reconciled','released')),
  created_at timestamptz not null default now(),
  reconciled_at timestamptz
);

create table if not exists public.provider_runtime_controls (
  provider text primary key,
  discovery_enabled boolean not null default false,
  analysis_enabled boolean not null default false,
  delivery_enabled boolean not null default false,
  dry_run boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.backfill_manifest (
  appearance_slug text primary key,
  title text not null,
  description text not null,
  occurred_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  appearance_type text not null,
  source_url text not null check (source_url ~ '^https://'),
  source_provider text not null,
  channel_name text not null,
  speaker_slugs text[] not null default '{}',
  company_slugs text[] not null default '{}',
  event_slug text,
  topic_slugs text[] not null default '{}',
  transcript_hint boolean not null default false,
  source_fingerprint text not null unique,
  selected_route text not null check (selected_route in ('pasted-transcript','youtube-video','x-video')),
  status text not null default 'planned' check (status in ('planned','queued','resolved','analyzed','published','blocked')),
  canonical_media_url text,
  canonical_provider text,
  projected_usd numeric(18,9),
  block_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discovery_runs add column if not exists configuration jsonb not null default '{}'::jsonb;
alter table public.discovery_runs add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;
alter table public.discovery_runs add column if not exists connector_provenance jsonb not null default '[]'::jsonb;
alter table public.ingestion_candidates add column if not exists discovery_run_id uuid references public.discovery_runs(id) on delete set null;
alter table public.ingestion_candidates add column if not exists appearance_slug text;
alter table public.ingestion_candidates add column if not exists manifest_payload jsonb not null default '{}'::jsonb;
alter table public.pipeline_stage_runs add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0);
alter table public.pipeline_stage_runs add column if not exists estimated_usd numeric(18,9);
alter table public.pipeline_stage_runs add column if not exists actual_usd numeric(18,9);
alter table public.pipeline_stage_runs add column if not exists provider_usage_id uuid references public.provider_usage(id) on delete set null;
alter table public.provider_usage add column if not exists discovery_run_id uuid references public.discovery_runs(id) on delete set null;
alter table public.provider_usage add column if not exists candidate_id uuid references public.ingestion_candidates(id) on delete set null;
alter table public.provider_usage add column if not exists model text;
alter table public.provider_usage add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0);
alter table public.provider_usage add column if not exists response_status integer;
alter table public.provider_usage add column if not exists usage_detail jsonb not null default '{}'::jsonb;
alter table public.provider_usage add column if not exists connector text not null default 'api';
alter table public.analysis_artifacts add column if not exists provider_usage_id uuid references public.provider_usage(id) on delete set null;
alter table public.analysis_artifacts add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0);
alter table public.media_sources add column if not exists embed_url text;
alter table public.media_sources add column if not exists title text;
alter table public.media_sources add column if not exists channel_name text;
alter table public.media_sources add column if not exists thumbnail_url text;
alter table public.media_sources add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds >= 0);
alter table public.media_sources add column if not exists published_at timestamptz;
alter table public.job_schedules add column if not exists timezone text not null default 'America/Chicago';

create table if not exists internal.token_hashes (
  name text primary key,
  token_hash bytea not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
revoke all on internal.token_hashes from public, anon, authenticated;

create or replace function internal.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
create or replace function internal.has_entitlement(required_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.entitlements e where e.user_id = auth.uid() and e.key = required_key and e.enabled and (e.expires_at is null or e.expires_at > now()));
$$;
revoke all on function internal.is_admin() from public, anon;
revoke all on function internal.has_entitlement(text) from public, anon;
grant execute on function internal.is_admin() to authenticated, service_role;
grant execute on function internal.has_entitlement(text) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$ select internal.is_admin(); $$;
create or replace function public.has_entitlement(required_key text)
returns boolean language sql stable security invoker set search_path = '' as $$ select internal.has_entitlement(required_key); $$;

do $$
declare generated_token text;
begin
  if not exists(select 1 from internal.token_hashes where name='job-runner') then
    generated_token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into internal.token_hashes(name,token_hash) values('job-runner',extensions.digest(generated_token,'sha256'));
    perform vault.create_secret(generated_token,'techstage_job_runner','Internal job runner token');
  end if;
  if not exists(select 1 from vault.secrets where name='techstage_project_url') then
    perform vault.create_secret('https://zckeerbajtwpqcvqpwru.supabase.co','techstage_project_url','TechStage development project URL');
  end if;
end $$;

create or replace function public.verify_internal_token(token_name text, presented_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select presented_token is not null and exists(
    select 1 from internal.token_hashes
    where name=token_name and token_hash=extensions.digest(presented_token,'sha256')
  );
$$;
revoke all on function public.verify_internal_token(text,text) from public, anon, authenticated;
grant execute on function public.verify_internal_token(text,text) to service_role;

create or replace function public.reserve_provider_budget_v2(
  requested_provider text,
  requested_group text,
  reservation_key text,
  maximum_usd numeric default 0,
  requested_requests integer default 0,
  requested_credits integer default 0
) returns public.budget_reservations
language plpgsql security definer set search_path = '' as $$
declare route_budget public.cost_budgets;
declare group_budget public.provider_budget_groups;
declare reservation public.budget_reservations;
begin
  select * into reservation from public.budget_reservations where idempotency_key=reservation_key;
  if found then return reservation; end if;

  select * into route_budget from public.cost_budgets
  where provider=requested_provider and period='month' and resets_at>now()
  order by resets_at limit 1 for update;
  if not found then raise exception 'provider budget missing'; end if;
  if route_budget.hard_limit_usd is not null and maximum_usd>route_budget.hard_limit_usd then raise exception 'route dollar budget exceeded'; end if;
  if route_budget.hard_request_limit is not null and route_budget.used_requests+requested_requests>route_budget.hard_request_limit then raise exception 'provider request budget exceeded'; end if;
  if route_budget.hard_credit_limit is not null and route_budget.used_credits+requested_credits>route_budget.hard_credit_limit then raise exception 'provider credit budget exceeded'; end if;

  if requested_group is not null then
    select * into group_budget from public.provider_budget_groups
    where id=requested_group and resets_at>now() for update;
    if not found then raise exception 'provider group budget missing'; end if;
    if group_budget.actual_usd+group_budget.reserved_usd+maximum_usd>group_budget.hard_limit_usd then raise exception 'provider group dollar budget exceeded'; end if;
    update public.provider_budget_groups set reserved_usd=reserved_usd+maximum_usd,updated_at=now() where id=requested_group;
  elsif maximum_usd>0 then
    raise exception 'paid call requires budget group';
  end if;

  update public.cost_budgets set used_requests=used_requests+requested_requests,used_credits=used_credits+requested_credits,updated_at=now()
  where id=route_budget.id;

  insert into public.budget_reservations(idempotency_key,provider,budget_group_id,reserved_usd,reserved_requests,reserved_credits)
  values(reservation_key,requested_provider,requested_group,maximum_usd,requested_requests,requested_credits)
  returning * into reservation;
  return reservation;
end $$;

create or replace function public.reconcile_provider_budget(reservation_uuid uuid, charged_usd numeric)
returns public.budget_reservations
language plpgsql security definer set search_path = '' as $$
declare reservation public.budget_reservations;
begin
  if charged_usd<0 then raise exception 'actual cost cannot be negative'; end if;
  select * into reservation from public.budget_reservations where id=reservation_uuid for update;
  if not found then raise exception 'reservation missing'; end if;
  if reservation.status='reconciled' then return reservation; end if;
  if charged_usd>reservation.reserved_usd then raise exception 'actual cost exceeds reserved maximum'; end if;
  if reservation.budget_group_id is not null then
    update public.provider_budget_groups
    set reserved_usd=greatest(0,reserved_usd-reservation.reserved_usd),
        actual_usd=actual_usd+charged_usd,updated_at=now()
    where id=reservation.budget_group_id;
  end if;
  update public.cost_budgets set used_usd=used_usd+charged_usd,updated_at=now()
  where provider=reservation.provider and period='month' and resets_at>now();
  update public.budget_reservations set actual_usd=charged_usd,status='reconciled',reconciled_at=now()
  where id=reservation_uuid returning * into reservation;
  return reservation;
end $$;

create or replace function public.release_provider_budget(reservation_uuid uuid)
returns public.budget_reservations
language plpgsql security definer set search_path = '' as $$
declare reservation public.budget_reservations;
begin
  select * into reservation from public.budget_reservations where id=reservation_uuid for update;
  if not found then raise exception 'reservation missing'; end if;
  if reservation.status<>'reserved' then return reservation; end if;
  if reservation.budget_group_id is not null then
    update public.provider_budget_groups set reserved_usd=greatest(0,reserved_usd-reservation.reserved_usd),updated_at=now()
    where id=reservation.budget_group_id;
  end if;
  update public.cost_budgets
  set used_requests=greatest(0,used_requests-reservation.reserved_requests),
      used_credits=greatest(0,used_credits-reservation.reserved_credits),updated_at=now()
  where provider=reservation.provider and period='month' and resets_at>now();
  update public.budget_reservations set status='released',actual_usd=0,reconciled_at=now()
  where id=reservation_uuid returning * into reservation;
  return reservation;
end $$;

revoke all on function public.reserve_provider_budget_v2(text,text,text,numeric,integer,integer) from public,anon,authenticated;
revoke all on function public.reconcile_provider_budget(uuid,numeric) from public,anon,authenticated;
revoke all on function public.release_provider_budget(uuid) from public,anon,authenticated;
grant execute on function public.reserve_provider_budget_v2(text,text,text,numeric,integer,integer) to service_role;
grant execute on function public.reconcile_provider_budget(uuid,numeric) to service_role;
grant execute on function public.release_provider_budget(uuid) to service_role;

insert into public.provider_budget_groups(id,hard_limit_usd,resets_at) values
  ('gemini',5,date_trunc('month',now())+interval '1 month'),
  ('xai',5,date_trunc('month',now())+interval '1 month')
on conflict(id) do update set hard_limit_usd=excluded.hard_limit_usd,resets_at=excluded.resets_at;

insert into public.cost_budgets(provider,period,hard_limit_usd,hard_request_limit,hard_credit_limit,resets_at) values
  ('gemini-text','month',5,null,null,date_trunc('month',now())+interval '1 month'),
  ('gemini-youtube-video','month',5,null,null,date_trunc('month',now())+interval '1 month'),
  ('gemini-stage-notes','month',5,null,null,date_trunc('month',now())+interval '1 month'),
  ('grok-x','month',5,null,null,date_trunc('month',now())+interval '1 month'),
  ('parallel','month',0,1000,null,date_trunc('month',now())+interval '1 month'),
  ('tavily','month',0,null,900,date_trunc('month',now())+interval '1 month'),
  ('youtube','month',0,null,null,date_trunc('month',now())+interval '1 month'),
  ('resend','month',0,3000,null,date_trunc('month',now())+interval '1 month')
on conflict(provider,period,resets_at) do update set
  hard_limit_usd=excluded.hard_limit_usd,
  hard_request_limit=excluded.hard_request_limit,
  hard_credit_limit=excluded.hard_credit_limit;

insert into public.provider_runtime_controls(provider,discovery_enabled,analysis_enabled,delivery_enabled,dry_run) values
  ('youtube',true,false,false,false),
  ('parallel',true,false,false,false),
  ('tavily',true,false,false,false),
  ('gemini',false,true,false,false),
  ('xai',true,true,false,false),
  ('resend',false,false,false,true)
on conflict(provider) do update set
  discovery_enabled=excluded.discovery_enabled,
  analysis_enabled=excluded.analysis_enabled,
  delivery_enabled=excluded.delivery_enabled,
  dry_run=excluded.dry_run,
  updated_at=now();

with manifest as (
  select value as item from jsonb_array_elements($manifest$[
  {
    "appearanceSlug": "nvidia-gtc-2026-keynote",
    "title": "GTC 2026 Keynote",
    "description": "NVIDIA's official GTC 2026 keynote session with founder and CEO Jensen Huang.",
    "occurredAt": "2026-03-16T18:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.nvidia.com/gtc/session-catalog/sessions/gtc26-s81595/",
    "sourceProvider": "conference-site",
    "channelName": "NVIDIA GTC",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": "nvidia-gtc-2026",
    "topicSlugs": [
      "chips",
      "inference",
      "robotics",
      "energy"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "google-io-2026-agentic-gemini-era",
    "title": "Welcome to the agentic Gemini era",
    "description": "Official edited transcript of Sundar Pichai's opening remarks at Google I/O 2026.",
    "occurredAt": "2026-05-19T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://blog.google/innovation-and-ai/sundar-pichai-io-2026/",
    "sourceProvider": "company-site",
    "channelName": "Google",
    "speakerSlugs": [
      "sundar-pichai"
    ],
    "companySlugs": [
      "google"
    ],
    "eventSlug": "google-io-2026",
    "topicSlugs": [
      "ai-agents",
      "multimodal-ai",
      "inference",
      "developer-tools"
    ],
    "transcriptHint": true
  },
  {
    "appearanceSlug": "microsoft-build-2026-keynote",
    "title": "Microsoft Build 2026 Keynote",
    "description": "Microsoft's official Build 2026 keynote coverage featuring Satya Nadella.",
    "occurredAt": "2026-06-02T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/build-2026/",
    "sourceProvider": "conference-site",
    "channelName": "Microsoft",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": "microsoft-build-2026",
    "topicSlugs": [
      "ai-agents",
      "developer-tools",
      "data-infrastructure",
      "quantum"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "apple-wwdc-2026-keynote",
    "title": "WWDC26 Keynote",
    "description": "Apple's official WWDC26 keynote video.",
    "occurredAt": "2026-06-08T17:00:00Z",
    "durationSeconds": 4560,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://developer.apple.com/videos/play/wwdc2026/101/",
    "sourceProvider": "company-site",
    "channelName": "Apple Developer",
    "speakerSlugs": [
      "tim-cook"
    ],
    "companySlugs": [
      "apple"
    ],
    "eventSlug": "apple-wwdc-2026",
    "topicSlugs": [
      "ai-agents",
      "developer-tools",
      "multimodal-ai",
      "ai-safety"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "sundar-pichai-stanford-commencement-2026",
    "title": "Sundar Pichai's 2026 Stanford Commencement Address",
    "description": "Official transcript of Sundar Pichai's Stanford University commencement address.",
    "occurredAt": "2026-06-14T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://blog.google/company-news/inside-google/message-ceo/stanford-commencement-speech-2026/",
    "sourceProvider": "company-site",
    "channelName": "Google",
    "speakerSlugs": [
      "sundar-pichai"
    ],
    "companySlugs": [
      "google"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "ai-safety"
    ],
    "transcriptHint": true
  },
  {
    "appearanceSlug": "nvidia-gtc-dc-2025-keynote",
    "title": "NVIDIA GTC Washington, D.C. Keynote",
    "description": "NVIDIA's official on-demand page for Jensen Huang's October 2025 Washington, D.C. keynote.",
    "occurredAt": "2025-10-28T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.nvidia.com/gtc/dc/keynote/",
    "sourceProvider": "company-site",
    "channelName": "NVIDIA",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "robotics",
      "quantum"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "nvidia-gtc-2025-keynote",
    "title": "GTC 2025 Keynote",
    "description": "NVIDIA's official on-demand GTC 2025 keynote with founder and CEO Jensen Huang.",
    "occurredAt": "2025-03-18T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.nvidia.com/en-us/on-demand/session/gtc25-s72484/",
    "sourceProvider": "company-site",
    "channelName": "NVIDIA GTC",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "robotics"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "google-io-2025-from-research-to-reality",
    "title": "Google I/O 2025: From research to reality",
    "description": "Official edited transcript of Sundar Pichai's Google I/O 2025 opening remarks.",
    "occurredAt": "2025-05-20T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://blog.google/innovation-and-ai/technology/ai/io-2025-keynote/",
    "sourceProvider": "company-site",
    "channelName": "Google",
    "speakerSlugs": [
      "sundar-pichai"
    ],
    "companySlugs": [
      "google"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "multimodal-ai",
      "inference"
    ],
    "transcriptHint": true
  },
  {
    "appearanceSlug": "microsoft-build-2025-satya-nadella-opening-keynote",
    "title": "Microsoft Build 2025: Satya Nadella Opening Keynote",
    "description": "Microsoft's official Build 2025 keynote page and recording index.",
    "occurredAt": "2025-05-19T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/build-2025/",
    "sourceProvider": "conference-site",
    "channelName": "Microsoft",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "developer-tools",
      "data-infrastructure"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "apple-wwdc-2025-keynote",
    "title": "WWDC25 Keynote",
    "description": "Apple's official WWDC25 keynote video.",
    "occurredAt": "2025-06-09T17:00:00Z",
    "durationSeconds": 5520,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://developer.apple.com/videos/play/wwdc2025/101/",
    "sourceProvider": "company-site",
    "channelName": "Apple Developer",
    "speakerSlugs": [
      "tim-cook"
    ],
    "companySlugs": [
      "apple"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "developer-tools",
      "ai-agents",
      "chips"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "openai-devday-2025-opening-keynote",
    "title": "OpenAI DevDay 2025 Opening Keynote",
    "description": "OpenAI's official DevDay program for its opening keynote with Sam Altman.",
    "occurredAt": "2025-10-06T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://openai.com/devday/",
    "sourceProvider": "conference-site",
    "channelName": "OpenAI",
    "speakerSlugs": [
      "sam-altman"
    ],
    "companySlugs": [
      "openai"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "developer-tools",
      "multimodal-ai"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "wef-2026-day-after-agi",
    "title": "The day after AGI",
    "description": "World Economic Forum conversation with Dario Amodei and Demis Hassabis about what advanced AI could mean for humanity.",
    "occurredAt": "2026-01-21T10:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.weforum.org/podcasts/radio-davos/episodes/ai-agi-dario-amodei-demis-hassabis/",
    "sourceProvider": "conference-site",
    "channelName": "World Economic Forum",
    "speakerSlugs": [
      "dario-amodei",
      "demis-hassabis"
    ],
    "companySlugs": [
      "anthropic",
      "google"
    ],
    "eventSlug": "wef-davos-2026",
    "topicSlugs": [
      "ai-agents",
      "ai-safety",
      "biotechnology"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "meta-connect-2025-keynote",
    "title": "Meta Connect 2025 Keynote",
    "description": "Meta's official Connect 2025 keynote recap featuring Mark Zuckerberg and the company's AI-glasses announcements.",
    "occurredAt": "2025-09-17T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://about.fb.com/news/2025/09/meta-connect-2025/",
    "sourceProvider": "company-site",
    "channelName": "Meta",
    "speakerSlugs": [
      "mark-zuckerberg"
    ],
    "companySlugs": [
      "meta"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "multimodal-ai",
      "ai-agents",
      "open-source-models"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "amd-ces-2026-ai-everywhere",
    "title": "AI Everywhere, For Everyone",
    "description": "AMD's official CES 2026 keynote program with chair and CEO Lisa Su.",
    "occurredAt": "2026-01-05T18:30:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.amd.com/en/corporate/events/ces.html",
    "sourceProvider": "conference-site",
    "channelName": "AMD",
    "speakerSlugs": [
      "lisa-su"
    ],
    "companySlugs": [
      "amd"
    ],
    "eventSlug": "ces-2026",
    "topicSlugs": [
      "chips",
      "inference",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "qualcomm-computex-2025-keynote",
    "title": "Qualcomm COMPUTEX 2025 Keynote",
    "description": "Qualcomm's official announcement of president and CEO Cristiano Amon's COMPUTEX keynote.",
    "occurredAt": "2025-05-19T06:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.qualcomm.com/news/releases/2025/05/qualcomm-president-and-ceo-cristiano-amon-to-deliver-keynote-spe",
    "sourceProvider": "conference-site",
    "channelName": "Qualcomm",
    "speakerSlugs": [
      "cristiano-amon"
    ],
    "companySlugs": [
      "qualcomm"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "snapdragon-summit-2025-ecosystem-of-you",
    "title": "CEO Keynote: The Ecosystem of You",
    "description": "Qualcomm's official Snapdragon Summit 2025 recap of Cristiano Amon's opening keynote.",
    "occurredAt": "2025-09-24T20:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.qualcomm.com/snapdragon/news/everything-you-missed-at-snapdragon-summit-2025",
    "sourceProvider": "company-site",
    "channelName": "Qualcomm Snapdragon",
    "speakerSlugs": [
      "cristiano-amon"
    ],
    "companySlugs": [
      "qualcomm"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "multimodal-ai"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "dreamforce-2025-opening-keynote",
    "title": "Dreamforce 2025 Opening Keynote",
    "description": "Salesforce's official Dreamforce keynote program featuring Marc Benioff.",
    "occurredAt": "2025-10-14T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.salesforce.com/dreamforce/keynote-post/",
    "sourceProvider": "conference-site",
    "channelName": "Salesforce",
    "speakerSlugs": [
      "marc-benioff"
    ],
    "companySlugs": [
      "salesforce"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "dreamforce-2025-sundar-pichai-marc-benioff",
    "title": "A Conversation with Sundar Pichai and Marc Benioff",
    "description": "Salesforce's official Dreamforce program for a conversation between Sundar Pichai and Marc Benioff.",
    "occurredAt": "2025-10-16T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.salesforce.com/dreamforce/keynote-post/",
    "sourceProvider": "conference-site",
    "channelName": "Salesforce",
    "speakerSlugs": [
      "sundar-pichai",
      "marc-benioff"
    ],
    "companySlugs": [
      "google",
      "salesforce"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "multimodal-ai"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "stripe-sessions-2025-future-of-commerce",
    "title": "Opening keynote: The future of commerce",
    "description": "Stripe's official Sessions 2025 opening keynote with Patrick and John Collison.",
    "occurredAt": "2025-05-06T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://stripe.com/sessions/2025/opening-keynote",
    "sourceProvider": "conference-site",
    "channelName": "Stripe",
    "speakerSlugs": [
      "patrick-collison"
    ],
    "companySlugs": [
      "stripe"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "developer-tools",
      "data-infrastructure",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "stripe-sessions-2025-mark-zuckerberg",
    "title": "A conversation with Mark Zuckerberg",
    "description": "Stripe's official Sessions conversation between Mark Zuckerberg and John Collison.",
    "occurredAt": "2025-05-07T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://stripe.com/sessions/2025/a-conversation-with-mark-zuckerberg",
    "sourceProvider": "conference-site",
    "channelName": "Stripe",
    "speakerSlugs": [
      "mark-zuckerberg"
    ],
    "companySlugs": [
      "meta",
      "stripe"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "open-source-models",
      "data-infrastructure"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "stripe-sessions-2025-jony-ive",
    "title": "A conversation with Sir Jony Ive KBE",
    "description": "Stripe's official Sessions conversation between designer Jony Ive and Patrick Collison.",
    "occurredAt": "2025-05-07T20:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://stripe.com/sessions/2025/a-conversation-with-sir-jony-ive",
    "sourceProvider": "conference-site",
    "channelName": "Stripe",
    "speakerSlugs": [
      "patrick-collison"
    ],
    "companySlugs": [
      "stripe"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "developer-tools",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "stripe-sessions-2025-collison-ama",
    "title": "AMA with Patrick and John Collison",
    "description": "Stripe's official Sessions 2025 ask-me-anything session with its co-founders.",
    "occurredAt": "2025-05-08T18:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://stripe.com/sessions/2025/ama-with-patrick-and-john-collison",
    "sourceProvider": "conference-site",
    "channelName": "Stripe",
    "speakerSlugs": [
      "patrick-collison"
    ],
    "companySlugs": [
      "stripe"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "developer-tools",
      "data-infrastructure"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "google-io-2026-beyond-the-keynote",
    "title": "Beyond the Keynote",
    "description": "Google's official I/O 2026 Dialogues recap featuring Sundar Pichai in conversation about the announcements and their broader context.",
    "occurredAt": "2026-05-20T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://blog.google/innovation-and-ai/technology/ai/io-2026-dialogues-recap/",
    "sourceProvider": "company-site",
    "channelName": "Google",
    "speakerSlugs": [
      "sundar-pichai"
    ],
    "companySlugs": [
      "google"
    ],
    "eventSlug": "google-io-2026",
    "topicSlugs": [
      "ai-agents",
      "multimodal-ai",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "google-io-2026-dialogues-science",
    "title": "Google I/O 2026 Dialogues: Science",
    "description": "Google's official I/O Dialogues recap featuring Demis Hassabis on AI and scientific discovery.",
    "occurredAt": "2026-05-20T19:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://blog.google/innovation-and-ai/technology/ai/io-2026-dialogues-recap/",
    "sourceProvider": "company-site",
    "channelName": "Google",
    "speakerSlugs": [
      "demis-hassabis"
    ],
    "companySlugs": [
      "google"
    ],
    "eventSlug": "google-io-2026",
    "topicSlugs": [
      "ai-agents",
      "ai-safety",
      "biotechnology"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "microsoft-ai-tour-sydney-2026-keynote",
    "title": "Microsoft AI Tour Keynote: Sydney",
    "description": "Microsoft's official coverage of Satya Nadella's Sydney AI Tour keynote.",
    "occurredAt": "2026-04-23T00:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/satya-nadella-australia-visit-2026/",
    "sourceProvider": "conference-site",
    "channelName": "Microsoft",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "ibm-think-2025-enterprise-ai-value",
    "title": "Unlock the full value of enterprise AI",
    "description": "IBM's official Think 2025 keynote video with chairman and CEO Arvind Krishna.",
    "occurredAt": "2025-05-06T14:30:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.ibm.com/think/videos/think-keynotes/enterprise-ai-value",
    "sourceProvider": "conference-site",
    "channelName": "IBM Think",
    "speakerSlugs": [
      "arvind-krishna"
    ],
    "companySlugs": [
      "ibm"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "quantum"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "satya-nadella-new-age-ai-new-delhi",
    "title": "Leading in the New Age of AI — New Delhi",
    "description": "Microsoft's official coverage of Satya Nadella's December 2025 India visit and New Delhi address.",
    "occurredAt": "2025-12-10T05:30:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/india-visit-december-2025/",
    "sourceProvider": "company-site",
    "channelName": "Microsoft India",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "satya-nadella-new-age-ai-mumbai",
    "title": "Leading in the New Age of AI — Mumbai",
    "description": "Microsoft's official coverage of Satya Nadella's December 2025 India visit and Mumbai address.",
    "occurredAt": "2025-12-12T05:30:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/india-visit-december-2025/",
    "sourceProvider": "company-site",
    "channelName": "Microsoft India",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "microsoft-ai-tour-amsterdam-2025-keynote",
    "title": "Microsoft AI Tour Keynote: Amsterdam",
    "description": "Microsoft's official executive speech index for Satya Nadella's AI Tour keynote in Amsterdam.",
    "occurredAt": "2025-06-15T10:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/source/leadership/?selected_tab=2&speeches_selected_speaker=satya-nadella",
    "sourceProvider": "conference-site",
    "channelName": "Microsoft",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "microsoft-50th-anniversary-copilot-event",
    "title": "Microsoft 50th Anniversary and Copilot Event",
    "description": "Microsoft's official executive speech index for the company's 50th anniversary event featuring Satya Nadella.",
    "occurredAt": "2025-04-04T16:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/source/leadership/?selected_tab=2&speeches_selected_speaker=satya-nadella",
    "sourceProvider": "company-site",
    "channelName": "Microsoft",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "openai-forum-sam-altman-future-of-ai",
    "title": "Sam Altman on Building the Future of AI",
    "description": "OpenAI Forum's official event page for a virtual conversation with Sam Altman.",
    "occurredAt": "2026-04-06T17:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://forum.openai.com/en/public/events/virtual-event-sam-altman-on-building-the-future-of-ai-j0h1igxg1q",
    "sourceProvider": "company-site",
    "channelName": "OpenAI Forum",
    "speakerSlugs": [
      "sam-altman"
    ],
    "companySlugs": [
      "openai"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "ai-safety",
      "developer-tools"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "ted-2025-sam-altman-ai-agents-superintelligence",
    "title": "OpenAI's Sam Altman talks ChatGPT, AI agents and superintelligence",
    "description": "TED's official recording and transcript of Sam Altman's live TED2025 conversation with Chris Anderson.",
    "occurredAt": "2025-04-11T17:00:00Z",
    "durationSeconds": 2820,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.ted.com/talks/sam_altman_openai_s_sam_altman_talks_chatgpt_ai_agents_and_superintelligence_live_at_ted2025",
    "sourceProvider": "conference-site",
    "channelName": "TED",
    "speakerSlugs": [
      "sam-altman"
    ],
    "companySlugs": [
      "openai"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "ai-safety",
      "multimodal-ai"
    ],
    "transcriptHint": true
  },
  {
    "appearanceSlug": "wef-2025-how-close-is-powerful-ai",
    "title": "Very powerful AI is close. How close?",
    "description": "World Economic Forum session featuring Dario Amodei and Andrew Ng alongside other AI researchers.",
    "occurredAt": "2025-01-22T10:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.weforum.org/videos/davos-day-3-am25/",
    "sourceProvider": "conference-site",
    "channelName": "World Economic Forum",
    "speakerSlugs": [
      "dario-amodei",
      "andrew-ng"
    ],
    "companySlugs": [
      "anthropic"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "ai-safety",
      "open-source-models"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "nvidia-computex-2025-keynote",
    "title": "NVIDIA CEO Jensen Huang Keynote at COMPUTEX 2025",
    "description": "NVIDIA's official on-demand page for Jensen Huang's COMPUTEX 2025 keynote.",
    "occurredAt": "2025-05-19T03:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.nvidia.com/en-us/on-demand/session/computex25-keynote/",
    "sourceProvider": "conference-site",
    "channelName": "NVIDIA",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "robotics"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "nvidia-ces-2025-keynote",
    "title": "NVIDIA CEO Jensen Huang Keynote at CES 2025",
    "description": "NVIDIA's official on-demand page for Jensen Huang's CES 2025 keynote.",
    "occurredAt": "2025-01-07T02:30:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.nvidia.com/en-us/on-demand/session/ces25-keynote/",
    "sourceProvider": "conference-site",
    "channelName": "NVIDIA",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "robotics"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "nvidia-gtc-paris-vivatech-2025-keynote",
    "title": "NVIDIA GTC Paris Keynote at VivaTech 2025",
    "description": "NVIDIA's official GTC Paris keynote page featuring Jensen Huang at VivaTech.",
    "occurredAt": "2025-06-11T09:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.nvidia.com/en-eu/gtc/keynote/",
    "sourceProvider": "conference-site",
    "channelName": "NVIDIA GTC",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "robotics",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "nvidia-gtc-taipei-computex-2026-keynote",
    "title": "NVIDIA GTC Taipei at COMPUTEX 2026 Keynote",
    "description": "NVIDIA's official coverage of Jensen Huang's GTC Taipei keynote at COMPUTEX 2026.",
    "occurredAt": "2026-06-01T03:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://blogs.nvidia.com/blog/nvidia-gtc-taipei-computex-2026-news/",
    "sourceProvider": "conference-site",
    "channelName": "NVIDIA",
    "speakerSlugs": [
      "jensen-huang"
    ],
    "companySlugs": [
      "nvidia"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "robotics",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "amd-advancing-ai-2025-keynote",
    "title": "AMD Advancing AI 2025 Keynote",
    "description": "AMD's official keynote page for Advancing AI 2025 with chair and CEO Lisa Su.",
    "occurredAt": "2025-06-12T16:30:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.amd.com/en/corporate/events/advancing-ai/2025/keynote-2025.html",
    "sourceProvider": "company-site",
    "channelName": "AMD",
    "speakerSlugs": [
      "lisa-su"
    ],
    "companySlugs": [
      "amd"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "sam-altman-amd-advancing-ai-2025",
    "title": "Sam Altman at AMD Advancing AI 2025",
    "description": "AMD's official event page listing Sam Altman among the featured speakers at Advancing AI 2025.",
    "occurredAt": "2025-06-12T18:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://www.amd.com/en/corporate/events/advancing-ai/2025/advancing-ai-2025.html",
    "sourceProvider": "company-site",
    "channelName": "AMD",
    "speakerSlugs": [
      "sam-altman"
    ],
    "companySlugs": [
      "openai",
      "amd"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "chips",
      "inference",
      "ai-agents"
    ],
    "transcriptHint": false
  },
  {
    "appearanceSlug": "microsoft-ai-tour-madrid-2026-plenary",
    "title": "Microsoft AI Tour Madrid 2026 Plenary",
    "description": "Microsoft's official coverage of its Madrid AI Tour plenary featuring Satya Nadella.",
    "occurredAt": "2026-02-26T09:00:00Z",
    "durationSeconds": null,
    "appearanceType": "technical-talk",
    "sourceUrl": "https://news.microsoft.com/source/emea/features/inteligencia-artificial-y-soberania-digital-protagonistas-del-microsoft-ai-tour-madrid/?lang=es",
    "sourceProvider": "conference-site",
    "channelName": "Microsoft",
    "speakerSlugs": [
      "satya-nadella"
    ],
    "companySlugs": [
      "microsoft"
    ],
    "eventSlug": null,
    "topicSlugs": [
      "ai-agents",
      "data-infrastructure",
      "ai-safety"
    ],
    "transcriptHint": false
  }
]$manifest$::jsonb)
)
insert into public.backfill_manifest(
  appearance_slug,title,description,occurred_at,duration_seconds,appearance_type,source_url,source_provider,channel_name,
  speaker_slugs,company_slugs,event_slug,topic_slugs,transcript_hint,source_fingerprint,selected_route
)
select
  item->>'appearanceSlug',item->>'title',item->>'description',(item->>'occurredAt')::timestamptz,
  nullif(item->>'durationSeconds','')::integer,item->>'appearanceType',item->>'sourceUrl',item->>'sourceProvider',item->>'channelName',
  array(select jsonb_array_elements_text(item->'speakerSlugs')),
  array(select jsonb_array_elements_text(item->'companySlugs')),
  item->>'eventSlug',
  array(select jsonb_array_elements_text(item->'topicSlugs')),
  coalesce((item->>'transcriptHint')::boolean,false),
  encode(extensions.digest((item->>'sourceUrl')||'|'||(item->>'appearanceSlug'),'sha256'),'hex'),
  case when coalesce((item->>'transcriptHint')::boolean,false) then 'pasted-transcript' else 'youtube-video' end
from manifest
on conflict(appearance_slug) do update set
  title=excluded.title,description=excluded.description,occurred_at=excluded.occurred_at,duration_seconds=excluded.duration_seconds,
  source_url=excluded.source_url,source_provider=excluded.source_provider,channel_name=excluded.channel_name,
  speaker_slugs=excluded.speaker_slugs,company_slugs=excluded.company_slugs,event_slug=excluded.event_slug,topic_slugs=excluded.topic_slugs,
  transcript_hint=excluded.transcript_hint,source_fingerprint=excluded.source_fingerprint;

insert into public.prompt_versions(id,route,model,schema_version,prompt_digest,active) values
  ('analysis-v2-transcript','pasted-transcript','gemini-2.5-flash-lite','2',encode(extensions.digest('techstage-analysis-transcript-v2','sha256'),'hex'),true),
  ('analysis-v2-youtube','youtube-video','gemini-2.5-flash-lite','2',encode(extensions.digest('techstage-analysis-youtube-v2','sha256'),'hex'),true),
  ('analysis-v2-x-video','x-video','grok-4.3','2',encode(extensions.digest('techstage-analysis-x-v2','sha256'),'hex'),true),
  ('digest-v2-four-panel','stage-notes','gemini-2.5-flash-lite','2',encode(extensions.digest('techstage-stage-notes-v2','sha256'),'hex'),true)
on conflict(id) do update set prompt_digest=excluded.prompt_digest,active=true;

update public.digest_settings set panel_threshold=4,approval_required=true,generation_enabled=true,delivery_enabled=false,delivery_kill_switch=true,updated_at=now();

update public.job_schedules set timezone='America/Chicago';
update public.job_schedules set enabled=true where id in ('youtube-websub-renewal','youtube-daily-reconciliation','pipeline-retries-cleanup','weekly-upcoming-and-gaps','stage-notes-threshold-scan','stage-notes-freshness-backstop');
update public.job_schedules set enabled=false where id in ('stage-notes-delivery-retry','daily-encrypted-backup','monthly-restore-drill');

update public.job_schedules set next_run_at=case id
  when 'youtube-websub-renewal' then (current_date+1+time '03:00') at time zone 'America/Chicago'
  when 'youtube-daily-reconciliation' then (current_date+1+time '04:00') at time zone 'America/Chicago'
  when 'pipeline-retries-cleanup' then (current_date+1+time '04:30') at time zone 'America/Chicago'
  when 'weekly-upcoming-and-gaps' then (current_date+7+time '04:00') at time zone 'America/Chicago'
  when 'stage-notes-freshness-backstop' then (current_date+1+time '08:00') at time zone 'America/Chicago'
  else next_run_at end
where enabled;

create or replace function public.dispatch_due_automation()
returns integer language plpgsql security definer set search_path = '' as $$
declare schedule_row record;
declare enqueued integer := 0;
declare next_local timestamp;
begin
  for schedule_row in
    select * from public.job_schedules where enabled and next_run_at is not null and next_run_at<=now() for update skip locked
  loop
    insert into public.jobs(kind,stage,status,payload,idempotency_key)
    values(schedule_row.job_kind,'scheduled','queued',jsonb_build_object('scheduleId',schedule_row.id,'scheduledAt',schedule_row.next_run_at),
      'schedule:'||schedule_row.id||':'||to_char(schedule_row.next_run_at,'YYYYMMDDHH24MI'))
    on conflict(idempotency_key) do nothing;
    if found then enqueued:=enqueued+1; end if;
    next_local := (now() at time zone schedule_row.timezone);
    if schedule_row.cadence='weekly' then next_local:=next_local+interval '7 days';
    else next_local:=next_local+interval '1 day'; end if;
    update public.job_schedules set last_enqueued_at=now(),
      next_run_at=(date_trunc('day',next_local)+schedule_row.local_time::time) at time zone schedule_row.timezone,
      updated_at=now()
    where id=schedule_row.id;
  end loop;
  return enqueued;
end $$;

create or replace function public.invoke_job_runner()
returns bigint language plpgsql security definer set search_path = '' as $$
declare request_id bigint;
begin
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='techstage_project_url')||'/functions/v1/job-runner',
    headers := jsonb_build_object('Content-Type','application/json','x-job-runner-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='techstage_job_runner')),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  ) into request_id;
  return request_id;
end $$;

create or replace function public.dispatch_and_invoke()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.dispatch_due_automation();
  perform public.invoke_job_runner();
end $$;

revoke all on function public.dispatch_due_automation() from public,anon,authenticated;
revoke all on function public.invoke_job_runner() from public,anon,authenticated;
revoke all on function public.dispatch_and_invoke() from public,anon,authenticated;
grant execute on function public.dispatch_due_automation() to service_role;
grant execute on function public.invoke_job_runner() to service_role;
grant execute on function public.dispatch_and_invoke() to service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='techstage-dispatcher';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('techstage-dispatcher','*/5 * * * *',$cron$select public.dispatch_and_invoke();$cron$);
end $$;

alter table public.provider_budget_groups enable row level security;
alter table public.budget_reservations enable row level security;
alter table public.provider_runtime_controls enable row level security;
alter table public.backfill_manifest enable row level security;

drop policy if exists admin_provider_budget_groups_all on public.provider_budget_groups;
drop policy if exists admin_budget_reservations_all on public.budget_reservations;
drop policy if exists admin_provider_runtime_controls_all on public.provider_runtime_controls;
drop policy if exists admin_backfill_manifest_all on public.backfill_manifest;
create policy admin_provider_budget_groups_all on public.provider_budget_groups for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_budget_reservations_all on public.budget_reservations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_provider_runtime_controls_all on public.provider_runtime_controls for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_backfill_manifest_all on public.backfill_manifest for all to authenticated using(public.is_admin()) with check(public.is_admin());

grant all privileges on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
grant select on public.companies,public.speakers,public.events,public.topics,public.appearances,public.media_sources,public.chapters,public.highlights,public.insights,public.insight_briefs,public.digest_issues,public.digest_panels to anon,authenticated;

create index if not exists ingestion_candidates_discovery_run_idx on public.ingestion_candidates(discovery_run_id);
create index if not exists ingestion_candidates_appearance_slug_idx on public.ingestion_candidates(appearance_slug);
create index if not exists pipeline_stage_runs_provider_usage_idx on public.pipeline_stage_runs(provider_usage_id);
create index if not exists provider_usage_run_idx on public.provider_usage(discovery_run_id,created_at);
create index if not exists provider_usage_candidate_idx on public.provider_usage(candidate_id);
create index if not exists analysis_artifacts_appearance_idx on public.analysis_artifacts(appearance_id);
create index if not exists analysis_artifacts_candidate_idx on public.analysis_artifacts(candidate_id);
create index if not exists appearances_event_idx on public.appearances(event_id);
create index if not exists media_sources_appearance_idx on public.media_sources(appearance_id);
create index if not exists chapters_appearance_idx on public.chapters(appearance_id);
create index if not exists highlights_appearance_idx on public.highlights(appearance_id);
create index if not exists appearance_speakers_speaker_idx on public.appearance_speakers(speaker_id);
create index if not exists appearance_companies_company_idx on public.appearance_companies(company_id);
create index if not exists appearance_topics_topic_idx on public.appearance_topics(topic_id);
create index if not exists digest_runs_issue_idx on public.digest_runs(digest_issue_id);
create index if not exists budget_reservations_group_idx on public.budget_reservations(budget_group_id);

commit;
