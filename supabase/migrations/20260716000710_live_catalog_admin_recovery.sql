begin;

-- A published appearance is public only when every required presentation artifact
-- exists.  Status alone is intentionally not enough: five historic link-only
-- records retain their analysis but become Admin-only recovery work.
alter table public.appearances add column if not exists public_ready_at timestamptz;
alter table public.ingestion_candidates add column if not exists blocker_code text;
alter table public.ingestion_candidates add column if not exists blocker_reason text;
alter table public.ingestion_candidates add column if not exists requested_action text;
alter table public.ingestion_candidates add column if not exists retry_count integer not null default 0;
alter table public.ingestion_candidates add column if not exists last_attempt_at timestamptz;
alter table public.ingestion_candidates add column if not exists next_eligible_attempt_at timestamptz;

create table if not exists public.entity_expansion_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('dry-run','staged','complete','failed')),
  requested_per_type integer not null check (requested_per_type between 1 and 50),
  proposed_count integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  provider_spend_usd numeric(18,9) not null default 0 check (provider_spend_usd = 0),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.entity_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.entity_expansion_runs(id) on delete set null,
  entity_type text not null check (entity_type in ('company','speaker','event')),
  stable_slug text not null,
  name text not null,
  relationship_context text,
  source_hint text,
  status text not null default 'staged' check (status in ('staged','needs-image','ready','rejected','activated','archived')),
  discovery_target_status text not null default 'pending' check (discovery_target_status in ('pending','queued','verified','blocked')),
  image_asset_id uuid references public.assets(id) on delete set null,
  pending_upload_path text,
  pending_upload_checksum text,
  image_status text not null default 'missing' check (image_status in ('missing','pending','processing','verified','rejected')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, stable_slug)
);
create index if not exists entity_candidates_status_idx on public.entity_candidates(entity_type,status,created_at desc);

create table if not exists public.discovery_targets (
  id uuid primary key default gen_random_uuid(),
  entity_candidate_id uuid references public.entity_candidates(id) on delete cascade,
  entity_type text not null check (entity_type in ('company','speaker','event')),
  entity_id uuid,
  stable_slug text not null,
  target_kind text not null check (target_kind in ('youtube-channel','upload-playlist','official-event-page','speaker-match')),
  status text not null default 'queued' check (status in ('queued','verifying','verified','blocked','archived')),
  official_url text,
  source_registry_id uuid references public.source_registry(id) on delete set null,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type,stable_slug,target_kind)
);
create index if not exists discovery_targets_queue_idx on public.discovery_targets(status,next_attempt_at);

create or replace function internal.appearance_is_public_ready(appearance_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.appearances a
    join public.media_sources m on m.id=a.canonical_source_id
    where a.id=appearance_uuid
      and a.status='published'
      and a.rights_status='embed-allowed'
      and m.canonical=true
      and m.embed_allowed=true
      and m.rights_status='embed-allowed'
      and m.embed_url ~ '^https://www\\.youtube-nocookie\\.com/embed/[A-Za-z0-9_-]{11}'
      and exists(select 1 from public.analysis_artifacts aa where aa.appearance_id=a.id)
      and exists(select 1 from public.chapters c where c.appearance_id=a.id)
      and exists(select 1 from public.highlights h where h.appearance_id=a.id)
      and exists(select 1 from public.appearance_speakers s where s.appearance_id=a.id)
      and exists(select 1 from public.appearance_companies co where co.appearance_id=a.id)
      and exists(select 1 from public.appearance_topics t where t.appearance_id=a.id)
  );
$$;
revoke all on function internal.appearance_is_public_ready(uuid) from public, anon, authenticated;
grant execute on function internal.appearance_is_public_ready(uuid) to service_role;

create or replace function public.refresh_appearance_public_readiness(appearance_uuid uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare ready boolean;
begin
  ready := internal.appearance_is_public_ready(appearance_uuid);
  update public.appearances
  set public_ready_at = case when ready then coalesce(public_ready_at,now()) else null end,
      updated_at=now()
  where id=appearance_uuid;
  return ready;
end $$;
revoke all on function public.refresh_appearance_public_readiness(uuid) from public, anon, authenticated;
grant execute on function public.refresh_appearance_public_readiness(uuid) to service_role;

-- Recompute the 40-item backfill deterministically.  Incomplete records retain
-- their artifacts and move to the existing review state rather than being deleted.
update public.appearances a
set public_ready_at=case when internal.appearance_is_public_ready(a.id) then now() else null end;

update public.appearances a
set status='review', published_at=null, public_ready_at=null, updated_at=now()
where a.status='published'
  and not internal.appearance_is_public_ready(a.id);

update public.ingestion_candidates c
set status='needs-review', current_stage='editorial-review',
    blocker_code=case
      when a.rights_status='link-only' then 'needs-official-playable-url'
      else 'incomplete-publication-package'
    end,
    blocker_reason=case
      when a.rights_status='link-only' then 'The official source is link-only; a verified playable embed is required before public publication.'
      else 'The appearance is missing a required playable source, relationship, analysis, chapter, or highlight.'
    end,
    requested_action='Provide a verified official playable URL or approve a valid recovery route.',
    updated_at=now()
from public.appearances a
where c.resulting_appearance_id=a.id
  and a.status='review'
  and c.status not in ('archived','rejected');

drop policy if exists published_appearances_read on public.appearances;
drop policy if exists published_media_read on public.media_sources;
drop policy if exists published_chapters_read on public.chapters;
drop policy if exists published_highlights_read on public.highlights;
drop policy if exists public_insights_read on public.insights;
drop policy if exists entitled_insights_read on public.insights;
drop policy if exists entitled_briefs_read on public.insight_briefs;
create policy public_ready_appearances_read on public.appearances for select using (status='published' and public_ready_at is not null);
create policy public_ready_media_read on public.media_sources for select using (exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published' and a.public_ready_at is not null));
create policy public_ready_chapters_read on public.chapters for select using (exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published' and a.public_ready_at is not null));
create policy public_ready_highlights_read on public.highlights for select using (exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published' and a.public_ready_at is not null));
create policy public_ready_insights_read on public.insights for select using (not premium and exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published' and a.public_ready_at is not null));
create policy entitled_public_ready_insights_read on public.insights for select to authenticated using (public.has_entitlement('premium_insights') and exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published' and a.public_ready_at is not null));
create policy entitled_public_ready_briefs_read on public.insight_briefs for select to authenticated using (public.has_entitlement('premium_insights') and exists(select 1 from public.appearances a where a.id=appearance_id and a.status='published' and a.public_ready_at is not null));

alter table public.entity_expansion_runs enable row level security;
alter table public.entity_candidates enable row level security;
alter table public.discovery_targets enable row level security;
revoke all on public.entity_expansion_runs, public.entity_candidates, public.discovery_targets from anon, authenticated;
grant all on public.entity_expansion_runs, public.entity_candidates, public.discovery_targets to service_role;
create policy admin_entity_expansion_runs_all on public.entity_expansion_runs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_entity_candidates_all on public.entity_candidates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_discovery_targets_all on public.discovery_targets for all to authenticated using(public.is_admin()) with check(public.is_admin());

create trigger entity_candidates_set_updated_at before update on public.entity_candidates for each row execute function public.set_updated_at();
create trigger discovery_targets_set_updated_at before update on public.discovery_targets for each row execute function public.set_updated_at();

-- Private pending uploads are intentionally separate from approved delivery assets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('entity-candidate-uploads','entity-candidate-uploads',false,6000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

commit;
