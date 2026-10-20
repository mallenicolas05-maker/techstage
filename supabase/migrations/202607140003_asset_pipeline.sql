begin;

-- Asset provenance is immutable evidence for editorial and takedown review.
alter table public.assets
  add column if not exists entity_slug text,
  add column if not exists attribution_text text,
  add column if not exists license_url text,
  add column if not exists checksum_sha256 text,
  add column if not exists source_modified_at timestamptz,
  add column if not exists source_storage_path text,
  add column if not exists alt_text text,
  add column if not exists search_query text;

alter table public.assets
  drop constraint if exists assets_checksum_sha256_format,
  add constraint assets_checksum_sha256_format
    check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$');

create index if not exists assets_entity_lookup_idx
  on public.assets(entity_type, entity_id, status, created_at desc);
create unique index if not exists assets_entity_checksum_unique_idx
  on public.assets(entity_type, entity_id, checksum_sha256)
  where checksum_sha256 is not null;

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant text not null check (variant in ('logo-512', 'speaker-256', 'speaker-512', 'landscape-1600')),
  format text not null check (format in ('webp', 'png')),
  content_type text not null check (content_type in ('image/webp', 'image/png')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10000000),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  unique(asset_id, variant, format)
);

alter table public.events add column if not exists image_asset_id uuid;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_image_fk'
  ) then
    alter table public.events add constraint events_image_fk
      foreign key(image_asset_id) references public.assets(id) deferrable initially deferred;
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'entity-asset-sources',
  'entity-asset-sources',
  false,
  10000000,
  array['image/jpeg','image/png','image/webp','image/svg+xml']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Delivery files are private at rest. The catalog function signs only variants
-- belonging to approved assets, so processing/rejected objects never leak.
update storage.buckets set public=false where id='entity-assets';

alter table public.asset_variants enable row level security;

drop policy if exists approved_assets_read on public.assets;
create policy approved_assets_read on public.assets for select
  using(status = 'approved');

drop policy if exists approved_asset_variants_read on public.asset_variants;
create policy approved_asset_variants_read on public.asset_variants for select
  using(exists(
    select 1 from public.assets a
    where a.id = asset_id and a.status = 'approved'
  ));

drop policy if exists admin_asset_variants_all on public.asset_variants;
create policy admin_asset_variants_all on public.asset_variants for all to authenticated
  using(public.is_admin()) with check(public.is_admin());

drop policy if exists approved_entity_assets_read on storage.objects;
create policy approved_entity_assets_read on storage.objects for select
using(
  bucket_id = 'entity-assets'
  and exists(
    select 1
    from public.asset_variants v
    join public.assets a on a.id = v.asset_id
    where v.storage_path = name and a.status = 'approved'
  )
);

-- Source masters are deliberately private. Only service-role workflows and
-- authenticated admins may read them.
drop policy if exists admin_entity_asset_sources_all on storage.objects;
create policy admin_entity_asset_sources_all on storage.objects for all to authenticated
using(bucket_id = 'entity-asset-sources' and public.is_admin())
with check(bucket_id = 'entity-asset-sources' and public.is_admin());

create or replace function public.finalize_asset_import(asset_uuid uuid, actor_uuid uuid default null)
returns public.assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset public.assets;
  complete boolean := false;
begin
  select * into asset from public.assets where id = asset_uuid and status = 'processing' for update;
  if asset.id is null then raise exception 'asset is not ready for finalization'; end if;

  if asset.entity_type = 'company' then
    select
      exists(select 1 from public.asset_variants where asset_id=asset.id and variant='logo-512' and format='webp')
      and exists(select 1 from public.asset_variants where asset_id=asset.id and variant='logo-512' and format='png')
      into complete;
  elsif asset.entity_type = 'speaker' then
    select
      exists(select 1 from public.asset_variants where asset_id=asset.id and variant='speaker-256' and format='webp')
      and exists(select 1 from public.asset_variants where asset_id=asset.id and variant='speaker-512' and format='webp')
      into complete;
  else
    select exists(
      select 1 from public.asset_variants
      where asset_id=asset.id and variant='landscape-1600' and format='webp'
    ) into complete;
  end if;
  if not complete then raise exception 'required delivery variants are incomplete'; end if;

  update public.assets set
    status='approved', approved_by=actor_uuid, approved_at=now(),
    review_due_at=now()+interval '1 year'
  where id=asset.id returning * into asset;

  if asset.entity_type='company' then
    update public.companies set logo_asset_id=asset.id where id=asset.entity_id;
  elsif asset.entity_type='speaker' then
    update public.speakers set headshot_asset_id=asset.id where id=asset.entity_id;
  elsif asset.entity_type='event' then
    update public.events set image_asset_id=asset.id where id=asset.entity_id;
  elsif asset.entity_type='topic' then
    update public.topics set image_asset_id=asset.id where id=asset.entity_id;
  else
    raise exception 'unsupported entity type';
  end if;

  insert into public.audit_log(actor_id, actor_label, action, entity_type, entity_id, detail)
  values(actor_uuid, case when actor_uuid is null then 'asset-bootstrap' else 'admin' end,
    'asset.approved', asset.entity_type, asset.entity_id, 'Approved asset ' || asset.id::text || ' and linked required variants.');
  return asset;
end $$;

revoke all on function public.finalize_asset_import(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_asset_import(uuid,uuid) to service_role;

commit;
