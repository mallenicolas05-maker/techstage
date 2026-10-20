begin;

-- Campaign goals are floors, while the existing provider and dollar limits
-- remain hard ceilings.
alter table public.backfill_campaigns
  add column if not exists analysis_daily_minimum integer not null default 50 check (analysis_daily_minimum >= 0),
  add column if not exists publication_daily_minimum integer not null default 50 check (publication_daily_minimum >= 0),
  add column if not exists combined_daily_maximum integer not null default 150 check (combined_daily_maximum >= 0);

update public.backfill_campaigns
set analysis_daily_minimum=50,
    publication_daily_minimum=50,
    campaign_transcript_daily_limit=100,
    campaign_video_daily_limit=50,
    combined_daily_maximum=150,
    campaign_transcript_daily_usd=0.50,
    campaign_video_daily_usd=5.00,
    campaign_transcript_total_usd=5.00,
    campaign_video_total_usd=50.00,
    youtube_search_daily_limit=100,
    updated_at=now()
where id='entity-backfill-v1';

alter table public.backfill_daily_usage
  add column if not exists analysis_completed integer not null default 0 check (analysis_completed >= 0),
  add column if not exists publications_completed integer not null default 0 check (publications_completed >= 0),
  add column if not exists provisional_image_activations integer not null default 0 check (provisional_image_activations >= 0),
  add column if not exists automatic_recoveries integer not null default 0 check (automatic_recoveries >= 0);

alter table public.backfill_daily_usage drop constraint if exists backfill_daily_usage_combined_daily_maximum;
alter table public.backfill_daily_usage add constraint backfill_daily_usage_combined_daily_maximum
  check (transcript_started + video_started <= 150);

create table if not exists public.campaign_media_outcomes (
  appearance_id uuid primary key references public.appearances(id) on delete cascade,
  artifact_id uuid references public.analysis_artifacts(id) on delete set null,
  usage_date date not null,
  analysis_was_new boolean not null default true,
  recorded_at timestamptz not null default now()
);
alter table public.campaign_media_outcomes enable row level security;
revoke all on public.campaign_media_outcomes from public,anon,authenticated;
grant all on public.campaign_media_outcomes to service_role;

