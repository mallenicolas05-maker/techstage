create policy public_verified_appearance_speakers
on public.appearance_speakers for select
to anon, authenticated
using (
  exists (
    select 1 from public.appearances appearance
    where appearance.id = appearance_speakers.appearance_id
      and appearance.status = 'published'
      and appearance.public_ready_at is not null
  )
);

create policy public_verified_appearance_companies
on public.appearance_companies for select
to anon, authenticated
using (
  exists (
    select 1 from public.appearances appearance
    where appearance.id = appearance_companies.appearance_id
      and appearance.status = 'published'
      and appearance.public_ready_at is not null
  )
);

create policy public_verified_appearance_topics
on public.appearance_topics for select
to anon, authenticated
using (
  exists (
    select 1 from public.appearances appearance
    where appearance.id = appearance_topics.appearance_id
      and appearance.status = 'published'
      and appearance.public_ready_at is not null
  )
);
