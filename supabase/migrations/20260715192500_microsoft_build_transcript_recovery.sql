begin;

update public.backfill_manifest
set source_url = 'https://medius.microsoft.com/video/asset/Transcript/fa2a07ab-11ff-4f05-aec5-8e3756c29013?referrer=Microsoft+Build-%2Fen-US%2Fsessions%2FKEY010&mhid=build&loc=en-us',
    source_provider = 'company-site', status = 'queued', block_reason = null,
    selected_route = 'pasted-transcript', transcript_hint = true
where appearance_slug = 'microsoft-build-2025-satya-nadella-opening-keynote';

update public.backfill_manifest
set source_url = 'https://medius.microsoft.com/video/asset/Transcript/9b6fd85d-e64f-46a4-b8b2-23811087192f?referrer=Microsoft+Build-%2Fen-US%2Fsessions%2FKEY01&mhid=build&loc=en-us',
    source_provider = 'company-site', status = 'queued', block_reason = null,
    selected_route = 'pasted-transcript', transcript_hint = true
where appearance_slug = 'microsoft-build-2026-keynote';

update public.jobs
set status = 'queued', attempts = 0, available_at = now(), completed_at = null,
    locked_at = null, locked_by = null, failure_code = null, message = null
where kind = 'backfill-resolve'
  and payload->>'appearanceSlug' in (
    'microsoft-build-2025-satya-nadella-opening-keynote',
    'microsoft-build-2026-keynote'
  );

commit;
