begin;

-- Provider windows are stored as dated ledger rows. Create the next monthly
-- row lazily before a reservation so the first call after month-end cannot be
-- blocked by an expired ledger. Campaign groups keep their lifetime spend.
create or replace function internal.ensure_current_provider_budgets()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('techstage-provider-budget-rollover', 0)
  );

  insert into public.cost_budgets(
    provider,
    period,
    hard_limit_usd,
    hard_request_limit,
    hard_credit_limit,
    resets_at
  )
  select distinct on (prior.provider)
    prior.provider,
    'month',
    prior.hard_limit_usd,
    prior.hard_request_limit,
    prior.hard_credit_limit,
    pg_catalog.date_trunc('month', pg_catalog.now()) + interval '1 month'
  from public.cost_budgets prior
  where prior.period = 'month'
    and not exists (
      select 1
      from public.cost_budgets current_budget
      where current_budget.provider = prior.provider
        and current_budget.period = 'month'
        and current_budget.resets_at > pg_catalog.now()
    )
  order by prior.provider, prior.resets_at desc
  on conflict (provider, period, resets_at) do nothing;

  update public.provider_budget_groups
  set reserved_usd = 0,
      actual_usd = 0,
      resets_at = pg_catalog.date_trunc('month', pg_catalog.now()) + interval '1 month',
      updated_at = pg_catalog.now()
  where resets_at <= pg_catalog.now()
    and id not in ('openai-backfill', 'gemini-backfill');

  update public.provider_budget_groups
  set resets_at = 'infinity'::timestamptz,
      updated_at = pg_catalog.now()
  where resets_at <= pg_catalog.now()
    and id in ('openai-backfill', 'gemini-backfill');
end;
$$;

revoke all on function internal.ensure_current_provider_budgets()
  from public, anon, authenticated;
grant execute on function internal.ensure_current_provider_budgets()
  to service_role;

create or replace function public.reserve_provider_budget_v2(
  requested_provider text,
  requested_group text,
  reservation_key text,
  maximum_usd numeric default 0,
  requested_requests integer default 0,
  requested_credits integer default 0
) returns public.budget_reservations
language plpgsql security definer set search_path = '' as $$
declare route_budget public.cost_budgets;
declare group_budget public.provider_budget_groups;
declare reservation public.budget_reservations;
begin
  select * into reservation from public.budget_reservations where idempotency_key=reservation_key;
  if found then return reservation; end if;

  perform internal.ensure_current_provider_budgets();

  select * into route_budget from public.cost_budgets
  where provider=requested_provider and period='month' and resets_at>now()
  order by resets_at limit 1 for update;
  if not found then raise exception 'provider budget missing'; end if;
  if route_budget.hard_limit_usd is not null and maximum_usd>route_budget.hard_limit_usd then raise exception 'route dollar budget exceeded'; end if;
  if route_budget.hard_request_limit is not null and route_budget.used_requests+requested_requests>route_budget.hard_request_limit then raise exception 'provider request budget exceeded'; end if;
  if route_budget.hard_credit_limit is not null and route_budget.used_credits+requested_credits>route_budget.hard_credit_limit then raise exception 'provider credit budget exceeded'; end if;

  if requested_group is not null then
    select * into group_budget from public.provider_budget_groups
    where id=requested_group and resets_at>now() for update;
    if not found then raise exception 'provider group budget missing'; end if;
    if group_budget.actual_usd+group_budget.reserved_usd+maximum_usd>group_budget.hard_limit_usd then raise exception 'provider group dollar budget exceeded'; end if;
    update public.provider_budget_groups set reserved_usd=reserved_usd+maximum_usd,updated_at=now() where id=requested_group;
  elsif maximum_usd>0 then
    raise exception 'paid call requires budget group';
  end if;

  update public.cost_budgets set used_requests=used_requests+requested_requests,used_credits=used_credits+requested_credits,updated_at=now()
  where id=route_budget.id;

  insert into public.budget_reservations(idempotency_key,provider,budget_group_id,reserved_usd,reserved_requests,reserved_credits)
  values(reservation_key,requested_provider,requested_group,maximum_usd,requested_requests,requested_credits)
  returning * into reservation;
  return reservation;
end $$;

create or replace function public.reserve_provider_budget(
  requested_provider text,
  requested_usd numeric default 0,
  requested_requests integer default 0,
  requested_credits integer default 0
) returns public.cost_budgets
language plpgsql security definer set search_path = '' as $$
declare budget public.cost_budgets;
begin
  perform internal.ensure_current_provider_budgets();

  select * into budget from public.cost_budgets
    where provider=requested_provider and period='month' and resets_at>now()
    order by resets_at limit 1 for update;
  if not found then raise exception 'provider budget missing'; end if;
  if budget.hard_limit_usd is not null and budget.used_usd+requested_usd>budget.hard_limit_usd then raise exception 'provider dollar budget exceeded'; end if;
  if budget.hard_request_limit is not null and budget.used_requests+requested_requests>budget.hard_request_limit then raise exception 'provider request budget exceeded'; end if;
  if budget.hard_credit_limit is not null and budget.used_credits+requested_credits>budget.hard_credit_limit then raise exception 'provider credit budget exceeded'; end if;
  update public.cost_budgets set used_usd=used_usd+requested_usd, used_requests=used_requests+requested_requests,
    used_credits=used_credits+requested_credits where id=budget.id returning * into budget;
  return budget;
end $$;

revoke all on function public.reserve_provider_budget_v2(text,text,text,numeric,integer,integer)
  from public, anon, authenticated;
revoke all on function public.reserve_provider_budget(text,numeric,integer,integer)
  from public, anon, authenticated;
grant execute on function public.reserve_provider_budget_v2(text,text,text,numeric,integer,integer)
  to service_role;
grant execute on function public.reserve_provider_budget(text,numeric,integer,integer)
  to service_role;

select internal.ensure_current_provider_budgets();

commit;
