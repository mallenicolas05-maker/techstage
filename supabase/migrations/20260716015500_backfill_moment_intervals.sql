-- Existing analysis rows sometimes omitted end timestamps. Complete those
-- intervals deterministically from the next moment or the recording duration.
with ordered as (
  select
    chapter.id,
    chapter.start_seconds,
    lead(chapter.start_seconds) over (
      partition by chapter.appearance_id
      order by chapter.start_seconds, chapter.position, chapter.id
    ) as next_start,
    coalesce(media.duration_seconds, appearance.duration_seconds) as duration_seconds
  from public.chapters chapter
  join public.appearances appearance on appearance.id = chapter.appearance_id
  left join public.media_sources media on media.id = appearance.canonical_source_id
)
update public.chapters chapter
set end_seconds = greatest(
  chapter.start_seconds + 1,
  least(
    coalesce(ordered.duration_seconds, ordered.start_seconds + 30),
    coalesce(ordered.next_start, ordered.start_seconds + 30)
  )
)
from ordered
where ordered.id = chapter.id
  and (chapter.end_seconds is null or chapter.end_seconds <= chapter.start_seconds);

with ordered as (
  select
    highlight.id,
    highlight.start_seconds,
    lead(highlight.start_seconds) over (
      partition by highlight.appearance_id
      order by highlight.start_seconds, highlight.id
    ) as next_start,
    coalesce(media.duration_seconds, appearance.duration_seconds) as duration_seconds
  from public.highlights highlight
  join public.appearances appearance on appearance.id = highlight.appearance_id
  left join public.media_sources media on media.id = appearance.canonical_source_id
)
update public.highlights highlight
set end_seconds = greatest(
  highlight.start_seconds + 1,
  least(
    coalesce(ordered.duration_seconds, ordered.start_seconds + 15),
    coalesce(ordered.next_start, ordered.start_seconds + 15)
  )
)
from ordered
where ordered.id = highlight.id
  and (highlight.end_seconds is null or highlight.end_seconds <= highlight.start_seconds);
