-- The owner does not want generated TechStage name cards used as entity images.
-- Return only those automatically carded entities to the existing image-preparation flow.
create temporary table removed_name_card_assets on commit drop as
select id, entity_type, entity_id
from public.assets
where provider='techstage-local'
  and provisional=true
  and storage_path like 'entity/%/provisional-%.svg';

update public.companies c
set logo_asset_id=null, status='review', updated_at=now()
from removed_name_card_assets r
where r.entity_type='company' and r.entity_id=c.id and c.logo_asset_id=r.id;

update public.speakers s
set headshot_asset_id=null, status='review', updated_at=now()
from removed_name_card_assets r
where r.entity_type='speaker' and r.entity_id=s.id and s.headshot_asset_id=r.id;

update public.events e
set image_asset_id=null, status='review', updated_at=now()
from removed_name_card_assets r
where r.entity_type='event' and r.entity_id=e.id and e.image_asset_id=r.id;

update public.entity_candidates ec
set image_asset_id=null,
    image_status='missing',
    status='needs-image',
    updated_at=now()
where ec.image_asset_id in (select id from removed_name_card_assets);

delete from public.asset_variants
where asset_id in (select id from removed_name_card_assets);

delete from public.assets
where id in (select id from removed_name_card_assets);

update public.backfill_daily_usage
set provisional_image_activations=(
  select count(*)::integer
  from public.assets a
  where a.provisional=true
    and a.created_at>=((now() at time zone 'America/Chicago')::date at time zone 'America/Chicago')
), updated_at=now()
where campaign_id='entity-backfill-v1'
  and usage_date=(now() at time zone 'America/Chicago')::date;
