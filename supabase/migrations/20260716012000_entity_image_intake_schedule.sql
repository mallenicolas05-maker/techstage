begin;

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd,timezone,next_run_at)
values(
  'daily-entity-image-intake',
  'daily',
  '12:10',
  'entity-image-intake',
  true,
  false,
  0,
  'America/Chicago',
  (current_date + 1 + time '12:10') at time zone 'America/Chicago'
)
on conflict(id) do update set
  cadence=excluded.cadence,
  local_time=excluded.local_time,
  job_kind=excluded.job_kind,
  enabled=true,
  paid_operation=false,
  maximum_usd=0,
  timezone=excluded.timezone,
  next_run_at=coalesce(public.job_schedules.next_run_at, excluded.next_run_at),
  updated_at=now();

commit;
