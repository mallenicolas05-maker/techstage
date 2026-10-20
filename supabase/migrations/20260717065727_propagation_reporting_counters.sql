begin;

create or replace function public.count_provisional_asset_activation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare local_date date := (now() at time zone 'America/Chicago')::date;
declare active_mode text;
begin
  if not new.provisional then return new; end if;
  select case when local_date between campaign_start_date and campaign_end_date then 'campaign' else 'steady' end
  into active_mode from public.backfill_campaigns where id='entity-backfill-v1' and enabled;
  if active_mode is null then return new; end if;
  insert into public.backfill_daily_usage(campaign_id,usage_date,mode)
  values('entity-backfill-v1',local_date,active_mode)
  on conflict(campaign_id,usage_date) do nothing;
  update public.backfill_daily_usage
  set provisional_image_activations=provisional_image_activations+1,updated_at=now()
  where campaign_id='entity-backfill-v1' and usage_date=local_date;
  return new;
end $$;
drop trigger if exists assets_count_provisional_activation on public.assets;
create trigger assets_count_provisional_activation
after insert on public.assets
for each row when (new.provisional)
execute function public.count_provisional_asset_activation();
revoke all on function public.count_provisional_asset_activation() from public,anon,authenticated;
grant execute on function public.count_provisional_asset_activation() to service_role;

update public.backfill_daily_usage
set provisional_image_activations=(
  select count(*) from public.assets
  where provisional and created_at>=((now() at time zone 'America/Chicago')::date at time zone 'America/Chicago')
),updated_at=now()
where campaign_id='entity-backfill-v1'
  and usage_date=(now() at time zone 'America/Chicago')::date;

create or replace function public.record_search_publication(appearance_uuid uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare target_uuid uuid;
declare changed integer := 0;
begin
  select case
    when (manifest_payload#>>'{discoveryTarget,id}') ~ '^[0-9a-fA-F-]{36}$'
      then (manifest_payload#>>'{discoveryTarget,id}')::uuid
    else null end
  into target_uuid
  from public.ingestion_candidates
  where resulting_appearance_id=appearance_uuid
  order by updated_at desc limit 1;
  if target_uuid is null then return false; end if;
  with selected as (
    select id from public.youtube_search_plans
    where target_id=target_uuid
      and quota_date=(now() at time zone 'America/Los_Angeles')::date
    order by completed_at desc nulls last,created_at desc limit 1
  )
  update public.youtube_search_plans p
  set media_published=media_published+1
  from selected s where p.id=s.id;
  get diagnostics changed = row_count;
  return changed=1;
end $$;
revoke all on function public.record_search_publication(uuid) from public,anon,authenticated;
grant execute on function public.record_search_publication(uuid) to service_role;

commit;
