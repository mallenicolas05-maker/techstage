update public.ingestion_candidates c set status='published', current_stage='publish-recheck', blocker_code=null, blocker_reason=null, requested_action=null, updated_at=now()
from public.appearances a
where c.resulting_appearance_id=a.id and a.status='published' and a.public_ready_at is not null;

update public.ingestion_candidates c set status='needs-review', current_stage='editorial-review',
  blocker_code=coalesce(c.blocker_code,'schema-evidence-validation-failed'),
  blocker_reason=coalesce(c.blocker_reason,'The appearance did not complete the verified publication package.'),
  requested_action=coalesce(c.requested_action,'Review the official source and retry the approved recovery route.'), updated_at=now()
from public.appearances a
where c.resulting_appearance_id=a.id and a.status in ('draft','review') and c.status not in ('archived','rejected');
