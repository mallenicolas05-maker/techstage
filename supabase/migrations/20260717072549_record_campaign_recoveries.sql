create or replace function public.record_campaign_recoveries(recovery_count integer)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare local_date date := (now() at time zone 'America/Chicago')::date;
declare applied integer := greatest(coalesce(recovery_count,0),0);
begin
  insert into public.backfill_daily_usage(campaign_id,usage_date,mode)
  values('entity-backfill-v1',local_date,'campaign')
  on conflict(campaign_id,usage_date) do nothing;

  update public.backfill_daily_usage
  set automatic_recoveries=automatic_recoveries+applied,updated_at=now()
  where campaign_id='entity-backfill-v1' and usage_date=local_date;
  return applied;
end;
$$;

revoke all on function public.record_campaign_recoveries(integer) from public,anon,authenticated;
grant execute on function public.record_campaign_recoveries(integer) to service_role;
