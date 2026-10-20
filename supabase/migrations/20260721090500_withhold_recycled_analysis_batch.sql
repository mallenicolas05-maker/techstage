-- These four public rows reused the same unrelated speaker/company payload.
-- Keep their official source records for re-analysis, but remove them from all
-- public surfaces until a source-grounded artifact replaces the bad payload.
update public.appearances
set status='review', public_ready_at=null, updated_at=now()
where id in (
  '8ef18754-46c8-4cac-9a72-980202ed74e3'::uuid,
  'c8e0939d-cf0e-4b9a-8c9f-c1e6f469b9f9'::uuid,
  '31156515-527c-43da-8256-1eb7b61b51e5'::uuid,
  '52353a1e-2e21-447d-8c3e-6a22cd67df36'::uuid
)
and status='published';
