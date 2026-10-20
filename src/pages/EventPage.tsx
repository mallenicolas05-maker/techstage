import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { catalogRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import {
  AppearanceCard,
  AppearanceRow,
  Rail,
  SectionHeader,
  SpeakerCard,
  TopicPillLink,
} from "@/components/media/cards";
import { EmptyState, RowSkeleton } from "@/components/ui/primitives";
import { EntityImage } from "@/components/ui/EntityImage";
import { formatDate } from "@/lib/format";

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = useAsync(() => catalogRepo.getEvent(slug!), [slug]);
  const catalog = useAsync(
    async () => ({
      appearances: await catalogRepo.listAppearances(),
      speakers: await catalogRepo.listSpeakers(),
      events: await catalogRepo.listEvents(),
      topics: await catalogRepo.listTopics(),
    }),
    [],
  );
  if (event.loading || catalog.loading)
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <RowSkeleton />
        <RowSkeleton className="mt-3" />
      </main>
    );
  const item = event.data;
  if (!item)
    return (
      <main className="mx-auto max-w-6xl px-4 pt-10">
        <EmptyState
          title="Event not found"
          hint="Only published events have public profiles."
        />
      </main>
    );
  const sessions = (catalog.data?.appearances ?? [])
    .filter((row) => row.eventId === item.id)
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  const speakerIds = [...new Set(sessions.flatMap((row) => row.speakerIds))];
  const speakers = (catalog.data?.speakers ?? []).filter((row) =>
    speakerIds.includes(row.id),
  );
  const topicIds = [
    ...new Set([
      ...((item as typeof item & { topicIds?: string[] }).topicIds ?? []),
      ...sessions.flatMap((row) => row.topicIds),
    ]),
  ];
  const relatedEventIds = new Set(
    (catalog.data?.appearances ?? [])
      .filter(
        (appearance) =>
          appearance.eventId &&
          appearance.eventId !== item.id &&
          appearance.topicIds.some((id) => topicIds.includes(id)),
      )
      .map((appearance) => appearance.eventId!),
  );
  const related = (catalog.data?.events ?? [])
    .filter((row) => relatedEventIds.has(row.id))
    .slice(0, 6);
  return (
    <main>
      <section className="ts-paper border-b border-line px-4 py-10">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_20rem]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
              Event profile
            </p>
            <h1 className="mt-3 font-serif text-5xl">{item.title}</h1>
            <p className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] text-ink-faint">
              <span>{formatDate(item.startDate)}</span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />{" "}
                {item.isOnline ? "Online" : item.location}
              </span>
            </p>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
              {item.description}
            </p>
            {item.eventUrl && (
              <a
                href={item.eventUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 border border-ink/25 bg-paper px-3 py-2 font-mono text-[10px] uppercase tracking-widest"
              >
                Event site <ArrowUpRight className="size-3" />
              </a>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {topicIds.map((id) => (
                <TopicPillLink
                  key={id}
                  topicId={id}
                  topic={(catalog.data?.topics ?? []).find((row) => row.id === id)}
                />
              ))}
            </div>
          </div>
          <EntityImage
            entityType="event"
            entitySlug={item.slug}
            name={item.title}
            src={item.imageUrl}
            focalX={item.imageAttribution?.focalX}
            focalY={item.imageAttribution?.focalY}
            eager
            className="mx-auto size-64"
          />
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4">
        <section className="pt-10">
          <SectionHeader title="Available recordings" count={sessions.length} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.length ? (
              sessions.map((row) => (
                <AppearanceCard key={row.id} a={row} className="w-full" />
              ))
            ) : (
              <EmptyState
                className="col-span-full"
                title="No public recordings linked yet"
                hint="TechStage will show verified recordings here as they are added."
              />
            )}
          </div>
        </section>
        <section className="pt-10">
          <SectionHeader title="Recent sessions" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {sessions.slice(0, 6).map((row) => (
              <AppearanceRow key={row.id} a={row} />
            ))}
          </div>
        </section>
        <section className="pt-10">
          <SectionHeader title="Speakers" />
          <Rail className="mt-4 gap-3">
            {speakers.map((speaker) => (
              <SpeakerCard key={speaker.id} s={speaker} />
            ))}
          </Rail>
        </section>
        <section className="pt-12">
          <SectionHeader title="Related events" />
          <Rail className="mt-4 gap-3">
            {related.map((row) => (
              <Link
                key={row.id}
                to={`/events/${row.slug}`}
                className="flex min-h-28 w-64 flex-col border border-line bg-paper p-5 hover:border-[var(--ts-acc)]"
              >
                <span className="font-serif text-2xl">{row.title}</span>
                <span className="mt-auto pt-4 text-xs text-ink-faint">
                  {row.description}
                </span>
              </Link>
            ))}
          </Rail>
        </section>
      </div>
    </main>
  );
}
