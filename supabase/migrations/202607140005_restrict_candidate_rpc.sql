begin;
revoke execute on function public.advance_candidate_stage(uuid,text,text,text) from authenticated;
grant execute on function public.advance_candidate_stage(uuid,text,text,text) to service_role;
commit;
