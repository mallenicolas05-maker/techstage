revoke all on function public.sync_public_readiness_from_appearance() from public, anon, authenticated;
revoke all on function public.sync_public_readiness_from_child() from public, anon, authenticated;
grant execute on function public.sync_public_readiness_from_appearance() to service_role;
grant execute on function public.sync_public_readiness_from_child() to service_role;
