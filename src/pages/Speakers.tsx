import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { catalogRepo } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { useAppState } from "@/state/AppState";
import { EntityImage } from "@/components/ui/EntityImage";
import { QueryHighlight } from "@/components/ui/QueryHighlight";
import { FollowButton } from "@/components/media/actions";
import {
  EmptyState,
  Modal,
  Pill,
  RowSkeleton,
  TabRow,
} from "@/components/ui/primitives";
import { companyName, topicName } from "@/data/lookup";
import type { Speaker } from "@/domain/types";

const SORTS = ["Prominence", "Recently active", "A–Z", "Following"] as const;
type Sort = (typeof SORTS)[number];

export default function Speakers() {
  const [sort, setSort] = useState<Sort>("Prominence");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [preview, setPreview] = useState<Speaker | null>(null);
  const { isFollowing } = useAppState();
  const speakers = useAsync(() => catalogRepo.listSpeakers(), []);
  const topics = useAsync(() => catalogRepo.listTopics(), []);
  const companies = useAsync(() => catalogRepo.listCompanies(), []);
  const appearances = useAsync(() => catalogRepo.listAppearances(), []);

  const lastActive = useMemo(() => {
    const map = new Map<string, string>();
    for (const appearance of appearances.data ?? [])
      for (const id of appearance.speakerIds)
        if ((map.get(id) ?? "") < appearance.scheduledStart)
          map.set(id, appearance.scheduledStart);
    return map;
  }, [appearances.data]);
  const relationships = useMemo(() => {
    const topicsBySpeaker = new Map<string, Set<string>>();
    const companiesBySpeaker = new Map<string, Set<string>>();
    for (const appearance of appearances.data ?? [])
      for (const speakerId of appearance.speakerIds) {
        const topicIds = topicsBySpeaker.get(speakerId) ?? new Set<string>();
        appearance.topicIds.forEach((id) => topicIds.add(id));
        topicsBySpeaker.set(speakerId, topicIds);
        const companyIds =
          companiesBySpeaker.get(speakerId) ?? new Set<string>();
        appearance.companyIds.forEach((id) => companyIds.add(id));
        companiesBySpeaker.set(speakerId, companyIds);
      }
    return { topicsBySpeaker, companiesBySpeaker };
  }, [appearances.data]);
  const rows = useMemo(() => {
    let list = [...(speakers.data ?? [])];
    if (topicFilter)
      list = list.filter((speaker) =>
        relationships.topicsBySpeaker.get(speaker.id)?.has(topicFilter),
      );
    if (companyFilter)
      list = list.filter((speaker) =>
        relationships.companiesBySpeaker.get(speaker.id)?.has(companyFilter),
      );
    if (query.trim())
      list = list.filter((speaker) =>
        `${speaker.name} ${speaker.headline} ${speaker.biography}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      );
    if (sort === "Prominence")
      list.sort(
        (a, b) =>
          (b.prominenceScore ?? 0) - (a.prominenceScore ?? 0) ||
          a.name.localeCompare(b.name),
      );
    if (sort === "Recently active")
      list.sort((a, b) =>
        (lastActive.get(b.id) ?? "").localeCompare(lastActive.get(a.id) ?? ""),
      );
    if (sort === "A–Z") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "Following")
      list = list.filter((speaker) => isFollowing("speaker", speaker.id));
    return list;
  }, [
    speakers.data,
    topicFilter,
    companyFilter,
    query,
    sort,
    lastActive,
    isFollowing,
    relationships,
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="ts-paper -mx-4 border-b border-line px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
            People on stage
          </p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
            Speaker directory
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            Meet technology leaders across different fields, then preview their
            work before opening a full profile.
          </p>
        </div>
      </section>
      <div className="tech-frame dot-grid mx-auto mt-6 flex max-w-xl items-center border border-dotted border-ink/40 bg-paper">
        <Search className="ml-3 size-4 text-ink-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search speakers"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-xs outline-none"
        />
      </div>
      <div className="mt-5 space-y-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
            Expertise
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
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
            Company
          </p>
          <div className="mt-2 flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
            {(companies.data ?? []).map((company) => (
              <Pill
                key={company.id}
                active={companyFilter === company.id}
                onClick={() =>
                  setCompanyFilter(
                    companyFilter === company.id ? null : company.id,
                  )
                }
              >
                {company.name}
              </Pill>
            ))}
          </div>
        </div>
      </div>
      <div className="tech-frame dot-grid mt-6 flex flex-wrap items-center gap-3 border border-dotted border-ink/35 p-2">
        <TabRow tabs={SORTS} active={sort} onSelect={setSort} />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {rows.length} speakers
        </span>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
        {speakers.loading &&
          Array.from({ length: 8 }, (_, index) => <RowSkeleton key={index} />)}
        {!speakers.loading && !rows.length && (
          <EmptyState
            className="col-span-2 md:col-span-3 xl:col-span-4"
            title="No speakers match"
          />
        )}
        {rows.map((speaker) => (
          <article
            key={speaker.id}
            className="dot-grid group flex min-w-0 flex-col border border-dotted border-ink/40 bg-paper p-2.5 transition-colors hover:border-[var(--ts-acc)] hover:bg-[var(--ts-acc-15)] sm:p-4"
          >
            <button
              onClick={() => setPreview(speaker)}
              className="min-w-0 cursor-pointer text-left"
            >
              <EntityImage
                entityType="speaker"
                entitySlug={speaker.slug}
                name={speaker.name}
                src={speaker.avatarUrl}
                focalX={speaker.imageAttribution?.focalX}
                focalY={speaker.imageAttribution?.focalY}
                className="mx-auto size-24 sm:size-32"
              />
              <h2 className="mt-3 break-words font-serif text-lg leading-tight sm:mt-4 sm:text-2xl">
                <QueryHighlight text={speaker.name} query={query} />
              </h2>
              <p className="mt-1 line-clamp-2 font-mono text-[8px] leading-relaxed text-ink-soft sm:text-[10px]">
                {speaker.headline}
              </p>
              <p className="mt-3 hidden line-clamp-2 text-xs leading-relaxed text-ink-faint sm:block">
                {speaker.biography}
              </p>
            </button>
            <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-5">
              <span className="hidden font-mono text-[9px] uppercase tracking-widest text-ink-faint sm:block">
                {[...(relationships.topicsBySpeaker.get(speaker.id) ?? [])].slice(0, 2).map(topicName).join(" · ")}
              </span>
              <FollowButton kind="speaker" id={speaker.id} size="sm" />
            </div>
          </article>
        ))}
      </div>
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Speaker preview"
        className="sm:max-w-2xl"
      >
        {preview && (
          <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
            <EntityImage
              entityType="speaker"
              entitySlug={preview.slug}
              name={preview.name}
              src={preview.avatarUrl}
              focalX={preview.imageAttribution?.focalX}
              focalY={preview.imageAttribution?.focalY}
              className="size-36"
            />
            <div>
              <h2 className="font-serif text-3xl">{preview.name}</h2>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {preview.headline}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {preview.biography}
              </p>
              <p className="mt-4 font-mono text-[10px] text-ink-faint">
                {preview.companyIds.map(companyName).join(" · ")} ·{" "}
                {preview.appearanceIds.length} recordings
              </p>
              <Link
                to={`/speakers/${preview.slug}`}
                className="mt-6 inline-flex items-center gap-2 border border-[var(--ts-acc)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]"
              >
                View full profile{" "}
                <ArrowUpRight className="size-3.5 text-ink-soft" />
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
