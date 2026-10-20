-- Owner-approved records may be restored or activated even after a campaign
-- reaches its discovery ceiling. They still count toward the ceiling, so new
-- discoveries remain stopped; they are simply never archived by an UPDATE.
create or replace function public.quarantine_generated_entity_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.stable_slug) ~ '^technology-(company|speaker)-[0-9]+$'
     or lower(new.name) ~ '^technology (company|speaker) [0-9]+$' then
    new.status := 'archived';
    new.relationship_context := 'Archived automatically: generated placeholder identity.';
    return new;
  end if;

  if new.status not in ('archived', 'rejected', 'activated') and (
    select count(*) from public.entity_candidates existing
    where existing.entity_type = new.entity_type
      and existing.id is distinct from new.id
      and existing.status not in ('archived', 'rejected')
  ) >= 500 then
    new.status := 'archived';
    new.relationship_context := 'Archived automatically: entity-type campaign ceiling reached.';
  end if;
  return new;
end;
$$;
