begin;

update public.discovery_runs
set estimated_usd=4.888908,
    message='40 canonical source decisions completed: 28 evidence-backed publications; 12 explicit blockers retained without fabrication. Seven four-panel Stage Notes issues generated. Conservative remaining-recovery projection stays below both $5 caps. Email delivery disabled.'
where kind='catalog-backfill-v1' and status='complete-with-blockers';

commit;
