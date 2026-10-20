-- The owner approved both automated source coverage and private transcript
-- storage. The bucket is private; only server-side functions use service role.
alter table public.manual_submissions
  add column if not exists transcript_purge_after timestamptz;
create index if not exists manual_submissions_transcript_purge_idx
  on public.manual_submissions(transcript_purge_after)
  where transcript_status = 'received';

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('manual-transcripts', 'manual-transcripts', false, 10000000, array['text/plain'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- No browser storage policy is granted: transcript content passes through the
-- authenticated Edge Function and is stored/deleted with the service role.
update public.job_schedules
set enabled=true, next_run_at=coalesce(next_run_at, now()), updated_at=now()
where id='youtube-source-coverage';

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd)
values ('purge-manual-transcripts','daily','02:45','purge-manual-transcripts',true,false,0)
on conflict(id) do update set job_kind=excluded.job_kind, enabled=true, paid_operation=false, maximum_usd=0, next_run_at=coalesce(public.job_schedules.next_run_at, now()), updated_at=now();
