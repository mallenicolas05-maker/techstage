begin;

create or replace function public.claim_jobs(worker_name text, claim_limit integer default 2)
returns setof public.jobs
language plpgsql security definer set search_path=''
as $$
declare active_workers integer;
declare available_slots integer;
begin
  -- Serialize claim decisions so overlapping cron/continuation wakeups share
  -- one global concurrency ceiling rather than each claiming two jobs.
  perform pg_advisory_xact_lock(hashtext('techstage-global-job-claim'));

  update public.jobs
  set status='queued',attempts=greatest(0,attempts-1),available_at=now(),
      locked_at=null,locked_by=null,failure_code='stale-work-recovered',
      message='TechStage recovered this unfinished item automatically.',updated_at=now()
  where status='running' and locked_at<now()-interval '15 minutes';

  select count(*) into active_workers
  from public.jobs
  where status='running' and locked_at>=now()-interval '15 minutes';
  available_slots := greatest(0,2-active_workers);
  if available_slots=0 then return; end if;

  return query
    with claimable as (
      select id from public.jobs
      where status in ('queued','failed') and available_at<=now() and attempts<max_attempts
      order by available_at
      for update skip locked
      limit least(available_slots,greatest(1,least(claim_limit,2)))
    )
    update public.jobs j
    set status='running',locked_at=now(),locked_by=worker_name,attempts=j.attempts+1,updated_at=now()
    from claimable c where j.id=c.id
    returning j.*;
end $$;

revoke all on function public.claim_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_jobs(text,integer) to service_role;

commit;
