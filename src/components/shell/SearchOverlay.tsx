import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock3, Search } from "lucide-react";
import { searchAdapter } from "@/data/adapters/search";
import type { SearchHit } from "@/data/repositories/contracts";
import {
  appearanceSlug,
  appearanceTitle,
  companySlug,
  eventSlug,
  speakerSlug,
  topicSlug,
} from "@/data/lookup";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { formatTimestamp } from "@/lib/format";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* Universal search overlay — reachable from every page ("/" key or
   the search button). Groups results by entity kind, keeps recent
   searches locally, links into Discover for full filtering. */

const RECENT_KEY = "techstage.recentSearches";

const kindLabel: Record<SearchHit["kind"], string> = {
  speaker: "Speakers",
  appearance: "Appearances",
  clip: "Clips",
  moment: "Standout Moments",
  event: "Events",
  topic: "Topics",
  company: "Companies",
  transcript: "Transcript matches",
};

function hitTarget(hit: SearchHit): string {
  switch (hit.kind) {
    case "speaker":
      return `/speakers/${speakerSlug(hit.id)}`;
    case "appearance":
      return `/a/${appearanceSlug(hit.id)}`;
    case "clip":
      return `/a/${appearanceSlug(hit.appearanceId!)}?t=${hit.timestamp ?? 0}`;
    case "moment":
      return `/a/${appearanceSlug(hit.appearanceId!)}?t=${hit.timestamp ?? 0}`;
    case "event":
      return `/events/${eventSlug(hit.id)}`;
    case "topic":
      return `/topics/${topicSlug(hit.id)}`;
    case "company":
      return `/companies/${companySlug(hit.id)}`;
    case "transcript":
      return `/a/${appearanceSlug(hit.appearanceId!)}?t=${hit.timestamp ?? 0}`;
  }
}

function hitLabel(hit: SearchHit): string {
  const db = getSeedDb();
  switch (hit.kind) {
    case "speaker":
      return db.speakers.find((s) => s.id === hit.id)?.name ?? hit.id;
    case "appearance":
      return appearanceTitle(hit.id);
    case "clip":
      return db.clips.find((c) => c.id === hit.id)?.title ?? hit.id;
    case "moment":
      return db.standoutMoments.find((moment) => moment.id === hit.id)?.title ?? hit.id;
    case "event":
      return db.events.find((e) => e.id === hit.id)?.title ?? hit.id;
    case "topic":
      return db.topics.find((t) => t.id === hit.id)?.name ?? hit.id;
    case "company":
      return db.companies.find((c) => c.id === hit.id)?.name ?? hit.id;
    case "transcript":
      return appearanceTitle(hit.appearanceId!);
  }
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      setHits(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      searchAdapter.search({ text: query, limit: 18 }).then((results) => {
        setHits(results);
        setLoading(false);
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [query]);

  const grouped = useMemo(() => {
    if (!hits) return [];
    const order: SearchHit["kind"][] = [
      "speaker", "appearance", "clip", "event", "topic", "company", "transcript",
    ];
    return order
      .map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind).slice(0, 4) }))
      .filter((g) => g.items.length > 0);
  }, [hits]);

  const commit = (q: string) => {
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, 6);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 p-0 sm:p-10" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-2xl flex-col border border-ink bg-paper shadow-[7px_7px_0_0_rgba(23,24,28,0.2)] sm:h-auto sm:max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="Search"
      >
        <form
          className="flex items-center border-b border-ink"
          onSubmit={(e) => {
            e.preventDefault();
            if (!query.trim()) return;
            commit(query.trim());
            onClose();
            navigate(`/discover?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <span className="flex items-center border-r border-ink/20 px-3.5 text-ink-faint">
            <Search className="size-4" />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search speakers, talks, topics, transcripts…"
            className="min-w-0 flex-1 bg-transparent px-4 py-3.5 font-mono text-sm outline-none placeholder:text-ink-faint"
          />
          <kbd className="mr-3 hidden border border-line bg-paper-gray px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
            esc
          </kbd>
        </form>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          )}

          {!loading && !hits && (
            <div className="p-2">
              {recent.length > 0 ? (
                <>
                  <p className="px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    Recent
                  </p>
                  <div className="mt-2 space-y-1">
                    {recent.map((r) => (
                      <button
                        key={r}
                        onClick={() => setQuery(r)}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left font-mono text-sm text-ink-soft hover:bg-paper-gray"
                      >
                        <Clock3 className="size-3.5 text-ink-faint" /> {r}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-2 py-6 text-center">
                  <p className="font-mono text-xs text-ink-faint">
                    Try “inference”, “Mira Chen”, “open weights”, or a phrase from a talk —
                    transcripts are searchable.
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 px-2 pt-3">
                {["AI agents", "interconnect queue", "robots", "Bramble", "packaging"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="cursor-pointer border border-ink/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-soft hover:border-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && hits && hits.length === 0 && (
            <div className="px-4 py-10 text-center font-mono text-sm text-ink-faint">
              ∅ nothing charted for “{query}” — try a speaker, topic, or transcript phrase
            </div>
          )}

          {!loading &&
            grouped.map((group) => (
              <div key={group.kind} className="mb-3">
                <p className="px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                  {kindLabel[group.kind]}
                </p>
                <div className="mt-1.5 space-y-1">
                  {group.items.map((hit) => (
                    <Link
                      key={`${hit.kind}-${hit.id}`}
                      to={hitTarget(hit)}
                      onClick={() => {
                        commit(query.trim());
                        onClose();
                      }}
                      className="block border border-transparent px-2 py-2 transition-colors hover:border-line hover:bg-paper-gray"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">{hitLabel(hit)}</span>
                        {hit.timestamp !== undefined && (
                          <span className="shrink-0 font-mono text-[10px] text-[var(--ts-acc-deep)]">
                            @ {formatTimestamp(hit.timestamp)}
                          </span>
                        )}
                      </span>
                      {hit.snippet && (
                        <span className="mt-0.5 line-clamp-2 font-mono text-[11px] leading-relaxed text-ink-faint">
                          “{hit.snippet}”
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

          {!loading && hits && hits.length > 0 && (
            <button
              onClick={() => {
                commit(query.trim());
                onClose();
                navigate(`/discover?q=${encodeURIComponent(query.trim())}`);
              }}
              className={cn(
                "mt-1 w-full cursor-pointer border border-ink/20 px-3 py-2.5 text-center font-mono text-xs uppercase tracking-widest text-ink-soft transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              )}
            >
              All results + filters in Discover →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
