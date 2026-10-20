create or replace function internal.appearance_is_public_ready(appearance_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.appearances a join public.media_sources m on m.id=a.canonical_source_id
    where a.id=appearance_uuid and a.status='published' and a.rights_status='embed-allowed'
      and m.canonical=true and m.embed_allowed=true and m.rights_status='embed-allowed'
      and m.embed_url ~ '^https://www[.]youtube-nocookie[.]com/embed/[A-Za-z0-9_-]{11}'
      and exists(select 1 from public.analysis_artifacts aa where aa.appearance_id=a.id)
      and exists(select 1 from public.chapters c where c.appearance_id=a.id)
      and exists(select 1 from public.highlights h where h.appearance_id=a.id)
      and exists(select 1 from public.appearance_speakers s where s.appearance_id=a.id)
      and exists(select 1 from public.appearance_companies co where co.appearance_id=a.id)
      and exists(select 1 from public.appearance_topics t where t.appearance_id=a.id)
  );
$$;

update public.appearances a set status='published', published_at=coalesce(published_at,now()), updated_at=now()
where a.status='review' and a.rights_status='embed-allowed'
  and exists(select 1 from public.media_sources m where m.id=a.canonical_source_id and m.canonical and m.embed_allowed and m.rights_status='embed-allowed' and m.embed_url ~ '^https://www[.]youtube-nocookie[.]com/embed/[A-Za-z0-9_-]{11}')
  and exists(select 1 from public.analysis_artifacts aa where aa.appearance_id=a.id)
  and exists(select 1 from public.chapters c where c.appearance_id=a.id)
  and exists(select 1 from public.highlights h where h.appearance_id=a.id)
  and exists(select 1 from public.appearance_speakers s where s.appearance_id=a.id)
  and exists(select 1 from public.appearance_companies co where co.appearance_id=a.id)
  and exists(select 1 from public.appearance_topics t where t.appearance_id=a.id);
update public.appearances a set public_ready_at=case when internal.appearance_is_public_ready(a.id) then now() else null end;

create or replace function public.sync_public_readiness_from_appearance()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if pg_trigger_depth()>1 then return new; end if;
  if new.status='published' then perform public.refresh_appearance_public_readiness(new.id); end if;
  return new;
end $$;
drop trigger if exists appearances_sync_public_readiness on public.appearances;
create trigger appearances_sync_public_readiness after insert or update of status,canonical_source_id,rights_status on public.appearances for each row execute function public.sync_public_readiness_from_appearance();

create or replace function public.sync_public_readiness_from_child()
returns trigger language plpgsql security definer set search_path='' as $$
declare appearance_uuid uuid;
begin
  if TG_OP='DELETE' then appearance_uuid:=old.appearance_id; else appearance_uuid:=new.appearance_id; end if;
  if appearance_uuid is not null then perform public.refresh_appearance_public_readiness(appearance_uuid); end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists media_sync_public_readiness on public.media_sources;
create trigger media_sync_public_readiness after insert or update or delete on public.media_sources for each row execute function public.sync_public_readiness_from_child();
drop trigger if exists chapters_sync_public_readiness on public.chapters;
create trigger chapters_sync_public_readiness after insert or update or delete on public.chapters for each row execute function public.sync_public_readiness_from_child();
drop trigger if exists highlights_sync_public_readiness on public.highlights;
create trigger highlights_sync_public_readiness after insert or update or delete on public.highlights for each row execute function public.sync_public_readiness_from_child();
drop trigger if exists artifacts_sync_public_readiness on public.analysis_artifacts;
create trigger artifacts_sync_public_readiness after insert or update or delete on public.analysis_artifacts for each row execute function public.sync_public_readiness_from_child();
drop trigger if exists speakers_sync_public_readiness on public.appearance_speakers;
create trigger speakers_sync_public_readiness after insert or update or delete on public.appearance_speakers for each row execute function public.sync_public_readiness_from_child();
drop trigger if exists companies_sync_public_readiness on public.appearance_companies;
create trigger companies_sync_public_readiness after insert or update or delete on public.appearance_companies for each row execute function public.sync_public_readiness_from_child();
drop trigger if exists topics_sync_public_readiness on public.appearance_topics;
create trigger topics_sync_public_readiness after insert or update or delete on public.appearance_topics for each row execute function public.sync_public_readiness_from_child();
