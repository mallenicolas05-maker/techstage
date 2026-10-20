begin;

-- `current_date` is UTC in hosted Postgres.  Schedule the first intake from the
-- Chicago wall clock instead so an evening deployment does not skip a day.
with local_clock as (
  select now() at time zone 'America/Chicago' as local_now
), next_occurrence as (
  select case
    when date_trunc('day', local_now) + time '12:10' <= local_now
      then date_trunc('day', local_now) + interval '1 day' + time '12:10'
    else date_trunc('day', local_now) + time '12:10'
  end as local_next
  from local_clock
)
update public.job_schedules
set next_run_at = next_occurrence.local_next at time zone 'America/Chicago',
    updated_at = now()
from next_occurrence
where id = 'daily-entity-image-intake';

commit;
