import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ListFilter, Search, X } from "lucide-react";
import { searchAdapter } from "@/data/adapters/search";
import { catalogRepo } from "@/data/repositories/local";
import type {
  SearchFilters,
  SearchHit,
  SearchSort,
} from "@/data/repositories/contracts";
import { APPEARANCE_TYPE_LABELS } from "@/data/lookup";
import {
  AppearanceRow,
  AppearanceSquare,
  ClipCard,
  StandoutMomentCard,
} from "@/components/media/cards";
import { EntityImage } from "@/components/ui/EntityImage";
import { QueryHighlight } from "@/components/ui/QueryHighlight";
import {
  Button,
  EmptyState,
  ErrorState,
  Pill,
  RowSkeleton,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useAsync } from "@/lib/useAsync";
import type { Company, Event, Speaker, Topic } from "@/domain/types";

const SORTS: { id: SearchSort; label: string }[] = [
  { id: "relevance", label: "Relevance" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "popularity", label: "Popular" },
];

const FORMAT_IDS = [
  "panel",
  "interview",
  "podcast",
  "technical-talk",
  "product-launch",
  "livestream",
] as const;

export default function Discover() {
  const catalog = useAsync(
    async () => ({
      appearances: await catalogRepo.listAppearances(),
      speakers: await catalogRepo.listSpeakers(),
      companies: await catalogRepo.listCompanies(),
      events: await catalogRepo.listEvents(),
      topics: await catalogRepo.listTopics(),
      clips: await catalogRepo.listClips(),
      moments: await catalogRepo.listStandoutMoments(),
    }),
    [],
  );
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const format = params.get("format");
    return format && FORMAT_IDS.includes(format as (typeof FORMAT_IDS)[number])
      ? { appearanceTypes: [format] }
      : {};
  });
  const [sort, setSort] = useState<SearchSort>(
    (params.get("sort") as SearchSort) || "relevance",
  );
  const [entityView, setEntityView] = useState<
    "speaker" | "company" | "event" | null
  >(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setInput(query), [query]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    searchAdapter.search({ text: query, filters, sort, limit: 80 }).then(
      (rows) => {
        if (live) {
          setHits(rows);
          setLoading(false);
        }
      },
      (reason: Error) => {
        if (live) {
          setError(reason);
          setLoading(false);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [query, filters, sort]);

  const activeCount = Object.values(filters).reduce(
    (count, value) =>
      count + (Array.isArray(value) ? value.length : value ? 1 : 0),
    0,
  );
  const appearanceHits = (hits ?? [])
    .filter((hit) => hit.kind === "appearance")
    .map((hit) => catalog.data?.appearances.find((row) => row.id === hit.id))
    .filter(Boolean);
  const clipHits = (hits ?? [])
    .filter((hit) => hit.kind === "clip")
    .map((hit) => catalog.data?.clips.find((clip) => clip.id === hit.id))
    .filter(Boolean);
  const momentHits = (hits ?? [])
    .filter((hit) => hit.kind === "moment")
    .map((hit) => catalog.data?.moments.find((moment) => moment.id === hit.id))
    .filter(Boolean);
  const transcriptHits = (hits ?? []).filter(
    (hit) => hit.kind === "transcript",
  );
  const entitySections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (primary: string, secondary: string) =>
      !needle || `${primary} ${secondary}`.toLowerCase().includes(needle);
    const speakers = (catalog.data?.speakers ?? []).filter(
      (row) =>
        matches(row.name, `${row.headline} ${row.biography}`) &&
        (!filters.speakerIds?.length || filters.speakerIds.includes(row.id)),
    );
    const companies = (catalog.data?.companies ?? []).filter(
      (row) =>
        matches(row.name, row.description) &&
        (!filters.companyIds?.length || filters.companyIds.includes(row.id)),
    );
    const events = (catalog.data?.events ?? []).filter(
      (row) =>
        matches(row.title, `${row.organizer} ${row.description}`) &&
        (!filters.eventIds?.length || filters.eventIds.includes(row.id)),
    );
    return [
      {
        kind: "speaker" as const,
        title: "People",
        hits: speakers.map((row) => ({
          kind: "speaker" as const,
          id: row.id,
          score: 1,
        })),
      },
      {
        kind: "company" as const,
        title: "Companies",
        hits: companies.map((row) => ({
          kind: "company" as const,
          id: row.id,
          score: 1,
        })),
      },
      {
        kind: "event" as const,
        title: "Events",
        hits: events.map((row) => ({
          kind: "event" as const,
          id: row.id,
          score: 1,
        })),
      },
    ];
  }, [
    catalog.data,
    filters.companyIds,
    filters.eventIds,
    filters.speakerIds,
    query,
  ]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    input.trim() ? next.set("q", input.trim()) : next.delete("q");
    setParams(next);
  };

  const toggle = (
    key:
      "speakerIds" | "topicIds" | "companyIds" | "eventIds" | "appearanceTypes",
    id: string,
  ) => {
    setFilters((current) => {
      const values = current[key] ?? [];
      return {
        ...current,
        [key]: values.includes(id)
          ? values.filter((value) => value !== id)
          : [...values, id],
      };
    });
  };

  const panel = (
    <FilterPanel
      filters={filters}
      setFilters={setFilters}
      toggle={toggle}
      catalog={catalog.data}
    />
  );

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="ts-paper -mx-4 border-b border-line px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
            <span className="text-backer">Complete index</span>
          </p>
          <h1 className="mt-3 font-serif text-5xl sm:text-6xl">
            <span className="text-backer">Discover</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            <span className="text-backer">
              Search the people, companies, events, formats, and exact words
              inside technology’s public conversations.
            </span>
          </p>
          <form
            onSubmit={submit}
            className="mx-auto mt-7 flex max-w-3xl border border-ink bg-paper shadow-[6px_6px_0_0_var(--ts-acc-soft)]"
          >
            <Search className="ml-4 mt-4 size-4 text-ink-faint" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search the complete index"
              className="min-w-0 flex-1 bg-transparent px-3 py-3.5 font-mono text-sm outline-none"
            />
            <button className="border-l border-ink bg-[var(--ts-acc)] px-5 font-mono text-[11px] uppercase tracking-widest text-white">
              Search
            </button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              "AI agents",
              "Robotics",
              "Chips",
              "Lattice Compute",
              "Panels",
              "Podcasts",
            ].map((label) => (
              <button
                key={label}
                onClick={() => {
                  setInput(label);
                  setParams({ q: label });
                }}
                className="border border-[var(--ts-acc)] bg-[var(--ts-acc-15-solid)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-8 pt-8 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                Filters
              </p>
              {activeCount > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="font-mono text-[10px] text-[var(--ts-acc-deep)]"
                >
                  Clear {activeCount}
                </button>
              )}
            </div>
            <div className="mt-3">{panel}</div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-4">
            <Button
              className="lg:hidden"
              size="sm"
              onClick={() => setFiltersOpen(true)}
            >
              <ListFilter className="size-3.5" /> Filters{" "}
              {activeCount ? `· ${activeCount}` : ""}
            </Button>
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
              {loading || catalog.loading
                ? "Searching"
                : `${hits?.length ?? 0} results`}
            </p>
            <div
              className="flex border border-ink/20"
              role="group"
              aria-label="Show one entity type"
            >
              {(
                [
                  ["speaker", "Speakers"],
                  ["company", "Companies"],
                  ["event", "Events"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  onClick={() =>
                    setEntityView((current) => (current === kind ? null : kind))
                  }
                  aria-pressed={entityView === kind}
                  className={cn(
                    "cursor-pointer px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors",
                    entityView === kind
                      ? "bg-ink text-paper"
                      : "text-ink-faint hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SearchSort)}
                className="border border-ink/25 bg-paper px-3 py-2 text-ink outline-none focus:border-[var(--ts-acc)]"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="mt-5 space-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <RowSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <ErrorState className="mt-5" detail={error.message} />
          ) : !hits?.length ? (
            <EmptyState
              className="mt-5"
              icon="search"
              title="Nothing matches yet"
              hint="Try a broader keyword or clear a filter."
            />
          ) : entityView &&
            !entitySections.some(
              (section) =>
                section.kind === entityView && section.hits.length > 0,
            ) ? (
            <EmptyState
              className="mt-5"
              icon="search"
              title={`No ${entityView === "company" ? "companies" : `${entityView}s`} match`}
              hint="Try a broader keyword, clear a filter, or show all result types."
            />
          ) : (
            <div className="space-y-10 pt-6">
              {entitySections
                .filter((section) => !entityView || section.kind === entityView)
                .map(
                  (section) =>
                    section.hits.length > 0 && (
                      <ResultSection key={section.kind} title={section.title}>
                        <div className="dot-grid grid grid-cols-2 gap-2 border border-dotted border-ink/35 p-2 sm:grid-cols-3">
                          {section.hits.map((hit) => (
                            <EntitySquare
                              key={`${hit.kind}-${hit.id}`}
                              hit={hit}
                              catalog={catalog.data}
                              query={query}
                            />
                          ))}
                        </div>
                      </ResultSection>
                    ),
                )}
              {!entityView && appearanceHits.length > 0 && (
                <ResultSection title="Recordings">
                  <div className="grid grid-cols-3 gap-2 sm:hidden">
                    {appearanceHits.map(
                      (appearance) =>
                        appearance && (
                          <AppearanceSquare
                            key={appearance.id}
                            a={appearance}
                          />
                        ),
                    )}
                  </div>
                  <div className="hidden space-y-3 sm:block">
                    {appearanceHits.map(
                      (appearance) =>
                        appearance && (
                          <AppearanceRow key={appearance.id} a={appearance} />
                        ),
                    )}
                  </div>
                </ResultSection>
              )}
              {!entityView && clipHits.length > 0 && (
                <ResultSection title="Clips">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {clipHits.map(
                      (clip) =>
                        clip && (
                          <ClipCard
                            key={clip.id}
                            clip={clip}
                            className="w-full"
                          />
                        ),
                    )}
                  </div>
                </ResultSection>
              )}
              {!entityView && momentHits.length > 0 && (
                <ResultSection title="Standout Moments">
                  <div className="grid gap-3 xl:grid-cols-2">
                    {momentHits.map(
                      (moment) =>
                        moment && (
                          <StandoutMomentCard
                            key={moment.id}
                            moment={moment}
                            className="w-full"
                          />
                        ),
                    )}
                  </div>
                </ResultSection>
              )}
              {!entityView && transcriptHits.length > 0 && (
                <ResultSection title="Transcript matches">
                  <div className="space-y-2">
                    {transcriptHits.map((hit) => {
                      const appearance = catalog.data?.appearances.find(
                        (row) => row.id === hit.appearanceId,
                      );
                      return (
                        <Link
                          key={hit.id}
                          to={`/a/${appearance?.slug}?t=${hit.timestamp ?? 0}`}
                          className="block border border-line p-4 hover:border-[var(--ts-acc)]"
                        >
                          <p className="text-sm leading-relaxed text-ink-soft">
                            {hit.snippet}
                          </p>
                          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">
                            {appearance?.title} · open timestamp →
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </ResultSection>
              )}
            </div>
          )}
        </section>
      </div>

      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto border-t border-ink bg-paper p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest">
                Filters
              </p>
              <button onClick={() => setFiltersOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            {panel}
            <Button
              className="mt-5 w-full"
              variant="accent"
              onClick={() => setFiltersOpen(false)}
            >
              Show results
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterPanel({
  filters,
  setFilters,
  toggle,
  catalog,
}: {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  toggle: (
    key:
      "speakerIds" | "topicIds" | "companyIds" | "eventIds" | "appearanceTypes",
    id: string,
  ) => void;
  catalog: {
    speakers: Awaited<ReturnType<typeof catalogRepo.listSpeakers>>;
    companies: Awaited<ReturnType<typeof catalogRepo.listCompanies>>;
    events: Awaited<ReturnType<typeof catalogRepo.listEvents>>;
    topics: Awaited<ReturnType<typeof catalogRepo.listTopics>>;
  } | null;
}) {
  const rows = catalog ?? {
    speakers: [],
    companies: [],
    events: [],
    topics: [],
  };
  return (
    <div className="border-x border-t border-ink/15">
      <FilterGroup label="Speakers">
        <SearchableOptions
          rows={rows.speakers.map((row) => ({ id: row.id, label: row.name }))}
          selected={filters.speakerIds ?? []}
          onToggle={(id) => toggle("speakerIds", id)}
          placeholder="Find a speaker"
        />
      </FilterGroup>
      <FilterGroup label="Topics">
        <SearchableOptions
          rows={rows.topics.map((row) => ({ id: row.id, label: row.name }))}
          selected={filters.topicIds ?? []}
          onToggle={(id) => toggle("topicIds", id)}
          placeholder="Find a topic"
        />
      </FilterGroup>
      <FilterGroup label="Companies" open>
        <SearchableOptions
          rows={rows.companies.map((row) => ({ id: row.id, label: row.name }))}
          selected={filters.companyIds ?? []}
          onToggle={(id) => toggle("companyIds", id)}
          placeholder="Find a company"
        />
      </FilterGroup>
      <FilterGroup label="Events">
        <SearchableOptions
          rows={rows.events.map((row) => ({ id: row.id, label: row.title }))}
          selected={filters.eventIds ?? []}
          onToggle={(id) => toggle("eventIds", id)}
          placeholder="Find an event"
        />
      </FilterGroup>
      <FilterGroup label="Format">
        <div className="flex flex-wrap gap-1.5">
          {FORMAT_IDS.map((id) => (
            <Pill
              key={id}
              active={filters.appearanceTypes?.includes(id) ?? false}
              onClick={() => toggle("appearanceTypes", id)}
            >
              {APPEARANCE_TYPE_LABELS[id]}
            </Pill>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup label="Quality">
        <label className="flex items-center gap-2 font-mono text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={Boolean(filters.hasRecording)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                hasRecording: event.target.checked || undefined,
              }))
            }
          />{" "}
          Recording available
        </label>
        <label className="mt-2 flex items-center gap-2 font-mono text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={Boolean(filters.verifiedOnly)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                verifiedOnly: event.target.checked || undefined,
              }))
            }
          />{" "}
          Verified sources only
        </label>
      </FilterGroup>
      <FilterGroup label="Duration" open>
        <div className="flex flex-wrap gap-1.5">
          {[
            [1800, "≤ 30m"],
            [3600, "≤ 1h"],
            [7200, "≤ 2h"],
          ].map(([seconds, label]) => (
            <Pill
              key={seconds}
              active={filters.maxDurationSeconds === seconds}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  maxDurationSeconds:
                    current.maxDurationSeconds === seconds
                      ? undefined
                      : Number(seconds),
                }))
              }
            >
              {label}
            </Pill>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup label="Date range">
        <div className="space-y-2">
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateFrom: event.target.value || undefined,
              }))
            }
            className="w-full border border-ink/25 bg-paper p-2 font-mono text-xs"
          />
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateTo: event.target.value || undefined,
              }))
            }
            className="w-full border border-ink/25 bg-paper p-2 font-mono text-xs"
          />
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  open = false,
  children,
}: {
  label: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-ink/15 bg-paper">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        {label}
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-4">{children}</div>
    </details>
  );
}

