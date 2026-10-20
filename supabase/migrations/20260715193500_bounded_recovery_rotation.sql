begin;

alter table public.backfill_manifest
  add column if not exists recovery_attempts integer not null default 0 check(recovery_attempts between 0 and 3),
  add column if not exists last_recovery_at timestamptz;

create index if not exists backfill_manifest_recovery_idx
  on public.backfill_manifest(status,last_recovery_at,recovery_attempts)
  where status in ('resolved','blocked');

-- Earlier media rejections already consumed one real provider attempt.
update public.backfill_manifest
set recovery_attempts=greatest(recovery_attempts,1), last_recovery_at=coalesce(last_recovery_at,now())
where status='blocked' and block_reason ilike '%Gemini rejected%';

commit;
