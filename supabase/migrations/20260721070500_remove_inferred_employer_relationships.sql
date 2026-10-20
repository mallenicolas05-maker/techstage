delete from public.speaker_companies
where role = 'Referenced in official appearance';

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
  select distinct on (appearance.event_id, apt.topic_id)
    appearance.event_id, apt.topic_id, appearance.id
  from appearances appearance
  join appearance_topics apt on apt.appearance_id = appearance.id
  where appearance.event_id is not null
  order by appearance.event_id, apt.topic_id, appearance.id
  on conflict (event_id, topic_id) do update
    set source_appearance_id = excluded.source_appearance_id;
end;
$$;
