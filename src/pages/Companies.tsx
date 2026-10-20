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
  Pill,
  RowSkeleton,
  TabRow,
} from "@/components/ui/primitives";
import { topicName } from "@/data/lookup";

const SORTS = ["Prominence", "Most active", "A–Z", "Following"] as const;
type Sort = (typeof SORTS)[number];

export default function Companies() {
  const [sort, setSort] = useState<Sort>("Prominence");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const { isFollowing } = useAppState();
  const companies = useAsync(() => catalogRepo.listCompanies(), []);
  const topics = useAsync(() => catalogRepo.listTopics(), []);
  const appearances = useAsync(() => catalogRepo.listAppearances(), []);
  const relationships = useMemo(() => {
    const topicsByCompany = new Map<string, Set<string>>();
    const appearancesByCompany = new Map<string, number>();
    for (const appearance of appearances.data ?? [])
      for (const companyId of appearance.companyIds) {
        const topicIds = topicsByCompany.get(companyId) ?? new Set<string>();
        appearance.topicIds.forEach((id) => topicIds.add(id));
        topicsByCompany.set(companyId, topicIds);
        appearancesByCompany.set(
          companyId,
          (appearancesByCompany.get(companyId) ?? 0) + 1,
        );
      }
    return { topicsByCompany, appearancesByCompany };
  }, [appearances.data]);

  const rows = useMemo(() => {
    let list = [...(companies.data ?? [])];
    if (topicFilter)
      list = list.filter((company) =>
        relationships.topicsByCompany.get(company.id)?.has(topicFilter),
      );
    if (query.trim())
      list = list.filter((company) =>
        `${company.name} ${company.description}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      );
    if (sort === "Prominence")
      list.sort(
        (a, b) =>
          (b.prominenceScore ?? 0) - (a.prominenceScore ?? 0) ||
          a.name.localeCompare(b.name),
      );
    if (sort === "Most active")
      list.sort(
        (a, b) =>
          (relationships.appearancesByCompany.get(b.id) ?? 0) -
          (relationships.appearancesByCompany.get(a.id) ?? 0),
      );
    if (sort === "A–Z") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "Following")
      list = list.filter((company) => isFollowing("company", company.id));
    return list;
  }, [companies.data, topicFilter, query, sort, isFollowing, relationships]);

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="ts-paper -mx-4 border-b border-line px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
            Companies on stage
          </p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
            Company directory
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            Follow the organizations behind technology&rsquo;s public
            conversations, then open a profile for every indexed appearance.
          </p>
        </div>
      </section>
      <div className="tech-frame dot-grid mx-auto mt-6 flex max-w-xl items-center border border-dotted border-ink/40 bg-paper">
        <Search className="ml-3 size-4 text-ink-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search companies"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-xs outline-none"
        />
      </div>
      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Topic
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
          {rows.length} companies
        </span>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
        {companies.loading &&
          Array.from({ length: 8 }, (_, index) => <RowSkeleton key={index} />)}
        {!companies.loading && !rows.length && (
          <EmptyState
            className="col-span-2 md:col-span-3 xl:col-span-4"
            title="No companies match"
          />
        )}
        {rows.map((company) => (
          <article
            key={company.id}
            className="dot-grid group flex min-w-0 flex-col border border-dotted border-ink/40 bg-paper p-2.5 transition-colors hover:border-[var(--ts-acc)] hover:bg-[var(--ts-acc-15)] sm:p-4"
          >
            <Link to={`/companies/${company.slug}`} className="min-w-0">
              <EntityImage
                entityType="company"
                entitySlug={company.slug}
                name={company.name}
                src={company.logoUrl}
                focalX={company.imageAttribution?.focalX}
                focalY={company.imageAttribution?.focalY}
                className="mx-auto size-24 sm:size-32"
              />
              <h2 className="mt-3 break-words text-center font-serif text-lg leading-tight sm:mt-4 sm:text-2xl">
                <QueryHighlight text={company.name} query={query} />
              </h2>
              <p className="mt-1 line-clamp-1 text-center font-mono text-[8px] uppercase tracking-widest text-ink-soft sm:text-[10px]">
                {company.industryTags.slice(0, 2).join(" · ")}
              </p>
              <p className="mt-3 hidden line-clamp-2 text-xs leading-relaxed text-ink-faint sm:block">
                {company.description}
              </p>
            </Link>
            <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:pt-5">
              <span className="hidden font-mono text-[9px] uppercase tracking-widest text-ink-faint sm:block">
                {[...(relationships.topicsByCompany.get(company.id) ?? [])].slice(0, 2).map(topicName).join(" · ")}
              </span>
              <FollowButton kind="company" id={company.id} size="sm" />
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
