begin;

alter table public.entity_image_revisions
  add column if not exists applied_at timestamptz;

comment on column public.entity_image_revisions.applied_at is
  'Time the scheduled, owner-approved entity image revision was applied.';

commit;
