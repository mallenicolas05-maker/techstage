begin;

create or replace function public.infer_entity_prominence(
  requested_type text,
  requested_name text,
  requested_source_hint text default null,
  requested_context text default null
) returns integer
language plpgsql
immutable
set search_path=''
as $$
declare
  normalized text := lower(regexp_replace(coalesce(requested_name,''),'[^a-z0-9]+',' ','g'));
  score integer := 35;
begin
  if requested_type='company' then
    score := case
      when normalized in ('apple','microsoft','google','amazon','nvidia','openai') then 100
      when normalized in ('meta','tesla') then 99
      when normalized in ('anthropic','spacex') then 97
      when normalized in ('xai','google deepmind') then 96
      when normalized in ('palantir','amd') then 95
      when normalized in ('salesforce','oracle') then 94
      when normalized in ('stripe','airbnb','uber') then 93
      when normalized in ('adobe','intel','ibm','cisco') then 92
      when normalized in ('vercel','databricks','snowflake','cloudflare','figma') then 90
      when normalized in ('hugging face','perplexity','scale ai','mistral ai','cohere') then 88
      else score end;
  elsif requested_type='speaker' then
    score := case
      when normalized in ('elon musk','bill gates','sam altman') then 100
      when normalized in ('jensen huang','satya nadella','sundar pichai') then 99
      when normalized in ('tim cook','mark zuckerberg','jeff bezos') then 98
      when normalized in ('larry page','sergey brin','demis hassabis','dario amodei') then 97
      when normalized in ('ilya sutskever','mira murati','alex karp') then 95
      when normalized in ('andrew ng','fei fei li','lisa su','alexandr wang') then 93
      when normalized in ('yann lecun','geoffrey hinton','mustafa suleyman') then 92
      else score end;
  elsif requested_type='event' then
    score := case
      when normalized like '%apple wwdc%' or normalized='wwdc' then 100
      when normalized like '%google i o%' or normalized like '%nvidia gtc%' then 99
      when normalized like '%aws re invent%' or normalized like '%ces %' or normalized='ces' then 98
      when normalized like '%microsoft build%' then 97
      when normalized like '%dreamforce%' then 95
      when normalized like '%black hat%' or normalized like '%def con%' then 94
      when normalized like '%web summit%' or normalized like '%sxsw%' then 92
      else score end;
  end if;

  if coalesce(requested_source_hint,'') like 'appearance:%' then score := greatest(score,70); end if;
  if length(trim(coalesce(requested_context,'')))>0 then score := greatest(score,55); end if;
  return least(100,greatest(1,score));
end;
$$;

create or replace function public.assign_entity_candidate_prominence()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.prominence_score := greatest(
    coalesce(new.prominence_score,0),
    public.infer_entity_prominence(new.entity_type,new.name,new.source_hint,new.relationship_context)
  );
  return new;
end;
$$;

drop trigger if exists entity_candidates_automatic_prominence on public.entity_candidates;
create trigger entity_candidates_automatic_prominence
before insert or update of name,entity_type,source_hint,relationship_context,prominence_score
on public.entity_candidates
for each row execute function public.assign_entity_candidate_prominence();

update public.entity_candidates
set prominence_score=public.infer_entity_prominence(entity_type,name,source_hint,relationship_context);

update public.companies e
set prominence_score=greatest(e.prominence_score,public.infer_entity_prominence('company',e.name,null,null));
update public.speakers e
set prominence_score=greatest(e.prominence_score,public.infer_entity_prominence('speaker',e.name,null,null));
update public.events e
set prominence_score=greatest(e.prominence_score,public.infer_entity_prominence('event',e.name,null,null));

commit;
