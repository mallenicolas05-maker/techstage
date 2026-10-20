-- Run with a disposable local Supabase database after `supabase db reset`.
begin;

select plan(8);

select has_table('public', 'appearances', 'catalog table exists');
select has_table('public', 'jobs', 'durable jobs table exists');
select has_table('public', 'rights_reviews', 'rights review table exists');
select has_table('public', 'webhook_receipts', 'webhook receipt table exists');
select isnt((select relrowsecurity from pg_class where oid='public.appearances'::regclass), false, 'appearances has RLS');
select isnt((select relrowsecurity from pg_class where oid='public.profiles'::regclass), false, 'profiles has RLS');
select is((select count(*)::integer from information_schema.tables where table_schema='public' and table_name ilike '%transcript%'), 0, 'no transcript table exists');
select throws_ok($$update public.audit_log set detail='changed'$$, 'audit_log is append-only', 'audit log rejects mutation');

select * from finish();
rollback;
