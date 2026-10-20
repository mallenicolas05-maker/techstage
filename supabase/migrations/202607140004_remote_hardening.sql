begin;

-- Keep extension objects out of the API-exposed public schema.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
alter extension vector set schema extensions;
alter extension citext set schema extensions;

-- SECURITY DEFINER helpers must never inherit PostgreSQL's default PUBLIC
-- execute grant. RLS helpers remain callable only by signed-in users, while
-- workflow mutation remains admin-checked and service-role capable.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.has_entitlement(text) from public, anon;
grant execute on function public.has_entitlement(text) to authenticated, service_role;

revoke all on function public.advance_candidate_stage(uuid,text,text,text) from public, anon;
grant execute on function public.advance_candidate_stage(uuid,text,text,text) to authenticated, service_role;

revoke all on function public.append_audit_log() from public, anon, authenticated;

commit;