function SearchableOptions({
  rows,
  selected,
  onToggle,
  placeholder,
}: {
  rows: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const visible = rows
    .filter((row) => row.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);
  return (
    <>
      <div className="flex items-center border border-ink/20">
        <Search className="ml-2 size-3 text-ink-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent p-2 font-mono text-[10px] outline-none"
        />
      </div>
      <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto ide-scroll">
        {visible.map((row) => (
          <Pill
            key={row.id}
            active={selected.includes(row.id)}
            onClick={() => onToggle(row.id)}
          >
            {row.label}
          </Pill>
        ))}
      </div>
    </>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

type DiscoverCatalog = {
  speakers: Speaker[];
  companies: Company[];
  events: Event[];
  topics: Topic[];
};

function EntitySquare({
  hit,
  catalog,
  query,
}: {
  hit: SearchHit;
  catalog: DiscoverCatalog | null;
  query: string;
}) {
  if (!catalog) return null;
  const row =
    hit.kind === "speaker"
      ? catalog.speakers.find((item) => item.id === hit.id)
      : hit.kind === "company"
        ? catalog.companies.find((item) => item.id === hit.id)
        : hit.kind === "event"
          ? catalog.events.find((item) => item.id === hit.id)
          : catalog.topics.find((item) => item.id === hit.id);
  if (!row) return null;
  const to =
    hit.kind === "speaker"
      ? `/speakers/${row.slug}`
      : hit.kind === "company"
        ? `/companies/${row.slug}`
        : hit.kind === "event"
          ? `/events/${row.slug}`
          : `/topics/${row.slug}`;
  const label = "name" in row ? row.name : row.title;
  const entityType = hit.kind as "speaker" | "company" | "event" | "topic";
  const src =
    "avatarUrl" in row
      ? row.avatarUrl
      : "logoUrl" in row
        ? row.logoUrl
        : "imageUrl" in row
          ? row.imageUrl
          : null;
  const focalX =
    "imageAttribution" in row ? row.imageAttribution?.focalX : undefined;
  const focalY =
    "imageAttribution" in row ? row.imageAttribution?.focalY : undefined;
  const round = entityType === "speaker" || entityType === "company";
  return (
    <Link
      to={to}
      className="tech-frame dot-grid flex min-w-0 flex-col overflow-hidden border border-dotted border-ink/35 bg-paper p-2 hover:border-[var(--ts-acc)]"
    >
      <EntityImage
        entityType={entityType}
        entitySlug={row.slug}
        name={label}
        src={src}
        focalX={focalX}
        focalY={focalY}
        className={round ? "mx-auto mt-1 size-20 sm:size-24" : "w-full"}
      />
      <span className="block min-w-0 px-1 pb-1 pt-2">
        <span className="font-mono text-[7px] uppercase tracking-wider text-ink-faint">
          {hit.kind}
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[11px] font-semibold leading-tight text-ink sm:text-sm">
          <QueryHighlight text={label} query={query} />
        </span>
      </span>
    </Link>
  );
}
