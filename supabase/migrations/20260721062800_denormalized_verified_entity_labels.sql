alter table public.appearance_speakers add column if not exists speaker_name text;
alter table public.appearance_companies add column if not exists company_name text;
alter table public.appearances add column if not exists event_name text;

update public.appearance_speakers relation
set speaker_name = speaker.name
from public.speakers speaker
where speaker.id = relation.speaker_id
  and relation.speaker_name is distinct from speaker.name;

update public.appearance_companies relation
set company_name = company.name
from public.companies company
where company.id = relation.company_id
  and relation.company_name is distinct from company.name;

update public.appearances appearance
set event_name = event.name
from public.events event
where event.id = appearance.event_id
  and appearance.event_name is distinct from event.name;

create or replace function public.fill_appearance_speaker_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select name into new.speaker_name from speakers where id = new.speaker_id;
  return new;
end;
$$;

create or replace function public.fill_appearance_company_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select name into new.company_name from companies where id = new.company_id;
  return new;
end;
$$;

create or replace function public.fill_appearance_event_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event_id is null then
    new.event_name := null;
  else
    select name into new.event_name from events where id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists fill_appearance_speaker_name on public.appearance_speakers;
create trigger fill_appearance_speaker_name
before insert or update of speaker_id on public.appearance_speakers
for each row execute function public.fill_appearance_speaker_name();

drop trigger if exists fill_appearance_company_name on public.appearance_companies;
create trigger fill_appearance_company_name
before insert or update of company_id on public.appearance_companies
for each row execute function public.fill_appearance_company_name();

drop trigger if exists fill_appearance_event_name on public.appearances;
create trigger fill_appearance_event_name
before insert or update of event_id on public.appearances
for each row execute function public.fill_appearance_event_name();
