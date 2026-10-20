-- The public catalog may expose only the curated analysis fields selected by
-- catalog-api, and only when the parent appearance passed the publication gate.
drop policy if exists public_ready_analysis_artifacts_read on public.analysis_artifacts;

create policy public_ready_analysis_artifacts_read
on public.analysis_artifacts
for select
to public
using (
  exists (
    select 1
    from public.appearances appearance
    where appearance.id = analysis_artifacts.appearance_id
      and appearance.status = 'published'::public.record_status
      and appearance.public_ready_at is not null
  )
);

grant select on table public.analysis_artifacts to anon, authenticated;
