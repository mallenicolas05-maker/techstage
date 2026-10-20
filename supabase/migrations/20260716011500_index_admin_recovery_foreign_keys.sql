-- Cover the foreign keys introduced by the live Admin recovery workspace.
create index if not exists discovery_targets_entity_candidate_id_idx
  on public.discovery_targets (entity_candidate_id);

create index if not exists discovery_targets_source_registry_id_idx
  on public.discovery_targets (source_registry_id);

create index if not exists entity_candidates_run_id_idx
  on public.entity_candidates (run_id);

create index if not exists entity_candidates_image_asset_id_idx
  on public.entity_candidates (image_asset_id);

create index if not exists entity_candidates_approved_by_idx
  on public.entity_candidates (approved_by);
