import { Link, useParams } from "react-router-dom";
import { catalogRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { EntityImage } from "@/components/ui/EntityImage";
import { FollowButton } from "@/components/media/actions";
import {
  AppearanceRow,
  Rail,
  SectionHeader,
  SpeakerCard,
  TopicPillLink,
} from "@/components/media/cards";
import { EmptyState, RowSkeleton } from "@/components/ui/primitives";

export default function SpeakerProfile() {
  const { slug } = useParams<{ slug: string }>();
  const speaker = useAsync(() => catalogRepo.getSpeaker(slug!), [slug]);
  const catalog = useAsync(
    async () => ({
      appearances: await catalogRepo.listAppearances(),
      speakers: await catalogRepo.listSpeakers(),
      companies: await catalogRepo.listCompanies(),
      topics: await catalogRepo.listTopics(),
    }),
    [],
  );
  if (speaker.loading || catalog.loading)
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <RowSkeleton />
        <RowSkeleton className="mt-3" />
      </main>
    );
  const item = speaker.data;
  if (!item)
    return (
      <main className="mx-auto max-w-6xl px-4 pt-10">
        <EmptyState
          title="Speaker not found"
          hint="Only published speakers have public profiles."
        />
      </main>
    );
  const speakerTerms = [item.name.toLowerCase(), item.name.split(/\s+/).at(-1)?.toLowerCase()]
    .filter((term): term is string => Boolean(term && term.length > 2));
  const appearances = (catalog.data?.appearances ?? [])
    .filter((row) => {
      if (!row.speakerIds.includes(item.id)) return false;
      const evidence = `${row.title} ${row.description}`.toLowerCase();
      return speakerTerms.some((term) => evidence.includes(term));
    })
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  const topicIds = [
    ...new Set([
      ...item.topicIds,
      ...appearances.flatMap((row) => row.topicIds),
    ]),
  ];
  const companyIds = [
    ...new Set([
      ...item.companyIds,
    ]),
  ];
  const companies = (catalog.data?.companies ?? []).filter((row) =>
    companyIds.includes(row.id),
  );
  const relatedIds = new Set(
    appearances.flatMap((appearance) => appearance.speakerIds),
  );
  relatedIds.delete(item.id);
  const related = (catalog.data?.speakers ?? [])
    .filter((row) => relatedIds.has(row.id))
    .slice(0, 6);
  return (
    <main>
      <section className="ts-paper border-b border-line px-4 py-10">
        <div className="mx-auto grid max-w-6xl items-center gap-7 lg:grid-cols-[15rem_1fr]">
          <EntityImage
            entityType="speaker"
            entitySlug={item.slug}
            name={item.name}
            src={item.avatarUrl}
            focalX={item.imageAttribution?.focalX}
            focalY={item.imageAttribution?.focalY}
            eager
            className="mx-auto size-60 lg:mx-0"
          />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-5xl">{item.name}</h1>
              <FollowButton kind="speaker" id={item.id} />
            </div>
            <p className="mt-2 font-mono text-sm text-ink-soft">
              {item.headline}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-ink-soft">
              {item.biography}
            </p>
            {companies.length > 0 && (
              <div className="mt-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-faint">
                  Companies
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {companies.map((company) => (
                    <Link
                      key={company.id}
                      to={`/companies/${company.slug}`}
                      className="border border-dotted border-ink/40 px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft"
                    >
                      {company.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-faint">
                Topics
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {topicIds.map((id) => (
                  <TopicPillLink
                    key={id}
                    topicId={id}
                    topic={(catalog.data?.topics ?? []).find((row) => row.id === id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4">
        <section className="pt-10">
          <SectionHeader
            title="Public appearances"
            count={appearances.length}
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {appearances.length ? (
              appearances.map((appearance) => (
                <AppearanceRow key={appearance.id} a={appearance} />
              ))
            ) : (
              <EmptyState
                title="No public recordings linked yet"
                hint="TechStage will show verified appearances here as they are added."
              />
            )}
          </div>
        </section>
        <section className="pt-12">
          <SectionHeader title="Related speakers" />
          <Rail className="mt-4 gap-3">
            {related.map((row) => (
              <SpeakerCard key={row.id} s={row} />
            ))}
          </Rail>
        </section>
      </div>
    </main>
  );
}
