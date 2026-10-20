-- The owner explicitly requires real imported images only.
drop trigger if exists assets_count_provisional_activation on public.assets;
drop function if exists public.count_provisional_asset_activation();

alter table public.backfill_daily_usage
  drop column if exists provisional_image_activations;

alter table public.assets
  drop column if exists provisional_reason,
  drop column if exists provisional;
