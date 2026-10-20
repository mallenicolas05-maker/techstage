begin;

update public.discovery_runs
set status='complete-with-blockers',
    candidate_count=40,
    request_count=113,
    estimated_usd=3.229022,
    actual_usd=1.569136,
    completed_at=now(),
    message='40 canonical source decisions completed: 28 evidence-backed publications; 12 explicit blockers retained without fabrication. Seven four-panel Stage Notes issues generated. Email delivery disabled.'
where kind='catalog-backfill-v1' and status='running';

commit;
