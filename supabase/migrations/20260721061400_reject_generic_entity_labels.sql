create or replace function public.quarantine_generated_entity_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.stable_slug) ~ '^technology-(company|speaker)-[0-9]+$'
     or lower(new.name) ~ '^technology (company|speaker) [0-9]+$'
     or lower(trim(new.name)) in ('not specified', 'big tech', 'technology company', 'technology speaker')
     or lower(trim(new.name)) ~ '^tech(core|stream) (systems|solutions)$' then
    new.status := 'archived';
    new.relationship_context := 'Archived automatically: generic label is not a verified entity identity.';
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

update public.entity_candidates
set status = 'archived',
    relationship_context = 'Archived automatically: generic label is not a verified entity identity.',
    updated_at = now()
where status not in ('archived', 'rejected', 'activated')
  and (
    lower(stable_slug) ~ '^technology-(company|speaker)-[0-9]+$'
    or lower(name) ~ '^technology (company|speaker) [0-9]+$'
    or lower(trim(name)) in ('not specified', 'big tech', 'technology company', 'technology speaker')
    or lower(trim(name)) ~ '^tech(core|stream) (systems|solutions)$'
  );