create or replace function public.record_campaign_outcome(
  appearance_uuid uuid,
  artifact_uuid uuid,
  analysis_was_new boolean default true
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare local_date date := (now() at time zone 'America/Chicago')::date;
declare active_mode text;
declare inserted_count integer := 0;
begin
  select case when local_date between campaign_start_date and campaign_end_date then 'campaign' else 'steady' end
  into active_mode from public.backfill_campaigns where id='entity-backfill-v1' and enabled;
  if active_mode is null then return false; end if;

  insert into public.backfill_daily_usage(campaign_id,usage_date,mode)
  values('entity-backfill-v1',local_date,active_mode)
  on conflict(campaign_id,usage_date) do nothing;

  insert into public.campaign_media_outcomes(appearance_id,artifact_id,usage_date,analysis_was_new)
  values(appearance_uuid,artifact_uuid,local_date,analysis_was_new)
  on conflict(appearance_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count=1 then
    update public.backfill_daily_usage
    set analysis_completed=analysis_completed+case when analysis_was_new then 1 else 0 end,
        publications_completed=publications_completed+1,
        updated_at=now()
    where campaign_id='entity-backfill-v1' and usage_date=local_date;
    return true;
  end if;
  return false;
end $$;
revoke all on function public.record_campaign_outcome(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.record_campaign_outcome(uuid,uuid,boolean) to service_role;

-- Trust decisions remain private operational metadata. Existing verified
-- publishers are safe defaults; unreviewed discoveries remain private.
alter table public.source_registry
  add column if not exists trust_tier text not null default 'unreviewed'
    check (trust_tier in ('official','trusted-publisher','unreviewed','rejected')),
  add column if not exists publisher_type text not null default 'unknown'
    check (publisher_type in ('company','speaker','event','conference','publisher','interviewer','media','unknown')),
  add column if not exists auto_publish_allowed boolean not null default false,
  add column if not exists verification_confidence numeric(5,4) not null default 0
    check (verification_confidence between 0 and 1);

update public.source_registry
set trust_tier='official',
    publisher_type=case when kind like '%event%' then 'event' else 'company' end,
    auto_publish_allowed=true,
    verification_confidence=1
where compliance_status='verified';

create index if not exists source_registry_auto_publish_idx
  on public.source_registry(provider,auto_publish_allowed,verification_confidence desc)
  where enabled;

-- Every staged entity becomes searchable immediately.
create or replace function public.ensure_candidate_discovery_target()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.discovery_targets(
    entity_candidate_id,entity_type,stable_slug,target_kind,status,priority,discovery_intent
  ) values (
    new.id,new.entity_type,new.stable_slug,'youtube-channel','queued',
    case new.entity_type when 'speaker' then 20 when 'company' then 30 else 40 end,
    'source-coverage'
  ) on conflict(entity_type,stable_slug,target_kind) do update
    set entity_candidate_id=excluded.entity_candidate_id,
        status=case when public.discovery_targets.status='archived' then 'queued' else public.discovery_targets.status end,
        updated_at=now();
  update public.entity_candidates set discovery_target_status='queued',updated_at=now() where id=new.id;
  return new;
end $$;

drop trigger if exists entity_candidates_create_discovery_target on public.entity_candidates;
create trigger entity_candidates_create_discovery_target
after insert on public.entity_candidates
for each row execute function public.ensure_candidate_discovery_target();

insert into public.discovery_targets(entity_candidate_id,entity_type,stable_slug,target_kind,status,priority,discovery_intent)
select id,entity_type,stable_slug,'youtube-channel','queued',
  case entity_type when 'speaker' then 20 when 'company' then 30 else 40 end,
  'source-coverage'
from public.entity_candidates
where status in ('staged','needs-image','ready')
on conflict(entity_type,stable_slug,target_kind) do update
set entity_candidate_id=excluded.entity_candidate_id,updated_at=now();

update public.entity_candidates c set discovery_target_status='queued',updated_at=now()
where status in ('staged','needs-image','ready')
  and exists(select 1 from public.discovery_targets d where d.entity_candidate_id=c.id);

revoke all on function public.ensure_candidate_discovery_target() from public,anon,authenticated;
grant execute on function public.ensure_candidate_discovery_target() to service_role;

-- Ten daily 50/50/50 expansion tranches, including the current staged set as
-- tranche one.
create table if not exists public.entity_expansion_campaigns (
  id text primary key,
  start_date date not null,
  total_days integer not null default 10 check (total_days=10),
  per_type_per_day integer not null default 50 check (per_type_per_day=50),
  target_per_type integer not null default 500 check (target_per_type=500),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.entity_expansion_campaigns(id,start_date)
values('entity-expansion-v1',(now() at time zone 'America/Chicago')::date)
on conflict(id) do nothing;

alter table public.entity_expansion_runs
  add column if not exists campaign_id text references public.entity_expansion_campaigns(id) on delete set null,
  add column if not exists tranche_number integer check (tranche_number between 1 and 10);
create unique index if not exists entity_expansion_runs_campaign_tranche_unique
  on public.entity_expansion_runs(campaign_id,tranche_number)
  where campaign_id is not null and tranche_number is not null;

with day_one as (
  select run_id from public.entity_candidates where run_id is not null
  group by run_id order by min(created_at) limit 1
)
update public.entity_expansion_runs r
set campaign_id='entity-expansion-v1',tranche_number=1
from day_one where r.id=day_one.run_id and r.campaign_id is null;

alter table public.entity_expansion_campaigns enable row level security;
revoke all on public.entity_expansion_campaigns from public,anon,authenticated;
grant all on public.entity_expansion_campaigns to service_role;

-- Provisional name cards are zero-cost, clearly marked, and replaceable.
alter table public.assets
  add column if not exists provisional boolean not null default false,
  add column if not exists provisional_reason text;

alter table public.asset_variants drop constraint if exists asset_variants_variant_check;
alter table public.asset_variants add constraint asset_variants_variant_check
  check (variant in ('logo-512','speaker-256','speaker-512','landscape-1600','admin-original'));
alter table public.asset_variants drop constraint if exists asset_variants_format_check;
alter table public.asset_variants add constraint asset_variants_format_check
  check (format in ('webp','png','jpg','jpeg','svg'));
alter table public.asset_variants drop constraint if exists asset_variants_content_type_check;
alter table public.asset_variants add constraint asset_variants_content_type_check
  check (content_type in ('image/webp','image/png','image/jpeg','image/svg+xml'));
update storage.buckets
set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/svg+xml']
where id='entity-assets';

-- Search plans measure both utilization and yield.
create table if not exists public.youtube_search_plans (
  id uuid primary key default gen_random_uuid(),
  quota_date date not null,
  target_id uuid not null references public.discovery_targets(id) on delete cascade,
  purpose text not null check (purpose in ('prominent-entity-media','official-source','alternate-source','media-gap')),
  query_variant integer not null check (query_variant between 0 and 3),
  status text not null default 'planned' check (status in ('planned','running','completed','scheduled-next-day')),
  result_count integer not null default 0 check (result_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  media_published integer not null default 0 check (media_published >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(quota_date,target_id,query_variant)
);
create index if not exists youtube_search_plans_day_status_idx on public.youtube_search_plans(quota_date,status);
alter table public.youtube_search_plans enable row level security;
revoke all on public.youtube_search_plans from public,anon,authenticated;
grant all on public.youtube_search_plans to service_role;

-- A worker abandoned for 15 minutes is safely returned to the runnable list.
create or replace function public.reclaim_stale_campaign_jobs()
returns integer language plpgsql security definer set search_path=''
as $$
declare reclaimed integer;
begin
  update public.jobs
  set status='queued',
      attempts=greatest(0,attempts-1),
      available_at=now(),
      locked_at=null,
      locked_by=null,
      failure_code='stale-work-recovered',
      message='TechStage recovered this unfinished item automatically.',
      updated_at=now()
  where status='running' and locked_at < now()-interval '15 minutes';
  get diagnostics reclaimed = row_count;
  if reclaimed>0 then
    update public.backfill_daily_usage
    set automatic_recoveries=automatic_recoveries+reclaimed,updated_at=now()
    where campaign_id='entity-backfill-v1'
      and usage_date=(now() at time zone 'America/Chicago')::date;
  end if;
  return reclaimed;
end $$;
revoke all on function public.reclaim_stale_campaign_jobs() from public,anon,authenticated;
grant execute on function public.reclaim_stale_campaign_jobs() to service_role;

-- Gemini text fallback shares the transcript campaign's $5 total ceiling.
insert into public.cost_budgets(provider,period,hard_limit_usd,hard_request_limit,hard_credit_limit,resets_at)
values('gemini-transcript-analysis','month',5,null,null,date_trunc('month',now())+interval '1 month')
on conflict(provider,period,resets_at) do update set hard_limit_usd=excluded.hard_limit_usd;
insert into public.prompt_versions(id,route,model,schema_version,prompt_digest,active)
values('analysis-v3-transcript-gemini-fallback','pasted-transcript','gemini-3.1-flash-lite','3',encode(extensions.digest('techstage-analysis-transcript-gemini-fallback-v3','sha256'),'hex'),true)
on conflict(id) do update set model=excluded.model,prompt_digest=excluded.prompt_digest,active=true;

-- Three daily flow checks and three search top-ups. pg_cron only wakes the
-- dispatcher; provider calls still require a due schedule and a reservation.
insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd,timezone,next_run_at)
values
 ('campaign-throughput-0800','daily','08:00','campaign-throughput-controller',true,true,5.50,'America/Chicago',((now() at time zone 'America/Chicago')::date+time '08:00') at time zone 'America/Chicago'),
 ('campaign-throughput-1200','daily','12:00','campaign-throughput-controller',true,true,5.50,'America/Chicago',((now() at time zone 'America/Chicago')::date+time '12:00') at time zone 'America/Chicago'),
 ('campaign-throughput-1600','daily','16:00','campaign-throughput-controller',true,true,5.50,'America/Chicago',((now() at time zone 'America/Chicago')::date+time '16:00') at time zone 'America/Chicago'),
 ('youtube-search-topup-0800','daily','08:00','youtube-search-planner',true,false,0,'America/Chicago',((now() at time zone 'America/Chicago')::date+time '08:00') at time zone 'America/Chicago'),
 ('youtube-search-topup-1200','daily','12:00','youtube-search-planner',true,false,0,'America/Chicago',((now() at time zone 'America/Chicago')::date+time '12:00') at time zone 'America/Chicago'),
 ('youtube-search-topup-1530','daily','15:30','youtube-search-planner',true,false,0,'America/Chicago',((now() at time zone 'America/Chicago')::date+time '15:30') at time zone 'America/Chicago')
on conflict(id) do update set
 cadence=excluded.cadence,local_time=excluded.local_time,job_kind=excluded.job_kind,enabled=true,
 paid_operation=excluded.paid_operation,maximum_usd=excluded.maximum_usd,timezone=excluded.timezone;

-- Move today's elapsed times to tomorrow so deployment does not create a
-- surprise burst; future due times are left intact.
update public.job_schedules
set next_run_at=next_run_at+interval '1 day',updated_at=now()
where id in ('campaign-throughput-0800','campaign-throughput-1200','campaign-throughput-1600','youtube-search-topup-0800','youtube-search-topup-1200','youtube-search-topup-1530')
  and next_run_at<=now();

do $$
declare dispatcher_job bigint;
begin
  select jobid into dispatcher_job from cron.job where jobname='techstage-dispatcher';
  if dispatcher_job is null then
    perform cron.schedule('techstage-dispatcher','*/5 * * * *',$cron$select public.dispatch_and_invoke();$cron$);
  else
    perform cron.alter_job(dispatcher_job,schedule=>'*/5 * * * *');
  end if;
end $$;

commit;
