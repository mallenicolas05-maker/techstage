begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

create type public.app_role as enum ('user', 'admin');
create type public.record_status as enum ('draft', 'review', 'published', 'archived');
create type public.rights_status as enum ('unknown', 'embed-allowed', 'link-only', 'licensed', 'blocked');
create type public.job_status as enum ('queued', 'running', 'awaiting-review', 'blocked', 'failed', 'complete');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,display_name,avatar_url)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do nothing;
  return new;
end $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.plans (
  id text primary key,
  name text not null,
  stripe_monthly_price_id text unique,
  stripe_annual_price_id text unique,
  active boolean not null default false,
  entitlements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_customer_id text not null unique,
  provider_subscription_id text unique,
  plan_id text references public.plans(id),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  source text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text, website_url text, logo_asset_id uuid, status public.record_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.speakers (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  headline text, biography text, headshot_asset_id uuid, status public.record_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text, official_url text, starts_at timestamptz, ends_at timestamptz, timezone text,
  logo_asset_id uuid, status public.record_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.topics (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text, image_asset_id uuid, search_vector tsvector generated always as
    (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) stored,
  status public.record_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index topics_search_idx on public.topics using gin(search_vector);

create table public.appearances (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  summary text, appearance_type text not null check (appearance_type in ('panel','interview','product-launch','technical-talk','podcast','livestream')),
  event_id uuid references public.events(id) on delete set null, occurred_at timestamptz, duration_seconds integer check (duration_seconds >= 0),
  status public.record_status not null default 'draft', published_at timestamptz,
  canonical_source_id uuid, rights_status public.rights_status not null default 'unknown',
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, ''))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status <> 'published' or (canonical_source_id is not null and rights_status <> 'unknown' and rights_status <> 'blocked'))
);
create index appearances_search_idx on public.appearances using gin(search_vector);
create index appearances_title_trgm_idx on public.appearances using gin(title gin_trgm_ops);

create table public.media_sources (
  id uuid primary key default gen_random_uuid(), appearance_id uuid not null references public.appearances(id) on delete cascade,
  provider text not null, source_url text not null, external_id text, canonical boolean not null default false,
  embed_allowed boolean not null default false, rights_status public.rights_status not null default 'unknown',
  provenance jsonb not null default '[]'::jsonb, last_checked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider, source_url)
);
alter table public.appearances add constraint appearances_canonical_source_fk foreign key (canonical_source_id) references public.media_sources(id) deferrable initially deferred;

create table public.chapters (
  id uuid primary key default gen_random_uuid(), appearance_id uuid not null references public.appearances(id) on delete cascade,
  title text not null, summary text, start_seconds integer check(start_seconds >= 0), end_seconds integer,
  position integer not null, created_at timestamptz not null default now(), check(end_seconds is null or end_seconds > start_seconds)
);
create table public.highlights (
  id uuid primary key default gen_random_uuid(), appearance_id uuid not null references public.appearances(id) on delete cascade,
  title text not null, summary text not null, kind text not null, start_seconds integer, end_seconds integer,
  evidence_excerpt text check(length(evidence_excerpt) <= 280), created_at timestamptz not null default now(),
  check(end_seconds is null or start_seconds is null or end_seconds > start_seconds)
);
create table public.insight_briefs (
  id uuid primary key default gen_random_uuid(), appearance_id uuid not null references public.appearances(id) on delete cascade,
  analysis_artifact_id uuid, status text not null default 'queued', model_version text not null,
  overall_confidence numeric(4,3) check(overall_confidence between 0 and 1), generated_at timestamptz,
  reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.insights (
  id uuid primary key default gen_random_uuid(), appearance_id uuid not null references public.appearances(id) on delete cascade,
  insight_brief_id uuid references public.insight_briefs(id) on delete cascade,
  category text not null, title text not null, body text not null, evidence_excerpt text check(length(evidence_excerpt) <= 280),
  evidence_timestamp_seconds integer, confidence numeric(4,3) check(confidence between 0 and 1), premium boolean not null default false,
  prompt_version text not null, model text not null, created_at timestamptz not null default now()
);

create table public.prompt_versions (
  id text primary key, route text not null, model text not null, schema_version text not null,
  prompt_digest text not null, active boolean not null default false, created_at timestamptz not null default now()
);
create table public.analysis_artifacts (
  id uuid primary key default gen_random_uuid(), candidate_id uuid, appearance_id uuid references public.appearances(id) on delete cascade,
  route text not null check(route in ('pasted-transcript','youtube-video','x-video')), model text not null,
  prompt_version text not null references public.prompt_versions(id), summary text not null check(length(summary) <= 4000),
  appearance_type text not null, speaker_names jsonb not null default '[]'::jsonb, company_names jsonb not null default '[]'::jsonb,
  event_name text, topics jsonb not null default '[]'::jsonb, chapters jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb, evidence jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) check(confidence between 0 and 1),
  raw_input_retained boolean not null default false check(raw_input_retained=false),
  raw_response_retained boolean not null default false check(raw_response_retained=false),
  generated_at timestamptz not null, created_at timestamptz not null default now()
);
alter table public.insight_briefs add constraint insight_briefs_artifact_fk foreign key(analysis_artifact_id) references public.analysis_artifacts(id) deferrable initially deferred;

