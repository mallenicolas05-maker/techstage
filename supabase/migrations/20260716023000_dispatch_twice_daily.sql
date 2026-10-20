-- The pg_cron instance is configured for GMT. In Chicago daylight time, 13:00 and
-- 17:00 GMT correspond to 08:00 and 12:00 America/Chicago. Job-runner itself
-- retains its two-job claim limit and provider budget safeguards.
do $$
declare dispatcher_job bigint;
begin
  select jobid into dispatcher_job from cron.job where jobname = 'techstage-dispatcher';
  if dispatcher_job is null then
    perform cron.schedule('techstage-dispatcher', '0 13,17 * * *', $cron$select public.dispatch_and_invoke();$cron$);
  else
    perform cron.alter_job(dispatcher_job, schedule => '0 13,17 * * *');
  end if;
end $$;

-- A separate Saturday-evening trigger starts the weekly source-gap routine without
-- adding unnecessary daily dispatcher invocations. Sunday 00:00 GMT is Saturday
-- 19:00 in Chicago daylight time.
do $$
declare weekly_dispatcher_job bigint;
begin
  select jobid into weekly_dispatcher_job from cron.job where jobname = 'techstage-weekly-dispatcher';
  if weekly_dispatcher_job is null then
    perform cron.schedule('techstage-weekly-dispatcher', '0 0 * * 0', $cron$select public.dispatch_and_invoke();$cron$);
  else
    perform cron.alter_job(weekly_dispatcher_job, schedule => '0 0 * * 0');
  end if;
end $$;

with local_clock as (
  select now() at time zone 'America/Chicago' as local_now
), next_saturday as (
  select date_trunc('day', local_now)
      + ((6 - extract(dow from local_now)::integer + 7) % 7) * interval '1 day'
      + time '19:00' as candidate_at,
      local_now
  from local_clock
)
update public.job_schedules
set cadence = 'weekly',
    local_time = '19:00',
    timezone = 'America/Chicago',
    next_run_at = (case when candidate_at <= local_now then candidate_at + interval '7 days' else candidate_at end) at time zone 'America/Chicago',
    updated_at = now()
from next_saturday
where id = 'weekly-upcoming-and-gaps';
