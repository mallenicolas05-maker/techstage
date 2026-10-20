begin;

-- The prompt digest is the SHA-256 of the version-controlled prompt source file.
update public.prompt_versions
set model = case when route in ('pasted-transcript','youtube-video','stage-notes') then 'gemini-3.1-flash-lite' else model end,
    prompt_digest = '133a0d3c04b03b81b44da26a38382863e0aa72a9bbd3fd3b4a7d1b9f8e75d4ca'
where id in ('analysis-v2-transcript','analysis-v2-youtube','digest-v2-four-panel');

-- Keep schedule parsing time-only; weekday semantics are carried by cadence/next_run_at.
update public.job_schedules set local_time = '04:00', timezone = 'America/Chicago'
where id = 'weekly-upcoming-and-gaps';

insert into public.job_schedules(id,cadence,local_time,job_kind,enabled,paid_operation,maximum_usd,timezone,next_run_at)
values(
  'daily-backfill-recovery',
  'daily',
  '08:10',
  'backfill-recovery',
  true,
  true,
  0.50,
  'America/Chicago',
  (current_date + 1 + time '08:10') at time zone 'America/Chicago'
)
on conflict(id) do update set
  cadence=excluded.cadence,
  local_time=excluded.local_time,
  job_kind=excluded.job_kind,
  enabled=excluded.enabled,
  paid_operation=excluded.paid_operation,
  maximum_usd=excluded.maximum_usd,
  timezone=excluded.timezone,
  next_run_at=coalesce(public.job_schedules.next_run_at,excluded.next_run_at),
  updated_at=now();

-- Repair stale, idempotent analysis jobs so the recovered official transcript URLs
-- replace the earlier YouTube payloads instead of being ignored on conflict.
with repair(appearance_slug,source_url) as (values
  ('microsoft-build-2025-satya-nadella-opening-keynote', 'https://medius.microsoft.com/video/asset/Transcript/fa2a07ab-11ff-4f05-aec5-8e3756c29013?referrer=Microsoft+Build-%2Fen-US%2Fsessions%2FKEY010&mhid=build&loc=en-us'),
  ('microsoft-build-2026-keynote', 'https://medius.microsoft.com/video/asset/Transcript/9b6fd85d-e64f-46a4-b8b2-23811087192f?referrer=Microsoft+Build-%2Fen-US%2Fsessions%2FKEY01&mhid=build&loc=en-us')
)
update public.jobs j
set payload = jsonb_build_object(
      'appearanceSlug', repair.appearance_slug,
      'route', 'pasted-transcript',
      'sourceUrl', repair.source_url,
      'appearanceId', c.resulting_appearance_id,
      'durationSeconds', m.duration_seconds
    ),
    status='queued', attempts=0, available_at=now(), locked_at=null, locked_by=null,
    completed_at=null, failure_code=null, message='Official Microsoft transcript recovery queued.', updated_at=now()
from repair
join public.ingestion_candidates c on c.appearance_slug=repair.appearance_slug
join public.backfill_manifest m on m.appearance_slug=repair.appearance_slug
where j.candidate_id=c.id and j.kind='backfill-analyze';

update public.backfill_manifest
set status='resolved', block_reason=null, selected_route='pasted-transcript', updated_at=now()
where appearance_slug in (
  'microsoft-build-2025-satya-nadella-opening-keynote',
  'microsoft-build-2026-keynote'
);

insert into public.jobs(kind,stage,status,payload,idempotency_key,max_attempts)
values('seed-youtube-registry','seed-youtube-registry','queued','{}','registry:seed:verified-backfill-v1',3)
on conflict(idempotency_key) do update set
  status='queued', attempts=0, available_at=now(), locked_at=null, locked_by=null,
  completed_at=null, failure_code=null, message='Verified channel registry seed queued.', updated_at=now();

commit;