create table public.appearance_speakers (appearance_id uuid references public.appearances(id) on delete cascade, speaker_id uuid references public.speakers(id) on delete cascade, role text, primary key(appearance_id, speaker_id));
create table public.appearance_companies (appearance_id uuid references public.appearances(id) on delete cascade, company_id uuid references public.companies(id) on delete cascade, primary key(appearance_id, company_id));
create table public.appearance_topics (appearance_id uuid references public.appearances(id) on delete cascade, topic_id uuid references public.topics(id) on delete cascade, primary key(appearance_id, topic_id));
create table public.speaker_companies (speaker_id uuid references public.speakers(id) on delete cascade, company_id uuid references public.companies(id) on delete cascade, role text, starts_at date, ends_at date, primary key(speaker_id, company_id, role));

create table public.source_registry (
  id uuid primary key default gen_random_uuid(), kind text not null, name text not null, canonical_url text not null,
  provider text not null, cadence text not null, enabled boolean not null default false, priority integer not null default 100,
  cursor text, upload_playlist_id text, last_scanned_at timestamptz, next_scan_at timestamptz,
  websub_lease_expires_at timestamptz,
  compliance_status text not null default 'needs-review', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider, canonical_url)
);
create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(), provider text not null, kind text not null, status text not null,
  dry_run boolean not null default true, started_at timestamptz, completed_at timestamptz, candidate_count integer not null default 0,
  request_count integer not null default 0, estimated_usd numeric(12,6) not null default 0, actual_usd numeric(12,6),
  message text not null default '', created_at timestamptz not null default now()
);
create table public.ingestion_candidates (
  id uuid primary key default gen_random_uuid(), source_registry_id uuid references public.source_registry(id) on delete set null,
  source_url text not null, source_provider text not null, source_fingerprint text not null unique, title text not null,
  context_summary text check(length(context_summary) <= 2000), relevance_score numeric(5,4), canonical_media_url text,
  canonical_provider text, rights_status public.rights_status not null default 'unknown', current_stage text not null default 'discover-source',
  status text not null default 'discovered', duplicate_of uuid references public.ingestion_candidates(id), resulting_appearance_id uuid references public.appearances(id),
  submitted_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.analysis_artifacts add constraint analysis_artifacts_candidate_fk foreign key(candidate_id) references public.ingestion_candidates(id) deferrable initially deferred;
create index ingestion_candidates_status_idx on public.ingestion_candidates(status, updated_at desc);
create table public.pipeline_stage_runs (
  id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.ingestion_candidates(id) on delete cascade,
  stage text not null, status public.job_status not null, attempt integer not null default 0, requires_review boolean not null default false,
  started_at timestamptz, completed_at timestamptz, failure_code text, detail text,
  created_at timestamptz not null default now(), unique(candidate_id, stage, attempt)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), candidate_id uuid references public.ingestion_candidates(id) on delete cascade,
  kind text not null, stage text, status public.job_status not null default 'queued', payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0, max_attempts integer not null default 3, available_at timestamptz not null default now(),
  locked_at timestamptz, locked_by text, completed_at timestamptz, idempotency_key text not null unique,
  failure_code text, message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index jobs_claim_idx on public.jobs(status, available_at) where status in ('queued','failed');
create table public.job_schedules (
  id text primary key, cadence text not null, local_time text not null, job_kind text not null,
  enabled boolean not null default false, paid_operation boolean not null default false,
  maximum_usd numeric(12,6), last_enqueued_at timestamptz, next_run_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.provider_usage (
  id uuid primary key default gen_random_uuid(), provider text not null, period text not null, operation text not null,
  request_count integer not null default 0, input_tokens bigint not null default 0, output_tokens bigint not null default 0,
  quota_units integer not null default 0, credits integer not null default 0, estimated_usd numeric(12,6) not null default 0,
  actual_usd numeric(12,6), created_at timestamptz not null default now()
);
create table public.cost_budgets (
  id uuid primary key default gen_random_uuid(), provider text not null, period text not null,
  hard_limit_usd numeric(12,6), hard_request_limit integer, hard_credit_limit integer,
  used_usd numeric(12,6) not null default 0, used_requests integer not null default 0, used_credits integer not null default 0,
  resets_at timestamptz not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider, period, resets_at)
);

create table public.rights_reviews (
  id uuid primary key default gen_random_uuid(), candidate_id uuid references public.ingestion_candidates(id) on delete cascade,
  appearance_id uuid references public.appearances(id) on delete cascade, status public.rights_status not null,
  embed_allowed boolean not null default false, rationale text not null, source_url text not null,
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.duplicate_decisions (
  id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.ingestion_candidates(id) on delete cascade,
  duplicate_of_candidate_id uuid references public.ingestion_candidates(id), appearance_id uuid references public.appearances(id),
  decision text not null, score numeric(5,4), decided_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.entity_matches (
  id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.ingestion_candidates(id) on delete cascade,
  entity_type text not null, proposed_name text not null, entity_id uuid, confidence numeric(5,4), decision text not null default 'pending',
  decided_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.assets (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, provider text not null,
  source_url text not null, source_page_url text, photographer text, license_label text not null, storage_path text,
  width integer, height integer, focal_x numeric(5,4), focal_y numeric(5,4), transparent_background boolean,
  status text not null default 'candidate', approved_by uuid references public.profiles(id), approved_at timestamptz,
  review_due_at timestamptz, created_at timestamptz not null default now()
);
alter table public.companies add constraint companies_logo_fk foreign key(logo_asset_id) references public.assets(id) deferrable initially deferred;
alter table public.speakers add constraint speakers_headshot_fk foreign key(headshot_asset_id) references public.assets(id) deferrable initially deferred;
alter table public.events add constraint events_logo_fk foreign key(logo_asset_id) references public.assets(id) deferrable initially deferred;
alter table public.topics add constraint topics_image_fk foreign key(image_asset_id) references public.assets(id) deferrable initially deferred;
create table public.takedowns (
  id uuid primary key default gen_random_uuid(), appearance_id uuid references public.appearances(id), media_source_id uuid references public.media_sources(id),
  requester text not null, reason text not null, status text not null default 'open', resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), actor_label text not null,
  action text not null, entity_type text not null, entity_id uuid, detail text not null,
  created_at timestamptz not null default now()
);

create table public.follows (user_id uuid references public.profiles(id) on delete cascade, entity_type text not null, entity_id uuid not null, created_at timestamptz not null default now(), primary key(user_id, entity_type, entity_id));
create table public.saves (user_id uuid references public.profiles(id) on delete cascade, appearance_id uuid references public.appearances(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id, appearance_id));
create table public.albums (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, name text not null, description text, visibility text not null default 'private', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.album_items (album_id uuid references public.albums(id) on delete cascade, appearance_id uuid references public.appearances(id) on delete cascade, position integer not null default 0, created_at timestamptz not null default now(), primary key(album_id, appearance_id));
create table public.reminders (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, appearance_id uuid references public.appearances(id) on delete cascade, event_id uuid references public.events(id) on delete cascade, due_at timestamptz not null, channels text[] not null default array['in-app'], status text not null default 'scheduled', created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, type text not null, title text not null, body text not null, linked_entity_type text, linked_entity_id uuid, read_at timestamptz, created_at timestamptz not null default now());
create table public.viewing_progress (user_id uuid references public.profiles(id) on delete cascade, appearance_id uuid references public.appearances(id) on delete cascade, position_seconds integer not null default 0, duration_seconds integer not null default 0, updated_at timestamptz not null default now(), primary key(user_id, appearance_id));

create table public.webhook_receipts (id uuid primary key default gen_random_uuid(), provider text not null, external_event_id text not null, event_type text not null, signature_verified boolean not null, processed_at timestamptz, created_at timestamptz not null default now(), unique(provider, external_event_id));
create table public.idempotency_keys (key text primary key, scope text not null, response_code integer, response_digest text, expires_at timestamptz not null, created_at timestamptz not null default now());
create table public.rate_limit_counters (key text not null, window_start timestamptz not null, request_count integer not null default 1, expires_at timestamptz not null, primary key(key, window_start));
create table public.backup_records (id uuid primary key default gen_random_uuid(), object_key text not null unique, encrypted boolean not null default true, sha256 text not null, size_bytes bigint not null, status text not null, created_at timestamptz not null default now(), restore_tested_at timestamptz);
create table public.security_scan_results (id uuid primary key default gen_random_uuid(), scanner text not null, scope text not null, status text not null, summary text not null, artifact_url text, commit_sha text, created_at timestamptz not null default now());

-- There is intentionally no raw transcript, X dump, event-page dump, or provider-response table.

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','subscriptions','entitlements','companies','speakers','events','topics','appearances','media_sources','insight_briefs','source_registry','ingestion_candidates','jobs','job_schedules','cost_budgets','albums'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.has_entitlement(required_key text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.entitlements e where e.user_id = auth.uid() and e.key = required_key and e.enabled and (e.expires_at is null or e.expires_at > now()));
$$;

create or replace function public.claim_jobs(worker_name text, claim_limit integer default 10)
returns setof public.jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
    with claimable as (
      select id from public.jobs where status in ('queued','failed') and available_at <= now() and attempts < max_attempts
      order by available_at for update skip locked limit greatest(1, least(claim_limit, 50))
    )
    update public.jobs j set status='running', locked_at=now(), locked_by=worker_name, attempts=j.attempts+1
    from claimable c where j.id=c.id returning j.*;
end $$;

create or replace function public.advance_candidate_stage(candidate_uuid uuid, expected_stage text, next_stage text, next_status text)
returns public.ingestion_candidates language plpgsql security definer set search_path = '' as $$
declare candidate public.ingestion_candidates;
declare ordered_stages constant text[] := array[
  'discover-source','normalize-metadata','fingerprint-source','detect-duplicates','classify-relevance','resolve-canonical-media',
  'match-entities','verify-rights','select-analysis-route','await-analysis-input','analyze-content','purge-temporary-input',
  'materialize-artifacts','attach-evidence','link-related','review-assets-entities','editorial-review','publish-recheck'
];
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into candidate from public.ingestion_candidates where id=candidate_uuid for update;
  if not found or candidate.current_stage<>expected_stage then raise exception 'candidate stage changed'; end if;
  if array_position(ordered_stages,next_stage)<>array_position(ordered_stages,expected_stage)+1 then raise exception 'invalid stage transition'; end if;
  if next_stage='publish-recheck' and (candidate.rights_status in ('unknown','blocked') or candidate.canonical_media_url is null) then raise exception 'publishing requires rights and canonical media'; end if;
  update public.ingestion_candidates set current_stage=next_stage,status=next_status where id=candidate_uuid returning * into candidate;
  return candidate;
end $$;

create or replace function public.reserve_provider_budget(
  requested_provider text, requested_usd numeric default 0, requested_requests integer default 0, requested_credits integer default 0
) returns public.cost_budgets language plpgsql security definer set search_path = '' as $$
declare budget public.cost_budgets;
begin
  select * into budget from public.cost_budgets
    where provider=requested_provider and period='month' and resets_at>now()
    order by resets_at limit 1 for update;
  if not found then raise exception 'provider budget missing'; end if;
  if budget.hard_limit_usd is not null and budget.used_usd+requested_usd>budget.hard_limit_usd then raise exception 'provider dollar budget exceeded'; end if;
  if budget.hard_request_limit is not null and budget.used_requests+requested_requests>budget.hard_request_limit then raise exception 'provider request budget exceeded'; end if;
  if budget.hard_credit_limit is not null and budget.used_credits+requested_credits>budget.hard_credit_limit then raise exception 'provider credit budget exceeded'; end if;
  update public.cost_budgets set used_usd=used_usd+requested_usd, used_requests=used_requests+requested_requests,
    used_credits=used_credits+requested_credits where id=budget.id returning * into budget;
  return budget;
end $$;

create or replace function public.consume_rate_limit(counter_key text, maximum_requests integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare start_at timestamptz := to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds); current_count integer;
begin
  insert into public.rate_limit_counters(key,window_start,request_count,expires_at) values(counter_key,start_at,1,start_at+make_interval(secs=>window_seconds))
  on conflict(key,window_start) do update set request_count=public.rate_limit_counters.request_count+1 returning request_count into current_count;
  return current_count<=maximum_requests;
end $$;

create or replace function public.cleanup_expired_operational_records()
returns table(idempotency_deleted bigint, rate_limits_deleted bigint, jobs_deleted bigint)
language plpgsql security definer set search_path = '' as $$
declare idempotency_count bigint; rate_count bigint; job_count bigint;
begin
  delete from public.idempotency_keys where expires_at<now(); get diagnostics idempotency_count=row_count;
  delete from public.rate_limit_counters where expires_at<now(); get diagnostics rate_count=row_count;
  delete from public.jobs where status='complete' and completed_at<now()-interval '30 days'; get diagnostics job_count=row_count;
  return query select idempotency_count,rate_count,job_count;
end $$;

create or replace function public.apply_stripe_event(event_type text, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  user_uuid uuid; customer_id text; subscription_id text; price_id text; resolved_plan text; subscription_status text;
  entitlement_record record;
begin
  customer_id := payload->>'customer';
  subscription_id := case when event_type='checkout.session.completed' then payload->>'subscription' else payload->>'id' end;
  if event_type='checkout.session.completed' then
    user_uuid := nullif(payload->>'client_reference_id','')::uuid;
    if user_uuid is null or customer_id is null then raise exception 'checkout session missing user or customer'; end if;
    insert into public.subscriptions(user_id,provider_customer_id,provider_subscription_id,status,provider_updated_at)
      values(user_uuid,customer_id,subscription_id,'checkout-complete',now())
      on conflict(provider_customer_id) do update set user_id=excluded.user_id, provider_subscription_id=excluded.provider_subscription_id, provider_updated_at=now();
    return;
  end if;

  if event_type like 'customer.subscription.%' then
    price_id := payload#>>'{items,data,0,price,id}';
    subscription_status := coalesce(payload->>'status','unknown');
    select id into resolved_plan from public.plans where stripe_monthly_price_id=price_id or stripe_annual_price_id=price_id limit 1;
    update public.subscriptions set provider_subscription_id=subscription_id, plan_id=resolved_plan, status=subscription_status,
      current_period_end=case when payload->>'current_period_end' is null then null else to_timestamp((payload->>'current_period_end')::double precision) end,
      cancel_at_period_end=coalesce((payload->>'cancel_at_period_end')::boolean,false), provider_updated_at=now()
      where provider_customer_id=customer_id returning user_id into user_uuid;
    if user_uuid is null then raise exception 'subscription customer is not mapped'; end if;
    delete from public.entitlements where user_id=user_uuid and source='stripe';
    if subscription_status in ('active','trialing') and resolved_plan is not null then
      for entitlement_record in select key,value from jsonb_each((select entitlements from public.plans where id=resolved_plan)) loop
        insert into public.entitlements(user_id,key,enabled,source) values(user_uuid,entitlement_record.key,(entitlement_record.value::text)::boolean,'stripe')
        on conflict(user_id,key) do update set enabled=excluded.enabled,source='stripe',updated_at=now();
      end loop;
    end if;
    return;
  end if;

  if event_type in ('invoice.paid','invoice.payment_failed') then
    subscription_id := payload->>'subscription';
    update public.subscriptions set status=case when event_type='invoice.paid' then 'active' else 'past_due' end, provider_updated_at=now()
      where provider_subscription_id=subscription_id;
  end if;
end $$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.claim_jobs(text,integer) from public,anon,authenticated;
revoke all on function public.reserve_provider_budget(text,numeric,integer,integer) from public,anon,authenticated;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.cleanup_expired_operational_records() from public,anon,authenticated;
revoke all on function public.apply_stripe_event(text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_jobs(text,integer) to service_role;
grant execute on function public.reserve_provider_budget(text,numeric,integer,integer) to service_role;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
grant execute on function public.cleanup_expired_operational_records() to service_role;
grant execute on function public.apply_stripe_event(text,jsonb) to service_role;

create or replace function public.append_audit_log() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log for each row execute function public.append_audit_log();

-- Default-deny Row Level Security on every browser-visible table.
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

create policy published_appearances_read on public.appearances for select using (status='published');
create policy published_speakers_read on public.speakers for select using (status='published');
create policy published_companies_read on public.companies for select using (status='published');
create policy published_events_read on public.events for select using (status='published');
create policy published_topics_read on public.topics for select using (status='published');
create policy published_media_read on public.media_sources for select using (exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published'));
create policy published_chapters_read on public.chapters for select using (exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published'));
create policy published_highlights_read on public.highlights for select using (exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published'));
create policy public_insights_read on public.insights for select using (not premium and exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published'));
create policy entitled_insights_read on public.insights for select to authenticated using (public.has_entitlement('premium_insights') and exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published'));
create policy entitled_briefs_read on public.insight_briefs for select to authenticated using (public.has_entitlement('premium_insights') and exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published'));
create policy active_plans_read on public.plans for select using(active);

create policy own_profile_read on public.profiles for select to authenticated using (id=auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role=(select role from public.profiles where id=auth.uid()));
create policy own_subscriptions_read on public.subscriptions for select to authenticated using (user_id=auth.uid());
create policy own_entitlements_read on public.entitlements for select to authenticated using (user_id=auth.uid());

do $$ declare table_name text; begin
  foreach table_name in array array['follows','saves','albums','reminders','notifications','viewing_progress'] loop
    execute format('create policy own_%I_all on public.%I for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())', table_name, table_name);
  end loop;
end $$;
create policy own_album_items_all on public.album_items for all to authenticated
  using (exists(select 1 from public.albums a where a.id=album_id and a.user_id=auth.uid()))
  with check (exists(select 1 from public.albums a where a.id=album_id and a.user_id=auth.uid()));

-- Admin policies still require a verified JWT and server-managed admin role. Server functions additionally enforce ADMIN_EMAILS.
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' and tablename not in ('audit_log') loop
    execute format('create policy admin_%I_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', r.tablename, r.tablename);
  end loop;
end $$;
create policy admin_audit_read on public.audit_log for select to authenticated using(public.is_admin());
create policy admin_audit_insert on public.audit_log for insert to authenticated with check(public.is_admin());

insert into public.plans(id, name, active, entitlements) values
  ('free', 'Free', true, '{"premium_insights": false, "notifications": false}'::jsonb),
  ('pro', 'Pro', false, '{"premium_insights": true, "notifications": true}'::jsonb)
on conflict (id) do nothing;

insert into public.prompt_versions(id,route,model,schema_version,prompt_digest,active) values
  ('analysis-v1-transcript','pasted-transcript','gemini-2.5-flash-lite','1','configure-during-activation',false),
  ('analysis-v1-youtube','youtube-video','gemini-2.5-flash-lite','1','configure-during-activation',false),
  ('analysis-v1-x-video','x-video','grok-4.3','1','configure-after-measured-pilot',false)
on conflict(id) do nothing;

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd) values
  ('youtube-websub-renewal','daily','03:00','youtube-websub-renewal',false,false,0),
  ('youtube-daily-reconciliation','daily','04:00','youtube-reconciliation',false,false,0),
  ('pipeline-retries-cleanup','daily','04:30','pipeline-maintenance',false,false,0),
  ('weekly-upcoming-and-gaps','weekly','Sunday 04:00','weekly-discovery',false,true,3),
  ('quarterly-source-assets','quarterly','first Sunday 05:00','registry-review',false,false,0),
  ('daily-encrypted-backup','daily','02:00','encrypted-backup',false,false,0),
  ('monthly-restore-drill','monthly','first Monday 02:00','restore-drill',false,false,0)
on conflict(id) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('entity-assets','entity-assets',true,10000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy approved_entity_assets_read on storage.objects for select
using(bucket_id='entity-assets' and exists(select 1 from public.assets a where a.storage_path=name and a.status='approved'));

insert into public.cost_budgets(provider, period, hard_limit_usd, hard_request_limit, hard_credit_limit, resets_at) values
  ('youtube','month',0,null,null,date_trunc('month',now())+interval '1 month'),
  ('gemini-text','month',0.75,null,null,date_trunc('month',now())+interval '1 month'),
  ('gemini-youtube-video','month',7,null,null,date_trunc('month',now())+interval '1 month'),
  ('grok-x','month',3,null,null,date_trunc('month',now())+interval '1 month'),
  ('parallel','month',0,1000,null,date_trunc('month',now())+interval '1 month'),
  ('tavily','month',0,null,900,date_trunc('month',now())+interval '1 month'),
  ('pexels','month',0,20000,null,date_trunc('month',now())+interval '1 month')
  ,('pixabay','month',0,5000,null,date_trunc('month',now())+interval '1 month')
on conflict (provider,period,resets_at) do nothing;

commit;
