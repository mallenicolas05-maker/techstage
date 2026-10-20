with chapter_stats as (
  select appearance_id, count(*) as total, count(distinct start_seconds) as distinct_starts
  from public.chapters
  group by appearance_id
), highlight_stats as (
  select appearance_id, count(*) as total, count(distinct start_seconds) as distinct_starts
  from public.highlights
  group by appearance_id
), unsupported as (
  select appearance.id
  from public.appearances appearance
  left join chapter_stats chapter on chapter.appearance_id = appearance.id
  left join highlight_stats highlight on highlight.appearance_id = appearance.id
  where appearance.public_ready_at is not null
    and (
      (coalesce(chapter.total, 0) >= 2 and coalesce(chapter.distinct_starts, 0) <= 1)
      or
      (coalesce(highlight.total, 0) >= 2 and coalesce(highlight.distinct_starts, 0) <= 1)
    )
)
update public.appearances appearance
set status = 'review',
    public_ready_at = null,
    updated_at = now()
from unsupported
where appearance.id = unsupported.id;
