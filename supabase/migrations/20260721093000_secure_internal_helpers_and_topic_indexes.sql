-- Keep internal trigger and refresh helpers inaccessible to public API roles.
revoke execute on function public.assign_entity_candidate_prominence() from public, anon, authenticated;
revoke execute on function public.fill_appearance_company_name() from public, anon, authenticated;
revoke execute on function public.fill_appearance_event_name() from public, anon, authenticated;
revoke execute on function public.fill_appearance_speaker_name() from public, anon, authenticated;
revoke execute on function public.refresh_entity_relationships_trigger() from public, anon, authenticated;
revoke execute on function public.refresh_live_entity_relationships() from public, anon, authenticated;

-- Support profile/topic joins without full scans as the live catalog grows.
create index if not exists company_topics_source_appearance_id_idx
  on public.company_topics (source_appearance_id);
create index if not exists company_topics_topic_id_idx
  on public.company_topics (topic_id);

create index if not exists event_topics_source_appearance_id_idx
  on public.event_topics (source_appearance_id);
create index if not exists event_topics_topic_id_idx
  on public.event_topics (topic_id);

create index if not exists speaker_topics_source_appearance_id_idx
  on public.speaker_topics (source_appearance_id);
create index if not exists speaker_topics_topic_id_idx
  on public.speaker_topics (topic_id);
