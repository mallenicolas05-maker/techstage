begin;

update public.backfill_manifest
set source_url = 'https://www.youtube.com/watch?v=wLb9g_8r-mE',
    source_provider = 'youtube',
    status = 'queued',
    block_reason = null,
    selected_route = 'youtube-video',
    transcript_hint = false
where appearance_slug = 'stripe-sessions-2025-jony-ive';

update public.backfill_manifest
set status = 'queued',
    block_reason = null,
    selected_route = 'pasted-transcript',
    transcript_hint = true
where appearance_slug = 'stripe-sessions-2025-collison-ama';

update public.backfill_manifest
set source_url = 'https://www.youtube.com/watch?v=YqYpYN4yClg',
    source_provider = 'youtube',
    status = 'queued',
    block_reason = null,
    selected_route = 'youtube-video',
    transcript_hint = false
where appearance_slug = 'microsoft-ai-tour-madrid-2026-plenary';

update public.jobs j
set status = 'queued', attempts = 0, available_at = now(), completed_at = null,
    locked_at = null, locked_by = null, failure_code = null, message = null
where j.kind = 'backfill-resolve'
  and j.payload->>'appearanceSlug' in (
    'stripe-sessions-2025-jony-ive',
    'stripe-sessions-2025-collison-ama',
    'microsoft-ai-tour-madrid-2026-plenary'
  );

commit;
