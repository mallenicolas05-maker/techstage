-- Keep the expansion campaign useful without allowing generic filler into
-- Admin or the public catalog.  Editorial descriptions are deliberately
-- separate from discovery context: the latter is operational metadata and
-- must never become public copy.
alter table public.entity_candidates
  add column if not exists factual_description text,
  add column if not exists prominence_score integer not null default 0
    check (prominence_score between 0 and 100);

alter table public.companies
  add column if not exists prominence_score integer not null default 0
    check (prominence_score between 0 and 100);
alter table public.speakers
  add column if not exists prominence_score integer not null default 0
    check (prominence_score between 0 and 100);
alter table public.events
  add column if not exists prominence_score integer not null default 0
    check (prominence_score between 0 and 100);

alter table public.manual_submissions
  add column if not exists reference_brief text check (length(reference_brief) <= 50000);

-- Archive the already-observed generated names.  This is intentionally narrow
-- so genuine technology-named organizations or events are unaffected.
update public.entity_candidates
set status = 'archived',
    relationship_context = 'Archived automatically: generated placeholder identity.',
    updated_at = now()
where source_hint = 'curated refill'
  and (
    lower(stable_slug) ~ '^technology-(company|speaker)-[0-9]+$'
    or lower(name) ~ '^technology (company|speaker) [0-9]+$'
  );

create or replace function public.quarantine_generated_entity_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.stable_slug) ~ '^technology-(company|speaker)-[0-9]+$'
     or lower(new.name) ~ '^technology (company|speaker) [0-9]+$' then
    new.status := 'archived';
    new.relationship_context := 'Archived automatically: generated placeholder identity.';
  end if;

  -- The total includes staged candidates, so a campaign cannot quietly exceed
  -- the 500-per-type ceiling before editorial review catches up.
  if new.status not in ('archived', 'rejected') and (
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

drop trigger if exists entity_candidates_quarantine_generated on public.entity_candidates;
create trigger entity_candidates_quarantine_generated
before insert or update of name, stable_slug, entity_type, status on public.entity_candidates
for each row execute function public.quarantine_generated_entity_candidate();

create index if not exists entity_candidates_prominence_idx
  on public.entity_candidates(entity_type, status, prominence_score desc, name asc);

create or replace function public.require_public_digest_appearance()
returns trigger language plpgsql security definer set search_path = public, internal as $$
begin
  if not internal.appearance_is_public_ready(new.appearance_id) then
    raise exception 'Stage Notes panels require a public-ready appearance';
  end if;
  return new;
end;
$$;

drop trigger if exists digest_panels_require_public_appearance on public.digest_panels;
create trigger digest_panels_require_public_appearance
before insert or update of appearance_id on public.digest_panels
for each row execute function public.require_public_digest_appearance();
