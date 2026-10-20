create table if not exists public.speaker_topics (
  speaker_id uuid not null references public.speakers(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_appearance_id uuid references public.appearances(id) on delete set null,
  evidence_source_url text,
  created_at timestamptz not null default now(),
  primary key (speaker_id, topic_id),
  check (source_appearance_id is not null or evidence_source_url is not null)
);

create table if not exists public.company_topics (
  company_id uuid not null references public.companies(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_appearance_id uuid references public.appearances(id) on delete set null,
  evidence_source_url text,
  created_at timestamptz not null default now(),
  primary key (company_id, topic_id),
  check (source_appearance_id is not null or evidence_source_url is not null)
);

create table if not exists public.event_topics (
  event_id uuid not null references public.events(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_appearance_id uuid references public.appearances(id) on delete set null,
  evidence_source_url text,
  created_at timestamptz not null default now(),
  primary key (event_id, topic_id),
  check (source_appearance_id is not null or evidence_source_url is not null)
);

alter table public.speaker_topics enable row level security;
alter table public.company_topics enable row level security;
alter table public.event_topics enable row level security;
alter table public.speaker_companies enable row level security;

drop policy if exists "public reads speaker topics" on public.speaker_topics;
create policy "public reads speaker topics" on public.speaker_topics for select using (true);
drop policy if exists "public reads company topics" on public.company_topics;
create policy "public reads company topics" on public.company_topics for select using (true);
drop policy if exists "public reads event topics" on public.event_topics;
create policy "public reads event topics" on public.event_topics for select using (true);
drop policy if exists "public reads speaker companies" on public.speaker_companies;
create policy "public reads speaker companies" on public.speaker_companies for select using (true);

create or replace function public.refresh_live_entity_relationships()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into speaker_topics (speaker_id, topic_id, source_appearance_id)
  select distinct on (aps.speaker_id, apt.topic_id)
    aps.speaker_id, apt.topic_id, aps.appearance_id
  from appearance_speakers aps
  join appearance_topics apt on apt.appearance_id = aps.appearance_id
  order by aps.speaker_id, apt.topic_id, aps.appearance_id
  on conflict (speaker_id, topic_id) do update
    set source_appearance_id = excluded.source_appearance_id;

  insert into company_topics (company_id, topic_id, source_appearance_id)
  select distinct on (apc.company_id, apt.topic_id)
    apc.company_id, apt.topic_id, apc.appearance_id
  from appearance_companies apc
  join appearance_topics apt on apt.appearance_id = apc.appearance_id
  order by apc.company_id, apt.topic_id, apc.appearance_id
  on conflict (company_id, topic_id) do update
    set source_appearance_id = excluded.source_appearance_id;

  insert into event_topics (event_id, topic_id, source_appearance_id)
  select distinct on (a.event_id, apt.topic_id)
    a.event_id, apt.topic_id, a.id
  from appearances a
  join appearance_topics apt on apt.appearance_id = a.id
  where a.event_id is not null
  order by a.event_id, apt.topic_id, a.id
  on conflict (event_id, topic_id) do update
    set source_appearance_id = excluded.source_appearance_id;

  insert into speaker_companies (speaker_id, company_id, role)
  select distinct on (aps.speaker_id, apc.company_id)
    aps.speaker_id, apc.company_id, 'Referenced in official appearance'
  from appearance_speakers aps
  join appearance_companies apc on apc.appearance_id = aps.appearance_id
  order by aps.speaker_id, apc.company_id, aps.appearance_id
  on conflict (speaker_id, company_id, role) do nothing;
end;
$$;

select public.refresh_live_entity_relationships();

with verified_company_topics(company_slug, topic_slug) as (
  values
    ('openai','ai-agents'), ('openai','multimodal-ai'), ('openai','ai-safety'),
    ('anthropic','ai-agents'), ('anthropic','ai-safety'),
    ('nvidia','chips'), ('nvidia','inference'), ('nvidia','robotics'),
    ('microsoft','ai-agents'), ('microsoft','developer-tools'), ('microsoft','data-infrastructure'),
    ('google','ai-agents'), ('google','multimodal-ai'), ('google','inference'),
    ('apple','chips'), ('apple','developer-tools'), ('apple','ai-agents'),
    ('meta','open-source-models'), ('meta','multimodal-ai'), ('meta','ai-agents'),
    ('amazon','data-infrastructure'), ('amazon','ai-agents'), ('amazon','robotics'),
    ('tesla','autonomous-vehicles'), ('tesla','energy'), ('tesla','robotics'),
    ('xai','ai-agents'), ('xai','inference'),
    ('amd','chips'), ('amd','inference'),
    ('qualcomm','chips'), ('qualcomm','inference'),
    ('ibm','ai-agents'), ('ibm','data-infrastructure'), ('ibm','quantum-computing'),
    ('salesforce','ai-agents'), ('salesforce','data-infrastructure'),
    ('stripe','developer-tools'), ('stripe','data-infrastructure'),
    ('palantir','data-infrastructure'), ('palantir','defense-technology'), ('palantir','ai-agents'),
    ('anduril','defense-technology'), ('anduril','robotics'),
    ('andreessen-horowitz','venture-capital'), ('andreessen-horowitz','ai-agents'),
    ('block','developer-tools'), ('block','data-infrastructure')
)
insert into company_topics (company_id, topic_id, evidence_source_url)
select c.id, t.id, c.website_url
from verified_company_topics v
join companies c on c.slug = v.company_slug and c.website_url is not null
join topics t on t.slug = v.topic_slug
on conflict (company_id, topic_id) do update
  set evidence_source_url = excluded.evidence_source_url;

create or replace function public.refresh_entity_relationships_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_live_entity_relationships();
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_entity_relationships_from_speakers on public.appearance_speakers;
create trigger refresh_entity_relationships_from_speakers
after insert or update on public.appearance_speakers
for each statement execute function public.refresh_entity_relationships_trigger();

drop trigger if exists refresh_entity_relationships_from_companies on public.appearance_companies;
create trigger refresh_entity_relationships_from_companies
after insert or update on public.appearance_companies
for each statement execute function public.refresh_entity_relationships_trigger();

drop trigger if exists refresh_entity_relationships_from_topics on public.appearance_topics;
create trigger refresh_entity_relationships_from_topics
after insert or update on public.appearance_topics
for each statement execute function public.refresh_entity_relationships_trigger();
