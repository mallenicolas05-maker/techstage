create table if not exists public.automation_repair_runs (
  id uuid primary key default gen_random_uuid(),
  reporting_window date not null,
  issue_detected text,
  root_cause text,
  repair_applied jsonb not null default '{}'::jsonb,
  changed_resources jsonb not null default '[]'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  spending_before_usd numeric(12,6) not null default 0 check (spending_before_usd >= 0),
  spending_after_usd numeric(12,6) not null default 0 check (spending_after_usd >= 0),
  minimum_and_maximum_status jsonb not null default '{}'::jsonb,
  final_status text not null check (final_status in ('working-normally','repaired','owner-action-needed','repair-reverted')),
  owner_action_required text,
  created_at timestamptz not null default now()
);

create index if not exists automation_repair_runs_window_idx
  on public.automation_repair_runs(reporting_window desc,created_at desc);

alter table public.automation_repair_runs enable row level security;
revoke all on public.automation_repair_runs from public,anon,authenticated;
grant all on public.automation_repair_runs to service_role;

create or replace function public.record_automation_repair(
  repair_reporting_window date,
  repair_issue_detected text,
  repair_root_cause text,
  repair_applied jsonb,
  repair_changed_resources jsonb,
  repair_verification jsonb,
  repair_spending_before_usd numeric,
  repair_spending_after_usd numeric,
  repair_minimum_and_maximum_status jsonb,
  repair_final_status text,
  repair_owner_action_required text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare repair_id uuid;
begin
  if repair_final_status not in ('working-normally','repaired','owner-action-needed','repair-reverted') then
    raise exception 'Unsupported repair final status';
  end if;
  insert into public.automation_repair_runs(
    reporting_window,issue_detected,root_cause,repair_applied,changed_resources,verification,
    spending_before_usd,spending_after_usd,minimum_and_maximum_status,final_status,owner_action_required
  ) values (
    repair_reporting_window,repair_issue_detected,repair_root_cause,coalesce(repair_applied,'{}'::jsonb),
    coalesce(repair_changed_resources,'[]'::jsonb),coalesce(repair_verification,'{}'::jsonb),
    greatest(coalesce(repair_spending_before_usd,0),0),greatest(coalesce(repair_spending_after_usd,0),0),
    coalesce(repair_minimum_and_maximum_status,'{}'::jsonb),repair_final_status,repair_owner_action_required
  ) returning id into repair_id;
  return repair_id;
end;
$$;

revoke all on function public.record_automation_repair(date,text,text,jsonb,jsonb,jsonb,numeric,numeric,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function public.record_automation_repair(date,text,text,jsonb,jsonb,jsonb,numeric,numeric,jsonb,text,text)
  to service_role;
