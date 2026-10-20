begin;

create index if not exists campaign_media_outcomes_artifact_idx
  on public.campaign_media_outcomes(artifact_id)
  where artifact_id is not null;
create index if not exists youtube_search_plans_target_idx
  on public.youtube_search_plans(target_id,quota_date desc);
create index if not exists youtube_search_reservations_quota_date_idx
  on public.youtube_search_reservations(quota_date);
create index if not exists entity_image_revisions_asset_idx
  on public.entity_image_revisions(asset_id)
  where asset_id is not null;
create index if not exists entity_image_revisions_requested_by_idx
  on public.entity_image_revisions(requested_by)
  where requested_by is not null;

commit;
