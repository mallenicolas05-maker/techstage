-- A provider usage row is an audit record.  Reconciled rows are deliberately
-- retained, but are never eligible for the live "actual spend" view.
alter table public.provider_usage
  add column if not exists provenance text not null default 'unknown'
    check (provenance in ('runtime', 'reconciled', 'unknown')),
  add column if not exists cost_basis text not null default 'unknown'
    check (cost_basis in ('provider-reported', 'derived-from-provider-usage', 'reconciled', 'unknown')),
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

create index if not exists provider_usage_runtime_day_idx
  on public.provider_usage (created_at desc)
  where provenance = 'runtime' and actual_usd > 0;
create index if not exists provider_usage_job_id_idx on public.provider_usage(job_id);

-- The old connector reconciliation migration annotated its synthetic audit
-- records.  Everything with returned API usage/cost is a runtime record; this
-- makes the historical distinction explicit without deleting audit history.
update public.provider_usage
set provenance = 'reconciled', cost_basis = 'reconciled'
where usage_detail ? 'reconciledFrom';

update public.provider_usage
set provenance = 'runtime',
    cost_basis = case
      when coalesce(input_tokens, 0) > 0 or coalesce(output_tokens, 0) > 0
        then 'derived-from-provider-usage'
      else 'provider-reported'
    end
where provenance = 'unknown'
  and coalesce(actual_usd, 0) > 0
  and not (usage_detail ? 'reconciledFrom');

-- Image updates for a published entity are revisions, not immediate mutations.
-- The daily image intake applies an approved revision on its next run.
create table if not exists public.entity_image_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'speaker', 'event')),
  entity_id uuid not null,
  storage_path text not null,
  checksum text not null,
  mime_type text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'ready', 'scheduled', 'applied', 'cancelled', 'rejected')),
  scheduled_for timestamptz,
  asset_id uuid references public.assets(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entity_image_revisions_due_idx
  on public.entity_image_revisions(status, scheduled_for);
alter table public.entity_image_revisions enable row level security;
revoke all on public.entity_image_revisions from public, anon, authenticated;
grant all on public.entity_image_revisions to service_role;

-- These imports preserve the source JSON and provide an operational trail for
-- the noon expansion.  The importer endpoint validates the batch before it
-- creates any candidates.
create table if not exists public.entity_expansion_imports (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  source_sha256 text not null unique,
  expected_counts jsonb not null,
  imported_counts jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'imported', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.entity_expansion_imports enable row level security;
revoke all on public.entity_expansion_imports from public, anon, authenticated;
grant all on public.entity_expansion_imports to service_role;

insert into storage.buckets(id, name, public)
values ('entity-expansion-imports', 'entity-expansion-imports', false)
on conflict (id) do update set public = false;

alter table public.manual_submissions add column if not exists transcript_url text;
