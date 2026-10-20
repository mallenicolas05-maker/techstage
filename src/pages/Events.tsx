import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import { catalogRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { EntityImage } from "@/components/ui/EntityImage";
import { QueryHighlight } from "@/components/ui/QueryHighlight";
import { EmptyState, Pill, Skeleton, TabRow } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

const SORTS = ["Prominence", "Upcoming first", "Most recent", "A–Z"] as const;
type Sort = (typeof SORTS)[number];

export default function Events() {
  const [sort, setSort] = useState<Sort>("Prominence");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const events = useAsync(() => catalogRepo.listEvents(), []);
  const appearances = useAsync(() => catalogRepo.listAppearances(), []);
  const topics = useAsync(() => catalogRepo.listTopics(), []);

  const rows = useMemo(() => {
    let list = [...(events.data ?? [])];
    if (topicFilter)
      list = list.filter((event) =>
        (appearances.data ?? []).some(
          (appearance) =>
            appearance.eventId === event.id &&
            appearance.topicIds.includes(topicFilter),
        ),
      );
    if (query.trim())
      list = list.filter((event) =>
        `${event.title} ${event.description}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      );
    if (sort === "Prominence")
      list.sort(
        (a, b) =>
          (b.prominenceScore ?? 0) - (a.prominenceScore ?? 0) ||
          a.title.localeCompare(b.title),
      );
    if (sort === "A–Z") list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "Most recent")
      list.sort((a, b) => b.startDate.localeCompare(a.startDate));
    if (sort === "Upcoming first") {
      const now = new Date().toISOString();
      list.sort((a, b) => {
        const aUpcoming = a.endDate >= now;
        const bUpcoming = b.endDate >= now;
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
        return aUpcoming
          ? a.startDate.localeCompare(b.startDate)
          : b.startDate.localeCompare(a.startDate);
      });
    }
    return list;
  }, [appearances.data, events.data, query, sort, topicFilter]);

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="ts-paper -mx-4 border-b border-line px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
            Events on stage
          </p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
            Event directory
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            Keynotes, developer conferences, and interview series — every
            indexed stage in one place.
          </p>
        </div>
      </section>
      <div className="tech-frame dot-grid mx-auto mt-6 flex max-w-xl items-center border border-dotted border-ink/40 bg-paper">
        <Search className="ml-3 size-4 text-ink-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search events"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-xs outline-none"
        />
      </div>
      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Topics
        </p>
        <div className="mt-2 flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
          {(topics.data ?? []).map((topic) => (
            <Pill
              key={topic.id}
              active={topicFilter === topic.id}
              onClick={() =>
                setTopicFilter(topicFilter === topic.id ? null : topic.id)
              }
            >
              {topic.name}
            </Pill>
          ))}
        </div>
      </div>
      <div className="tech-frame dot-grid mt-6 flex flex-wrap items-center gap-3 border border-dotted border-ink/35 p-2">
        <TabRow tabs={SORTS} active={sort} onSelect={setSort} />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {rows.length} events
        </span>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
        {events.loading &&
          Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        {!events.loading && !rows.length && (
          <EmptyState className="col-span-full" title="No events match" />
        )}
        {rows.map((event) => (
          <article
            key={event.id}
            className="dot-grid group flex min-w-0 flex-col border border-dotted border-ink/40 bg-paper p-2.5 transition-colors hover:border-[var(--ts-acc)] hover:bg-[var(--ts-acc-15)] sm:p-4"
          >
            <Link to={`/events/${event.slug}`} className="min-w-0">
              <EntityImage
                entityType="event"
                entitySlug={event.slug}
                name={event.title}
                src={event.imageUrl}
                focalX={event.imageAttribution?.focalX}
                focalY={event.imageAttribution?.focalY}
                className="mx-auto size-24 sm:size-32"
              />
              <h2 className="mt-3 break-words text-center font-serif text-lg leading-tight sm:mt-4 sm:text-2xl">
                <QueryHighlight text={event.title} query={query} />
              </h2>
              <p className="mt-1 line-clamp-1 text-center font-mono text-[8px] uppercase tracking-widest text-ink-soft sm:text-[10px]">
                {event.organizer}
              </p>
              <p className="mt-3 hidden line-clamp-2 text-xs leading-relaxed text-ink-faint sm:block">
                {event.description}
              </p>
            </Link>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3 sm:pt-5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                {formatDate(event.startDate)}
              </span>
              <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                <MapPin className="size-3" />{" "}
                {event.isOnline ? "Online" : event.location}
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 border border-ink/25 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft transition-colors hover:border-ink"
        >
          Search the complete index <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </main>
  );
}
