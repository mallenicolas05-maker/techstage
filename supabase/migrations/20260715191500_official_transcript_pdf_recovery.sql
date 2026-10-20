begin;

update public.backfill_manifest
set source_url = 'https://msthesource.thesourcemediaassets.com/2025/12/Nadella_Mumbai-Microsoft-AI-Tour-FY26-Keynote_TRANSCRIPT_12122025.pdf',
    source_provider = 'company-site',
    status = 'queued',
    block_reason = null,
    selected_route = 'pasted-transcript',
    transcript_hint = true
where appearance_slug = 'satya-nadella-new-age-ai-mumbai';

update public.jobs
set status = 'queued', attempts = 0, available_at = now(), completed_at = null,
    locked_at = null, locked_by = null, failure_code = null, message = null
where kind = 'backfill-resolve'
  and payload->>'appearanceSlug' = 'satya-nadella-new-age-ai-mumbai';

commit;
