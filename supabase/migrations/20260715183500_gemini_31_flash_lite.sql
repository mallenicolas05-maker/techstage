begin;

update public.prompt_versions
set model = 'gemini-3.1-flash-lite'
where id in ('analysis-v2-transcript', 'analysis-v2-youtube', 'digest-v2-four-panel');

update public.discovery_runs
set pricing_snapshot = jsonb_build_object(
  'geminiModel', 'gemini-3.1-flash-lite',
  'geminiStandard', jsonb_build_object(
    'textImageVideoInputPerMillionUsd', 0.25,
    'audioInputPerMillionUsd', 0.50,
    'outputPerMillionUsd', 1.50
  ),
  'geminiCapUsd', 5,
  'xaiModel', 'grok-4.3',
  'xSearchPerCallUsd', 0.005,
  'xaiCapUsd', 5,
  'reason', 'Gemini 2.5 Flash-Lite is unavailable to new API users; migrated to the official 3.1 Flash-Lite successor.'
)
where kind = 'catalog-backfill-v1';

commit;
