begin;

create table if not exists public.backfill_campaigns (
  id text primary key,
  enabled boolean not null default true,
  timezone text not null default 'America/Chicago',
  campaign_start_date date not null,
  campaign_end_date date not null,
  campaign_transcript_daily_limit integer not null check (campaign_transcript_daily_limit >= 0),
  campaign_video_daily_limit integer not null check (campaign_video_daily_limit >= 0),
  campaign_transcript_daily_usd numeric(18,9) not null check (campaign_transcript_daily_usd >= 0),
  campaign_video_daily_usd numeric(18,9) not null check (campaign_video_daily_usd >= 0),
  campaign_transcript_total_usd numeric(18,9) not null check (campaign_transcript_total_usd >= 0),
  campaign_video_total_usd numeric(18,9) not null check (campaign_video_total_usd >= 0),
  steady_transcript_daily_limit integer not null check (steady_transcript_daily_limit >= 0),
  steady_video_daily_limit integer not null check (steady_video_daily_limit >= 0),
  steady_transcript_daily_usd numeric(18,9) not null check (steady_transcript_daily_usd >= 0),
  steady_video_daily_usd numeric(18,9) not null check (steady_video_daily_usd >= 0),
  youtube_search_daily_limit integer not null check (youtube_search_daily_limit between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (campaign_end_date >= campaign_start_date)
);

create table if not exists public.backfill_daily_usage (
  campaign_id text not null references public.backfill_campaigns(id) on delete cascade,
  usage_date date not null,
  mode text not null check (mode in ('campaign','steady')),
  transcript_started integer not null default 0 check (transcript_started >= 0),
  video_started integer not null default 0 check (video_started >= 0),
  transcript_reserved_usd numeric(18,9) not null default 0 check (transcript_reserved_usd >= 0),
  video_reserved_usd numeric(18,9) not null default 0 check (video_reserved_usd >= 0),
  transcript_actual_usd numeric(18,9) not null default 0 check (transcript_actual_usd >= 0),
  video_actual_usd numeric(18,9) not null default 0 check (video_actual_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(campaign_id,usage_date)
);

create table if not exists public.backfill_analysis_reservations (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.backfill_campaigns(id) on delete cascade,
  usage_date date not null,
  mode text not null check (mode in ('campaign','steady')),
  lane text not null check (lane in ('transcript','video')),
  idempotency_key text not null unique,
  reserved_usd numeric(18,9) not null check (reserved_usd >= 0),
  actual_usd numeric(18,9),
  status text not null default 'reserved' check (status in ('reserved','reconciled','released')),
  created_at timestamptz not null default now(),
  reconciled_at timestamptz
);

create table if not exists public.youtube_search_daily_usage (
  quota_date date primary key,
  search_count integer not null default 0 check (search_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.youtube_search_reservations (
  idempotency_key text primary key,
  quota_date date not null references public.youtube_search_daily_usage(quota_date) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists backfill_analysis_reservations_campaign_idx
  on public.backfill_analysis_reservations(campaign_id,mode,lane,status,usage_date);

insert into public.backfill_campaigns(
  id,enabled,campaign_start_date,campaign_end_date,
  campaign_transcript_daily_limit,campaign_video_daily_limit,
  campaign_transcript_daily_usd,campaign_video_daily_usd,
  campaign_transcript_total_usd,campaign_video_total_usd,
  steady_transcript_daily_limit,steady_video_daily_limit,
  steady_transcript_daily_usd,steady_video_daily_usd,
  youtube_search_daily_limit
) values (
  'entity-backfill-v1',true,current_date+1,current_date+10,
  100,50,0.50,5.00,5.00,50.00,
  20,10,0.10,1.50,100
)
on conflict(id) do update set
  enabled=excluded.enabled,
  campaign_start_date=excluded.campaign_start_date,
  campaign_end_date=excluded.campaign_end_date,
  campaign_transcript_daily_limit=excluded.campaign_transcript_daily_limit,
  campaign_video_daily_limit=excluded.campaign_video_daily_limit,
  campaign_transcript_daily_usd=excluded.campaign_transcript_daily_usd,
  campaign_video_daily_usd=excluded.campaign_video_daily_usd,
  campaign_transcript_total_usd=excluded.campaign_transcript_total_usd,
  campaign_video_total_usd=excluded.campaign_video_total_usd,
  steady_transcript_daily_limit=excluded.steady_transcript_daily_limit,
  steady_video_daily_limit=excluded.steady_video_daily_limit,
  steady_transcript_daily_usd=excluded.steady_transcript_daily_usd,
  steady_video_daily_usd=excluded.steady_video_daily_usd,
  youtube_search_daily_limit=excluded.youtube_search_daily_limit,
  updated_at=now();

create or replace function public.reserve_backfill_analysis(
  requested_lane text,
  reservation_key text,
  estimated_usd numeric
) returns public.backfill_analysis_reservations
language plpgsql security definer set search_path = '' as $$
declare
  campaign public.backfill_campaigns;
  usage public.backfill_daily_usage;
  reservation public.backfill_analysis_reservations;
  local_date date;
  active_mode text;
  count_limit integer;
  daily_usd_limit numeric;
  campaign_total_limit numeric;
  campaign_spend numeric;
begin
  if requested_lane not in ('transcript','video') then raise exception 'invalid backfill lane'; end if;
  if estimated_usd < 0 then raise exception 'invalid backfill estimate'; end if;

  select * into reservation
  from public.backfill_analysis_reservations
  where idempotency_key=reservation_key;
  if found then return reservation; end if;

  select * into campaign
  from public.backfill_campaigns
  where id='entity-backfill-v1' and enabled
  for update;
  if not found then raise exception 'backfill campaign disabled'; end if;

  local_date := (now() at time zone campaign.timezone)::date;
  active_mode := case
    when local_date between campaign.campaign_start_date and campaign.campaign_end_date then 'campaign'
    else 'steady'
  end;

  insert into public.backfill_daily_usage(campaign_id,usage_date,mode)
  values(campaign.id,local_date,active_mode)
  on conflict(campaign_id,usage_date) do nothing;

  select * into usage
  from public.backfill_daily_usage
  where campaign_id=campaign.id and usage_date=local_date
  for update;

  if active_mode='campaign' and requested_lane='transcript' then
    count_limit:=campaign.campaign_transcript_daily_limit;
    daily_usd_limit:=campaign.campaign_transcript_daily_usd;
    campaign_total_limit:=campaign.campaign_transcript_total_usd;
  elsif active_mode='campaign' and requested_lane='video' then
    count_limit:=campaign.campaign_video_daily_limit;
    daily_usd_limit:=campaign.campaign_video_daily_usd;
    campaign_total_limit:=campaign.campaign_video_total_usd;
  elsif requested_lane='transcript' then
    count_limit:=campaign.steady_transcript_daily_limit;
    daily_usd_limit:=campaign.steady_transcript_daily_usd;
    campaign_total_limit:=null;
  else
    count_limit:=campaign.steady_video_daily_limit;
    daily_usd_limit:=campaign.steady_video_daily_usd;
    campaign_total_limit:=null;
  end if;

  if requested_lane='transcript' then
    if usage.transcript_started >= count_limit
      or usage.transcript_reserved_usd + usage.transcript_actual_usd + estimated_usd > daily_usd_limit
    then raise exception 'campaign_capacity_deferred: transcript daily limit reached'; end if;
  else
    if usage.video_started >= count_limit
      or usage.video_reserved_usd + usage.video_actual_usd + estimated_usd > daily_usd_limit
    then raise exception 'campaign_capacity_deferred: video daily limit reached'; end if;
  end if;

  if active_mode='campaign' then
    select coalesce(sum(
      case when requested_lane='transcript'
        then transcript_reserved_usd+transcript_actual_usd
        else video_reserved_usd+video_actual_usd end
    ),0) into campaign_spend
    from public.backfill_daily_usage
    where campaign_id=campaign.id and mode='campaign';
    if campaign_spend + estimated_usd > campaign_total_limit then
      raise exception 'campaign_capacity_deferred: campaign dollar limit reached';
    end if;
  end if;

  insert into public.backfill_analysis_reservations(
    campaign_id,usage_date,mode,lane,idempotency_key,reserved_usd
  ) values (
    campaign.id,local_date,active_mode,requested_lane,reservation_key,estimated_usd
  ) returning * into reservation;

  if requested_lane='transcript' then
    update public.backfill_daily_usage
    set transcript_started=transcript_started+1,
        transcript_reserved_usd=transcript_reserved_usd+estimated_usd,
        updated_at=now()
    where campaign_id=campaign.id and usage_date=local_date;
  else
    update public.backfill_daily_usage
    set video_started=video_started+1,
        video_reserved_usd=video_reserved_usd+estimated_usd,
        updated_at=now()
    where campaign_id=campaign.id and usage_date=local_date;
  end if;
  return reservation;
end $$;

create or replace function public.reconcile_backfill_analysis(
  reservation_uuid uuid,
  charged_usd numeric
) returns public.backfill_analysis_reservations
language plpgsql security definer set search_path = '' as $$
declare reservation public.backfill_analysis_reservations;
begin
  if charged_usd < 0 then raise exception 'invalid actual cost'; end if;
  select * into reservation
  from public.backfill_analysis_reservations
  where id=reservation_uuid for update;
  if not found then raise exception 'backfill reservation missing'; end if;
  if reservation.status='reconciled' then return reservation; end if;
  if reservation.status<>'reserved' then raise exception 'backfill reservation is not active'; end if;
  if charged_usd > reservation.reserved_usd then raise exception 'actual cost exceeds reserved maximum'; end if;

  if reservation.lane='transcript' then
    update public.backfill_daily_usage
    set transcript_reserved_usd=greatest(0,transcript_reserved_usd-reservation.reserved_usd),
        transcript_actual_usd=transcript_actual_usd+charged_usd,
        updated_at=now()
    where campaign_id=reservation.campaign_id and usage_date=reservation.usage_date;
  else
    update public.backfill_daily_usage
    set video_reserved_usd=greatest(0,video_reserved_usd-reservation.reserved_usd),
        video_actual_usd=video_actual_usd+charged_usd,
        updated_at=now()
    where campaign_id=reservation.campaign_id and usage_date=reservation.usage_date;
  end if;

  update public.backfill_analysis_reservations
  set actual_usd=charged_usd,status='reconciled',reconciled_at=now()
  where id=reservation_uuid returning * into reservation;
  return reservation;
end $$;

create or replace function public.release_backfill_analysis(
  reservation_uuid uuid
) returns public.backfill_analysis_reservations
language plpgsql security definer set search_path = '' as $$
declare reservation public.backfill_analysis_reservations;
begin
  select * into reservation
  from public.backfill_analysis_reservations
  where id=reservation_uuid for update;
  if not found then raise exception 'backfill reservation missing'; end if;
  if reservation.status<>'reserved' then return reservation; end if;

  if reservation.lane='transcript' then
    update public.backfill_daily_usage
    set transcript_started=greatest(0,transcript_started-1),
        transcript_reserved_usd=greatest(0,transcript_reserved_usd-reservation.reserved_usd),
        updated_at=now()
    where campaign_id=reservation.campaign_id and usage_date=reservation.usage_date;
  else
    update public.backfill_daily_usage
    set video_started=greatest(0,video_started-1),
        video_reserved_usd=greatest(0,video_reserved_usd-reservation.reserved_usd),
        updated_at=now()
    where campaign_id=reservation.campaign_id and usage_date=reservation.usage_date;
  end if;

  update public.backfill_analysis_reservations
  set actual_usd=0,status='released',reconciled_at=now()
  where id=reservation_uuid returning * into reservation;
  return reservation;
end $$;

create or replace function public.reserve_youtube_search(
  reservation_key text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  quota_day date := (now() at time zone 'America/Los_Angeles')::date;
  current_count integer;
  daily_limit integer;
begin
  if exists(select 1 from public.youtube_search_reservations where idempotency_key=reservation_key) then
    select search_count into current_count from public.youtube_search_daily_usage where quota_date=quota_day;
    return coalesce(current_count,0);
  end if;

  select youtube_search_daily_limit into daily_limit
  from public.backfill_campaigns
  where id='entity-backfill-v1' and enabled
  for update;
  if not found then raise exception 'backfill campaign disabled'; end if;

  insert into public.youtube_search_daily_usage(quota_date)
  values(quota_day)
  on conflict(quota_date) do nothing;

  select search_count into current_count
  from public.youtube_search_daily_usage
  where quota_date=quota_day for update;
  if current_count >= daily_limit then
    raise exception 'youtube_quota_deferred: daily search limit reached';
  end if;

  insert into public.youtube_search_reservations(idempotency_key,quota_date)
  values(reservation_key,quota_day);
  update public.youtube_search_daily_usage
  set search_count=search_count+1,updated_at=now()
  where quota_date=quota_day
  returning search_count into current_count;
  return current_count;
end $$;

alter table public.backfill_campaigns enable row level security;
alter table public.backfill_daily_usage enable row level security;
alter table public.backfill_analysis_reservations enable row level security;
alter table public.youtube_search_daily_usage enable row level security;
alter table public.youtube_search_reservations enable row level security;

revoke all on public.backfill_campaigns,public.backfill_daily_usage,
  public.backfill_analysis_reservations,public.youtube_search_daily_usage,
  public.youtube_search_reservations from public,anon,authenticated;
grant all on public.backfill_campaigns,public.backfill_daily_usage,
  public.backfill_analysis_reservations,public.youtube_search_daily_usage,
  public.youtube_search_reservations to service_role;

revoke all on function public.reserve_backfill_analysis(text,text,numeric) from public,anon,authenticated;
revoke all on function public.reconcile_backfill_analysis(uuid,numeric) from public,anon,authenticated;
revoke all on function public.release_backfill_analysis(uuid) from public,anon,authenticated;
revoke all on function public.reserve_youtube_search(text) from public,anon,authenticated;
grant execute on function public.reserve_backfill_analysis(text,text,numeric) to service_role;
grant execute on function public.reconcile_backfill_analysis(uuid,numeric) to service_role;
grant execute on function public.release_backfill_analysis(uuid) to service_role;
grant execute on function public.reserve_youtube_search(text) to service_role;

insert into public.provider_budget_groups(id,hard_limit_usd,resets_at)
values
  ('openai-backfill',5,date_trunc('month',now())+interval '1 month'),
  ('gemini-backfill',50,date_trunc('month',now())+interval '1 month')
on conflict(id) do update set
  hard_limit_usd=excluded.hard_limit_usd,
  resets_at=excluded.resets_at,
  updated_at=now();

insert into public.cost_budgets(provider,period,hard_limit_usd,hard_request_limit,hard_credit_limit,resets_at)
values
  ('openai-transcript-analysis','month',5,null,null,date_trunc('month',now())+interval '1 month')
on conflict(provider,period,resets_at) do update set hard_limit_usd=excluded.hard_limit_usd;

update public.cost_budgets
set hard_limit_usd=greatest(coalesce(hard_limit_usd,0),50),updated_at=now()
where provider='gemini-youtube-video' and period='month' and resets_at>now();

insert into public.provider_runtime_controls(provider,discovery_enabled,analysis_enabled,delivery_enabled,dry_run)
values('openai',false,true,false,false)
on conflict(provider) do update set analysis_enabled=true,dry_run=false,updated_at=now();

insert into public.prompt_versions(id,route,model,schema_version,prompt_digest,active)
values(
  'analysis-v3-transcript-openai',
  'pasted-transcript',
  'gpt-5-nano',
  '3',
  encode(extensions.digest('techstage-analysis-transcript-openai-v3','sha256'),'hex'),
  true
)
on conflict(id) do update set model=excluded.model,prompt_digest=excluded.prompt_digest,active=true;

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd,timezone,next_run_at)
values(
  'entity-backfill-daily',
  'daily',
  '08:00',
  'entity-backfill-dispatch',
  true,
  true,
  5.50,
  'America/Chicago',
  (current_date+1+time '08:00') at time zone 'America/Chicago'
)
on conflict(id) do update set
  cadence=excluded.cadence,
  local_time=excluded.local_time,
  job_kind=excluded.job_kind,
  enabled=excluded.enabled,
  paid_operation=excluded.paid_operation,
  maximum_usd=excluded.maximum_usd,
  timezone=excluded.timezone,
  next_run_at=least(coalesce(public.job_schedules.next_run_at,excluded.next_run_at),excluded.next_run_at),
  updated_at=now();

commit;
