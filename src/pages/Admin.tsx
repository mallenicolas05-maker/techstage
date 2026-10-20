import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardPaste,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  GitBranch,
  HeartPulse,
  Inbox,
  Link2,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Archive,
  CalendarDays,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { localOperations } from "@/backend/localOperations";
import { localDigests } from "@/backend/localDigests";
import { validateDigestIssue } from "@/backend/digestGeneration";
import { BACKFILL_DEFAULTS, PRODUCTION_SCHEDULES } from "@/backend/schedules";
import { ingestionAdapter } from "@/data/repositories/local";
import { PIPELINE_ORDER, STAGE_LABELS } from "@/data/seed/ingestion";
import { PRODUCTION_PIPELINE_ORDER } from "@/domain/operations";
import type {
  AnalysisEstimate,
  AssetCandidate,
  ManualCandidateDraft,
  OperationsSection,
} from "@/domain/operations";
import type { IngestionCandidate, IngestionStatus } from "@/domain/types";
import { CLIENT_RUNTIME_CONFIG } from "@/backend/config";
import { formatRelative } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  RowSkeleton,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW } from "@/data/repositories/local";

const STATUS_TONE: Record<
  IngestionStatus,
  "neutral" | "accent" | "warn" | "live"
> = {
  discovered: "neutral",
  queued: "neutral",
  processing: "accent",
  "needs-review": "warn",
  approved: "accent",
  published: "live",
  rejected: "warn",
  failed: "warn",
  archived: "neutral",
};

const NEXT_STATUS: Partial<
  Record<IngestionStatus, { label: string; status: IngestionStatus }[]>
> = {
  discovered: [{ label: "Queue", status: "queued" }],
  queued: [{ label: "Start", status: "processing" }],
  processing: [{ label: "Review", status: "needs-review" }],
  "needs-review": [
    { label: "Approve", status: "approved" },
    { label: "Reject", status: "rejected" },
  ],
  approved: [{ label: "Publish", status: "published" }],
  failed: [
    { label: "Retry", status: "queued" },
    { label: "Archive", status: "archived" },
  ],
};

const TECHSTAGE_ANALYSIS_PROMPT = `Analyze only the official recording or supplied transcript. Do not use outside knowledge and do not guess. Every person, company, event, chapter, highlight, quote, and claim must be supported by the source. Return valid JSON only in this exact shape:
{
  "title": "", "official_url": "", "overview": "",
  "speakers": [{"name":"","role":"","evidence":"","timestamp_seconds":0}],
  "companies": [{"name":"","evidence":"","timestamp_seconds":0}],
  "event": {"name":"","evidence":"","timestamp_seconds":0},
  "topics": [""],
  "chapters": [{"title":"","summary":"","start_seconds":0,"evidence":""}],
  "highlights": [{"title":"","summary":"","start_seconds":0,"end_seconds":0,"evidence":""}],
  "dossier": {
    "main_takeaways": [], "bottlenecks": [], "investment_lens": [],
    "career_signals": [], "builder_implications": [], "research_relevance": [],
    "market_sentiment": [], "competitive_intelligence": [], "content_angles": [],
    "networking_prep": [], "recruiting_relevance": [], "product_timing": [],
    "emerging_narratives": [], "news_context": [], "open_source_implications": [],
    "strategic_decisions": [], "related_signals": [], "watch_next": []
  }
}
Each dossier item must be {"title":"","body":"","evidence":"","timestamp_seconds":0}. Use real source timestamps in seconds. Omit unsupported optional items; never replace them with zero, filler, generic labels, or invented information.`;

export default function Admin() {
  return CLIENT_RUNTIME_CONFIG.dataMode === "supabase" &&
    CLIENT_RUNTIME_CONFIG.supabaseUrl &&
    CLIENT_RUNTIME_CONFIG.supabasePublishableKey ? (
    <LiveAdmin />
  ) : (
    <LocalAdmin />
  );
}

type LiveSnapshot = {
  dryRun: boolean;
  blockers: Array<Record<string, unknown>>;
  entityCandidates: Array<Record<string, unknown>>;
  discoveryTargets: Array<Record<string, unknown>>;
  pendingAssets: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  budgets: Array<Record<string, unknown>>;
  usage: Array<Record<string, unknown>>;
  costDays: Array<{
    date: string;
    total_usd: number;
    entries: Array<Record<string, unknown>>;
  }>;
  publishedAppearances: Array<Record<string, unknown>>;
  verifiedEntities: Record<
    "company" | "speaker" | "event",
    Array<Record<string, unknown>>
  >;
  archivedItems: Array<Record<string, unknown>>;
  backfillCampaign: Record<string, unknown> | null;
  backfillDailyUsage: Array<Record<string, unknown>>;
  youtubeSearchUsage: Array<Record<string, unknown>>;
};

function LiveAdmin() {
  const toast = useToast();
  const [section, setSection] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualSpeakers, setManualSpeakers] = useState([""]);
  const [manualTranscript, setManualTranscript] = useState("");
  const [manualTranscriptText, setManualTranscriptText] = useState("");
  const [manualReferenceBrief, setManualReferenceBrief] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const snapshot = useAsync(async () => {
    const response = await fetch(
      `${CLIENT_RUNTIME_CONFIG.supabaseUrl}/functions/v1/admin-api`,
      {
        headers: { apikey: CLIENT_RUNTIME_CONFIG.supabasePublishableKey ?? "" },
      },
    );
    if (!response.ok) throw new Error("Unable to load live Admin data.");
    return response.json() as Promise<LiveSnapshot>;
  }, [refreshKey]);

  const action = async (
    actionName: string,
    entityId?: string,
    detail?: string,
  ) => {
    const response = await fetch(
      `${CLIENT_RUNTIME_CONFIG.supabaseUrl}/functions/v1/admin-api`,
      {
        method: "POST",
        headers: {
          apikey: CLIENT_RUNTIME_CONFIG.supabasePublishableKey ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: actionName, entityId, detail }),
      },
    );
    if (!response.ok) throw new Error("Admin action was rejected.");
    setRefreshKey((value) => value + 1);
  };
  const submitManualLink = async () => {
    if (!manualUrl.trim()) return;
    setManualSubmitting(true);
    try {
      const response = await fetch(
        `${CLIENT_RUNTIME_CONFIG.supabaseUrl}/functions/v1/manual-intake`,
        {
          method: "POST",
          headers: {
            apikey: CLIENT_RUNTIME_CONFIG.supabasePublishableKey ?? "",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            url: manualUrl,
            title: manualTitle,
            speakers: manualSpeakers.filter(Boolean),
            transcriptUrl: manualTranscript,
            transcript: manualTranscriptText,
            referenceBrief: manualReferenceBrief,
          }),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        status?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Could not add that link.");
      setManualUrl("");
      setManualTitle("");
      setManualSpeakers([""]);
      setManualTranscript("");
      setManualTranscriptText("");
      setManualReferenceBrief("");
      setRefreshKey((value) => value + 1);
      toast({
        message:
          result.status === "duplicate"
            ? "Already in the queue — linked to the existing item."
            : "Link added to the review queue.",
      });
    } catch (error) {
      toast({
        message:
          error instanceof Error ? error.message : "Could not add that link.",
      });
    } finally {
      setManualSubmitting(false);
    }
  };

  const data = snapshot.data;
  const sections = [
    ["overview", "Overview"],
    ["published", "Published talks"],
    ["media", "Fix recordings"],
    ["companies", "Companies"],
    ["speakers", "Speakers"],
    ["events", "Events"],
    ["costs", "Cost schedule"],
    ["archive", "Archive"],
  ] as const;
  const candidates = data?.entityCandidates ?? [];
  const entityTypeForSection = (
    value: string,
  ): "company" | "speaker" | "event" =>
    value === "companies"
      ? "company"
      : (value.slice(0, -1) as "speaker" | "event");
  const rowsFor = (type: string) =>
    candidates.filter((row) => row.entity_type === type);
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-24">
      <header className="-mx-4 border-b border-ink/20 bg-paper-gray px-4 py-5">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ts-acc-deep)]">
              Internal · live recovery
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl">
              TechStage operations desk
            </h1>
          </div>
          <Button onClick={() => setRefreshKey((value) => value + 1)}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </header>
      <div
        className={cn(
          "-mx-4 grid min-h-[calc(100vh-12rem)] border-b border-ink/20 bg-paper",
          sidebarOpen
            ? "lg:grid-cols-[280px_minmax(0,1fr)]"
            : "lg:grid-cols-[112px_minmax(0,1fr)]",
        )}
      >
        <nav
          className="flex overflow-x-auto border-b border-ink/20 bg-paper-gray lg:block lg:border-b-0 lg:border-r"
          aria-label="Admin sections"
        >
          <button
            onClick={() => setSidebarOpen((value) => !value)}
            className="hidden w-full border-b border-ink/15 px-4 py-3 text-left font-mono text-[9px] uppercase tracking-widest text-ink-faint lg:block"
          >
            {sidebarOpen ? "Collapse sidebar ←" : "→"}
          </button>
          <p className="hidden border-b border-ink/15 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.24em] text-ink-faint lg:block">
            Workspace
          </p>
          {sections.map(([id, label]) => (
            <button
              key={id}
              title={label}
              onClick={() => setSection(id)}
              className={cn(
                "shrink-0 border-r border-ink/15 px-3 py-3 text-left font-mono text-[9px] uppercase tracking-widest lg:block lg:w-full lg:border-b lg:border-r-0",
                section === id
                  ? "bg-ink text-paper"
                  : "text-ink-faint hover:bg-paper hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 overflow-hidden p-4 sm:p-5">
          {snapshot.loading && (
            <div className="py-12">
              <RowSkeleton />
            </div>
          )}
          {snapshot.error && (
            <EmptyState
              title="Admin could not load"
              hint={snapshot.error.message}
            />
          )}
          {data && section === "overview" && (
            <>
              <div className="mb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">
                  At a glance
                </p>
                <h2 className="mt-1 font-serif text-3xl">
                  What needs your attention
                </h2>
              </div>
              <section className="grid border-l border-t border-ink/20 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  value={data.publishedAppearances.length}
                  label="Published talks"
                  note="Ready to watch"
                  tone="live"
                />
                <Metric
                  value={data.blockers.length}
                  label="Recording fixes"
                  note="Hidden until complete"
                  tone={data.blockers.length ? "warn" : "live"}
                />
                <Metric
                  value={candidates.length}
                  label="New entities"
                  note="Waiting for review"
                />
                <Metric
                  value={`$${data.costDays
                    .filter(
                      (day) =>
                        day.date.slice(0, 7) === chicagoToday().slice(0, 7),
                    )
                    .reduce((total, day) => total + day.total_usd, 0)
                    .toFixed(4)}`}
                  label="Runtime spend"
                  note="Provider-returned usage only"
                  tone="live"
                />
              </section>
              <section className="mt-4 border border-ink/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">
                      Manual intake
                    </p>
                    <h3 className="mt-1 font-serif text-2xl">
                      Add an official recording
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard
                        ?.writeText(TECHSTAGE_ANALYSIS_PROMPT)
                        .then(() =>
                          toast({ message: "Analysis prompt copied." }),
                        )
                    }
                  >
                    Copy analysis prompt
                  </Button>
                </div>
                <p className="mt-1 text-sm text-ink-faint">
                  An official YouTube link is required. Reference briefs help
                  review, but TechStage verifies every claim against the
                  recording or transcript.
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Input
                    type="url"
                    value={manualUrl}
                    onChange={(event) => setManualUrl(event.target.value)}
                    placeholder="Required: official YouTube link"
                  />
                  <Input
                    value={manualTitle}
                    onChange={(event) => setManualTitle(event.target.value)}
                    placeholder="Talk or panel title (optional)"
                  />
                </div>
                <div className="mt-2 space-y-2">
                  {manualSpeakers.map((speaker, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={speaker}
                        onChange={(event) =>
                          setManualSpeakers((current) =>
                            current.map((value, itemIndex) =>
                              itemIndex === index ? event.target.value : value,
                            ),
                          )
                        }
                        placeholder={`Relevant speaker ${index + 1} (optional)`}
                      />
                      <Button
                        size="sm"
                        disabled={manualSpeakers.length === 1}
                        onClick={() =>
                          setManualSpeakers((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    onClick={() =>
                      setManualSpeakers((current) => [...current, ""])
                    }
                  >
                    Add another speaker
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <Input
                    type="url"
                    value={manualTranscript}
                    onChange={(event) =>
                      setManualTranscript(event.target.value)
                    }
                    placeholder="Transcript URL (optional)"
                  />
                  <TextArea
                    rows={3}
                    value={manualTranscriptText}
                    onChange={setManualTranscriptText}
                    placeholder="Paste transcript (optional)"
                  />
                </div>
                <div className="mt-2">
                  <TextArea
                    rows={4}
                    value={manualReferenceBrief}
                    onChange={setManualReferenceBrief}
                    placeholder="Paste AI brief for reference only (optional)"
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    disabled={!manualUrl.trim() || manualSubmitting}
                    onClick={() => void submitManualLink()}
                  >
                    <Send className="size-3.5" />{" "}
                    {manualSubmitting ? "Adding…" : "Add to automation"}
                  </Button>
                </div>
              </section>
              <div className="mt-4">
                <PublishedTalksTable
                  rows={data.publishedAppearances.slice(0, 6)}
                />
              </div>
            </>
          )}
          {data && section === "published" && (
            <PublishedTalksTable rows={data.publishedAppearances} />
          )}
          {data && section === "media" && (
            <LiveBlockerTable rows={data.blockers} onAction={action} />
          )}
          {data && ["companies", "speakers", "events"].includes(section) && (
            <LiveEntityWorkspace
              type={entityTypeForSection(section)}
              verified={
                data.verifiedEntities[entityTypeForSection(section)] ?? []
              }
              rows={rowsFor(entityTypeForSection(section))}
              onAction={action}
              onRefresh={() => setRefreshKey((value) => value + 1)}
            />
          )}
          {data && section === "costs" && (
            <CostSchedulePanel
              costDays={data.costDays}
              campaign={data.backfillCampaign}
              dailyUsage={data.backfillDailyUsage}
              youtubeUsage={data.youtubeSearchUsage}
            />
          )}
          {data && section === "archive" && (
            <ArchivedItems
              rows={data.archivedItems}
              onRestore={(id, type) =>
                action(
                  type ? "restore-active-entity" : "restore-candidate",
                  id,
                  type,
                )
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}

function PublishedTalksTable({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const [sort, setSort] = useState<"recent" | "az">("recent");
  if (!rows.length)
    return (
      <EmptyState
        title="No published talks yet"
        hint="Only complete, playable talks appear here."
        className="py-10"
      />
    );
  const sorted = [...rows].sort((a, b) =>
    sort === "az"
      ? String(a.title).localeCompare(String(b.title))
      : String(b.published_at ?? b.public_ready_at ?? "").localeCompare(
          String(a.published_at ?? a.public_ready_at ?? ""),
        ),
  );
  return (
    <section className="border border-ink/20">
      <div className="flex items-center justify-between gap-3 border-b border-ink/15 bg-paper-gray px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
          {rows.length} published talks
        </span>
        <div className="flex border border-ink/20">
          <button
            onClick={() => setSort("recent")}
            className={cn(
              "px-2 py-1 font-mono text-[9px] uppercase",
              sort === "recent" && "bg-ink text-paper",
            )}
          >
            Newest
          </button>
          <button
            onClick={() => setSort("az")}
            className={cn(
              "px-2 py-1 font-mono text-[9px] uppercase",
              sort === "az" && "bg-ink text-paper",
            )}
          >
            A–Z
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[84px_76px_1fr_auto] border-b border-ink/15 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
        <span>Date</span>
        <span>Image</span>
        <span>Published talk</span>
        <span>Open</span>
      </div>
      {sorted.map((row) => {
        const media =
          row.canonical_media && typeof row.canonical_media === "object"
            ? (row.canonical_media as Record<string, unknown>)
            : {};
        const thumbnail = String(media.thumbnail_url ?? "");
        return (
          <div
            key={String(row.id)}
            className="grid grid-cols-[84px_76px_minmax(0,1fr)] items-center gap-3 border-b border-ink/10 px-3 py-3 last:border-b-0 lg:grid-cols-[84px_76px_minmax(0,1fr)_auto_auto]"
          >
            <time className="font-mono text-[9px] text-ink-faint">
              {formatAdminDate(row.published_at ?? row.public_ready_at)}
            </time>
            <div className="grid aspect-video w-16 place-items-center overflow-hidden border border-ink/15 bg-paper-gray">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-4 text-ink-faint" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">{String(row.title)}</p>
              <p className="mt-1 font-mono text-[9px] text-ink-faint">
                Playable · {String(media.channel_name ?? "official channel")}
              </p>
            </div>
            <a
              href={String(media.source_url ?? "#")}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-ink-faint hover:text-ink"
            >
              Original source ↗
            </a>
            <Link
              to={`/a/${String(row.slug)}`}
              className="border border-[var(--ts-acc)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)] hover:bg-[var(--ts-acc-15-solid)]"
            >
              View talk →
            </Link>
          </div>
        );
      })}
    </section>
  );
}

function formatAdminDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      });
}

function LocalAdmin() {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(
    null,
  );
  const candidates = useAsync(
    () => ingestionAdapter.listCandidates(),
    [version],
  );
  const rows = candidates.data ?? [];
  const snapshot = useMemo(
    () => localOperations.snapshot(rows),
    [rows, version],
  );
  const digestSnapshot = useMemo(() => localDigests.snapshot(), [version]);
  const digestGates = useMemo(
    () =>
      validateDigestIssue(digestSnapshot.issue, {
        allowImagePlaceholders: true,
      }),
    [digestSnapshot.issue],
  );

  const [priorityUrl, setPriorityUrl] = useState("");
  const [priorityTitle, setPriorityTitle] = useState("");
  const [priorityContext, setPriorityContext] = useState("");
  const [xDump, setXDump] = useState("");
  const [xPreview, setXPreview] = useState<ManualCandidateDraft[]>([]);
  const [xSelected, setXSelected] = useState<Set<string>>(new Set());
  const [eventDump, setEventDump] = useState("");
  const [eventPreview, setEventPreview] = useState<ManualCandidateDraft[]>([]);
  const [transcript, setTranscript] = useState("");
  const [analysisEstimate, setAnalysisEstimate] =
    useState<AnalysisEstimate | null>(null);

  const refresh = (section: OperationsSection | "all") => {
    localOperations.refresh(section);
    setVersion((value) => value + 1);
    toast({
      message:
        section === "all"
          ? "Local operations refreshed — no external calls"
          : `${section} refreshed locally`,
    });
  };

  const setStatus = async (
    candidate: IngestionCandidate,
    status: IngestionStatus,
  ) => {
    await ingestionAdapter.setCandidateStatus(candidate.id, status);
    setVersion((value) => value + 1);
    toast({ message: `Candidate → ${status}` });
  };

  const setDigestStatus = (status: typeof digestSnapshot.issue.status) => {
    try {
      localDigests.transition(status);
      setVersion((value) => value + 1);
      toast({
        message: `Stage Notes issue → ${status.replace("_", " ")} (local simulation)`,
      });
    } catch (error) {
      toast({
        message:
          error instanceof Error ? error.message : "Digest transition rejected",
      });
    }
  };

  const needsAction = rows.filter(
    (row) => row.status === "needs-review" || row.status === "failed",
  );
  const processing = rows.filter((row) =>
    ["queued", "processing"].includes(row.status),
  );
  const publications = rows.filter((row) => row.status === "published");
  const activeFailures = rows.filter((row) => row.status === "failed").length;
  const readyIntegrations = snapshot.integrations.filter(
    (item) => item.state === "ready",
  ).length;
  const estimatedBackfill = localOperations.estimateBackfill(
    {
      ...BACKFILL_DEFAULTS,
      dateTo: new Date().toISOString(),
      sourceIds: [],
    },
    100,
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-24">
      <header className="-mx-4 border-b border-ink/20 bg-paper-gray px-4 py-5">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ts-acc-deep)]">
              Internal · production operations
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl">
              TechStage operations desk
            </h1>
            <p className="mt-1 max-w-2xl font-mono text-[11px] leading-relaxed text-ink-faint">
              One canvas for discovery, review, costs, and publishing. Safe
              local mode is locked on.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="live">
              <ShieldCheck className="size-3" /> dry run
            </Badge>
            <Button variant="ink" onClick={() => refresh("all")}>
              <RefreshCw className="size-3.5" /> Refresh all
            </Button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 border border-ink/25 px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors hover:border-ink"
            >
              <ArrowLeft className="size-3" /> Product
            </Link>
          </div>
        </div>
      </header>

      <section className="grid border-x border-b border-ink/20 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          value={snapshot.counts.needsReview}
          label="Needs action"
          note="Editorial decisions"
          tone="warn"
        />
        <Metric
          value={snapshot.counts.processing}
          label="Processing"
          note="Local demo queue"
        />
        <Metric
          value={activeFailures}
          label="Active failures"
          note="Retry or archive"
          tone={activeFailures ? "warn" : "live"}
        />
        <Metric
          value={`${readyIntegrations}/${snapshot.integrations.length}`}
          label="Integrations ready"
          note="Manual intake only"
        />
        <Metric
          value="$0.00"
          label="Monthly usage"
          note="No paid calls made"
          tone="live"
        />
      </section>

      <OpsSection
        id="health"
        icon={HeartPulse}
        title="Integration health"
        summary="Only local, free parsing is active. Every secret-backed operation fails closed."
        onRefresh={refresh}
      >
        <div className="grid border-l border-t border-ink/15 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.integrations.map((integration) => (
            <div
              key={integration.id}
              className="min-h-28 border-b border-r border-ink/15 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{integration.label}</p>
                <Badge
                  tone={
                    integration.state === "ready"
                      ? "live"
                      : integration.state === "degraded"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {integration.state}
                </Badge>
              </div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
                {integration.detail}
              </p>
              {integration.missingEnvironment.length > 0 && (
                <p className="mt-2 truncate font-mono text-[9px] text-warn">
                  Needs {integration.missingEnvironment.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </OpsSection>

      <OpsSection
        id="intake"
        icon={ClipboardPaste}
        title="Manual intake"
        summary="Raw X dumps, event text, and transcripts live only in these fields and are cleared after the local operation."
        onRefresh={refresh}
      >
        <div className="grid gap-px border border-ink/20 bg-ink/20 xl:grid-cols-4">
          <IntakePanel
            icon={Link2}
            title="Priority URL"
            note="Creates one structured candidate; YouTube resolution comes first after activation."
          >
            <Input
              type="url"
              placeholder="https://x.com/... or YouTube URL"
              value={priorityUrl}
              onChange={(event) => setPriorityUrl(event.target.value)}
            />
            <Input
              placeholder="Title (optional)"
              value={priorityTitle}
              onChange={(event) => setPriorityTitle(event.target.value)}
            />
            <TextArea
              rows={3}
              placeholder="Why this matters (optional)"
              value={priorityContext}
              onChange={setPriorityContext}
            />
            <Button
              size="sm"
              variant="ink"
              disabled={!priorityUrl.trim()}
              onClick={() => {
                try {
                  const added = localOperations.submitDrafts([
                    localOperations.createPriorityUrl(
                      priorityUrl,
                      priorityTitle,
                      priorityContext,
                    ),
                  ]);
                  setPriorityUrl("");
                  setPriorityTitle("");
                  setPriorityContext("");
                  setVersion((value) => value + 1);
                  toast({
                    message: `${added} priority candidate added locally`,
                  });
                } catch {
                  toast({ message: "Enter a complete public URL" });
                }
              }}
            >
              <Send className="size-3" /> Add candidate
            </Button>
          </IntakePanel>

          <IntakePanel
            icon={Upload}
            title="X notification dump"
            note="Deterministic keywords propose likely panels; only checked rows are submitted."
          >
            <TextArea
              rows={5}
              placeholder="Paste copied X notifications or feed text…"
              value={xDump}
              onChange={setXDump}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!xDump.trim()}
                onClick={() => {
                  const preview = localOperations.previewXDump(xDump);
                  setXPreview(preview);
                  setXSelected(
                    new Set(
                      preview
                        .filter((item) => item.likelyRelevant)
                        .map((item) => item.id),
                    ),
                  );
                }}
              >
                <Search className="size-3" /> Preview
              </Button>
              <Button
                size="sm"
                variant="ink"
                disabled={!xSelected.size}
                onClick={() => {
                  const added = localOperations.submitDrafts(
                    xPreview.filter((item) => xSelected.has(item.id)),
                  );
                  setXDump("");
                  setXPreview([]);
                  setXSelected(new Set());
                  setVersion((value) => value + 1);
                  toast({
                    message: `${added} X candidate(s) accepted; raw dump cleared`,
                  });
                }}
              >
                <Check className="size-3" /> Accept {xSelected.size || ""}
              </Button>
            </div>
            <PreviewRows
              rows={xPreview}
              selected={xSelected}
              onToggle={(id) => setXSelected(toggleSet(xSelected, id))}
            />
          </IntakePanel>

          <IntakePanel
            icon={CalendarClock}
            title="Event page text"
            note="Parses likely sessions locally. Official RSS, iCal, and JSON-LD remain the first production route."
          >
            <TextArea
              rows={5}
              placeholder="Paste an official agenda or schedule…"
              value={eventDump}
              onChange={setEventDump}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!eventDump.trim()}
                onClick={() =>
                  setEventPreview(localOperations.previewEventText(eventDump))
                }
              >
                <Search className="size-3" /> Preview
              </Button>
              <Button
                size="sm"
                variant="ink"
                disabled={!eventPreview.length}
                onClick={() => {
                  const added = localOperations.submitDrafts(eventPreview);
                  setEventDump("");
                  setEventPreview([]);
                  setVersion((value) => value + 1);
                  toast({
                    message: `${added} event candidate(s) accepted; raw page text cleared`,
                  });
                }}
              >
                <Check className="size-3" /> Accept
              </Button>
            </div>
            <PreviewRows rows={eventPreview} />
          </IntakePanel>

          <IntakePanel
            icon={FileText}
            title="Transcript input"
            note="Estimates Flash-Lite analysis, then immediately clears this field. Model execution stays disabled."
          >
            <TextArea
              rows={5}
              placeholder="Paste a transcript to estimate…"
              value={transcript}
              onChange={setTranscript}
            />
            <Button
              size="sm"
              variant="ink"
              disabled={transcript.trim().length < 40}
              onClick={() => {
                setAnalysisEstimate(
                  localOperations.estimateTranscript(transcript),
                );
                setTranscript("");
                setVersion((value) => value + 1);
                toast({
                  message:
                    "Estimate complete; transcript cleared and not stored",
                });
              }}
            >
              <Sparkles className="size-3" /> Estimate & clear
            </Button>
            {analysisEstimate && (
              <div className="border border-live/30 bg-live-soft p-2 font-mono text-[10px] leading-relaxed">
                <p className="text-live">
                  Estimated ${analysisEstimate.estimatedUsd?.toFixed(5)} ·{" "}
                  {analysisEstimate.inputUnits.toLocaleString()} tokens
                </p>
                <p className="mt-1 text-ink-faint">{analysisEstimate.note}</p>
                <Button size="sm" className="mt-2" disabled>
                  <Play className="size-3" /> Analysis disabled
                </Button>
              </div>
            )}
          </IntakePanel>
        </div>
      </OpsSection>

      <OpsSection
        id="needs-action"
        icon={Inbox}
        title="Needs action"
        summary="Rights, missing inputs, duplicates, entity matches, and assets all converge here."
        onRefresh={refresh}
      >
        {needsAction.length ? (
          <CandidateTable
            rows={needsAction}
            expanded={expandedCandidate}
            setExpanded={setExpandedCandidate}
            onSetStatus={setStatus}
          />
        ) : (
          !snapshot.assets.length && (
            <EmptyState
              title="No editorial blockers"
              hint="Rights and asset tasks will appear here after providers are activated."
              className="py-8"
            />
          )
        )}
        <AssetReviewTable rows={snapshot.assets} />
      </OpsSection>

      <OpsSection
        id="queue"
        icon={Search}
        title="Discovery queue"
        summary={`${rows.length} local seed candidates plus ${localOperations.listDrafts().length} structured manual previews. Production uses the 18-stage idempotent state machine.`}
        onRefresh={refresh}
      >
        {candidates.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <RowSkeleton key={index} />
            ))}
          </div>
        ) : (
          <CandidateTable
            rows={rows}
            expanded={expandedCandidate}
            setExpanded={setExpandedCandidate}
            onSetStatus={setStatus}
          />
        )}
        {localOperations.listDrafts().length > 0 && (
          <div className="mt-3 border border-ink/15">
            <p className="border-b border-ink/15 bg-paper-gray px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
              Structured manual previews · local memory only
            </p>
            {localOperations.listDrafts().map((draft) => (
              <div
                key={draft.canonicalFingerprint}
                className="flex items-start justify-between gap-3 border-b border-ink/10 px-3 py-2 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-semibold">{draft.title}</p>
                  <p className="mt-1 font-mono text-[9px] text-ink-faint">
                    {draft.sourceLabel} · {draft.canonicalFingerprint}
                  </p>
                </div>
                <Badge tone={draft.likelyRelevant ? "live" : "neutral"}>
                  {draft.likelyRelevant ? "likely relevant" : "review"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </OpsSection>

      <OpsSection
        id="processing"
        icon={GitBranch}
        title="Processing"
        summary="Retries are bounded, transitions are audited, and blocked stages cannot skip their predecessor."
        onRefresh={refresh}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {processing.length ? (
            <CandidateTable
              rows={processing}
              expanded={expandedCandidate}
              setExpanded={setExpandedCandidate}
              onSetStatus={setStatus}
            />
          ) : (
            <EmptyState title="No jobs running" className="py-8" />
          )}
          <div className="border border-ink/15 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
              Production state machine
            </p>
            <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
              {PRODUCTION_PIPELINE_ORDER.map((stage, index) => (
                <li key={stage} className="font-mono text-[9px] text-ink-soft">
                  <span className="mr-1 text-ink-faint">{index + 1}.</span>
                  {stage}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </OpsSection>

      <OpsSection
        id="digest-queue"
        icon={Inbox}
        title="Stage Notes queue"
        summary={`A digest becomes eligible at 4 published appearances or after the ${digestSnapshot.queue.maxAgeDays}-day freshness backstop. Editorial approval remains mandatory.`}
        onRefresh={refresh}
      >
        <div className="grid gap-px border border-ink/20 bg-ink/20 md:grid-cols-4">
          <Metric
            value={`${digestSnapshot.queue.pendingPanelIds.length}/${digestSnapshot.queue.threshold}`}
            label="Panels waiting"
            note="Since the last eligible scan"
          />
          <Metric
            value={digestSnapshot.queue.maxAgeDays}
            label="Day backstop"
            note="Prevents a quiet-week stall"
          />
          <Metric
            value={digestSnapshot.queue.approvalRequired ? "On" : "Off"}
            label="Human approval"
            note="Required before any delivery"
            tone="live"
          />
          <Metric
            value={digestSnapshot.queue.killSwitchEnabled ? "Paused" : "Armed"}
            label="Delivery switch"
            note="Dry run still prevents external sends"
            tone={digestSnapshot.queue.killSwitchEnabled ? "warn" : "live"}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-ink/15 bg-paper-gray p-3">
          <p className="max-w-3xl font-mono text-[10px] leading-relaxed text-ink-faint">
            Oldest pending appearance:{" "}
            {digestSnapshot.queue.oldestPendingAt
              ? new Date(digestSnapshot.queue.oldestPendingAt).toLocaleString()
              : "none"}
            . Threshold scans are idempotent and lock their selected appearance
            IDs before generation.
          </p>
          <Button
            size="sm"
            variant={digestSnapshot.queue.killSwitchEnabled ? "ink" : "outline"}
            onClick={() => {
              localDigests.setKillSwitch(
                !digestSnapshot.queue.killSwitchEnabled,
              );
              setVersion((value) => value + 1);
              toast({
                message: digestSnapshot.queue.killSwitchEnabled
                  ? "Local delivery switch armed"
                  : "Local delivery switch paused",
              });
            }}
          >
            {digestSnapshot.queue.killSwitchEnabled
              ? "Arm delivery"
              : "Pause delivery"}
          </Button>
        </div>
      </OpsSection>

      <OpsSection
        id="digest-review"
        icon={FileText}
        title="Issue review and delivery"
        summary="Generation, review, approval, and delivery are separate states. This workspace can render the complete email but cannot contact subscribers in safe local mode."
        onRefresh={refresh}
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="border border-ink/15">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/15 bg-paper-gray p-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                  Issue №{" "}
                  {String(digestSnapshot.issue.issueNumber).padStart(3, "0")}
                </p>
                <h3 className="mt-1 font-serif text-2xl">
                  {digestSnapshot.issue.title}
                </h3>
                <p className="mt-1 text-xs text-ink-soft">
                  {digestSnapshot.issue.panels.length} official-source panels ·{" "}
                  {digestSnapshot.issue.readingMinutes} minute read
                </p>
              </div>
              <Badge
                tone={
                  digestSnapshot.issue.status === "approved" ||
                  digestSnapshot.issue.status === "sent"
                    ? "live"
                    : digestSnapshot.issue.status === "failed"
                      ? "warn"
                      : "accent"
                }
              >
                {digestSnapshot.issue.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="grid gap-px bg-ink/10 sm:grid-cols-2">
              {digestSnapshot.issue.panels.map((panel) => (
                <div key={panel.id} className="bg-paper p-3">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ts-acc-deep)]">
                    {panel.event}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{panel.title}</p>
                  <a
                    href={panel.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] text-ink-faint hover:text-[var(--ts-acc-deep)]"
                  >
                    Official source <ExternalLink className="size-2.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="border border-ink/15 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                Rendered email
              </p>
              <p className="mt-2 font-serif text-3xl">
                {(digestSnapshot.emailBytes / 1024).toFixed(1)} KB
              </p>
              <p className="mt-1 font-mono text-[9px] text-live">
                Below 102 KB delivery ceiling
              </p>
              <p className="mt-3 border-t border-ink/10 pt-3 font-mono text-[9px] text-ink-faint">
                Generation estimate · ${digestSnapshot.issue.costUsd.toFixed(2)}{" "}
                / issue
              </p>
            </div>
            <div className="border border-ink/15 p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                QA gates · local placeholder mode
              </p>
              <div className="mt-2 space-y-1">
                {digestGates.map((gate) => (
                  <div
                    key={gate.gate}
                    className="flex items-center justify-between gap-2 font-mono text-[8px]"
                  >
                    <span>{gate.gate}</span>
                    <span className={gate.passed ? "text-live" : "text-warn"}>
                      {gate.passed ? "pass" : "block"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Link
              to={`/stage-notes/${digestSnapshot.issue.slug}`}
              className="flex items-center justify-between border border-ink/20 px-4 py-3 font-mono text-[10px] uppercase tracking-widest hover:border-ink"
            >
              Open web preview <ExternalLink className="size-3" />
            </Link>
            <div className="grid gap-2">
              {digestSnapshot.issue.status === "pending" && (
                <Button
                  variant="ink"
                  onClick={() => setDigestStatus("generating")}
                >
                  <Sparkles className="size-3.5" /> Start generation
                </Button>
              )}
              {digestSnapshot.issue.status === "generating" && (
                <Button
                  variant="ink"
                  onClick={() => setDigestStatus("needs_review")}
                >
                  <Check className="size-3.5" /> Complete generation
                </Button>
              )}
              {digestSnapshot.issue.status === "needs_review" && (
                <>
                  <Button
                    variant="ink"
                    onClick={() => setDigestStatus("approved")}
                  >
                    <Check className="size-3.5" /> Approve issue
                  </Button>
                  <Button onClick={() => setDigestStatus("generating")}>
                    <RefreshCw className="size-3.5" /> Regenerate
                  </Button>
                </>
              )}
              {digestSnapshot.issue.status === "approved" && (
                <Button
                  variant="ink"
                  onClick={() => setDigestStatus("sending")}
                >
                  <Send className="size-3.5" /> Simulate send handoff
                </Button>
              )}
              {digestSnapshot.issue.status === "sending" && (
                <Button variant="ink" onClick={() => setDigestStatus("sent")}>
                  <Check className="size-3.5" /> Simulate provider accepted
                </Button>
              )}
              {digestSnapshot.issue.status === "failed" && (
                <>
                  <Button
                    variant="ink"
                    onClick={() => setDigestStatus("generating")}
                  >
                    <RefreshCw className="size-3.5" /> Retry generation
                  </Button>
                  <Button onClick={() => setDigestStatus("pending")}>
                    Return to pending
                  </Button>
                </>
              )}
              {digestSnapshot.issue.status === "sent" && (
                <Button
                  onClick={() => {
                    localDigests.reset("pending");
                    setVersion((value) => value + 1);
                    toast({ message: "Local issue reset to pending" });
                  }}
                >
                  Reset simulation
                </Button>
              )}
              {[
                "pending",
                "generating",
                "needs_review",
                "approved",
                "sending",
              ].includes(digestSnapshot.issue.status) && (
                <Button
                  variant="ghost"
                  onClick={() => setDigestStatus("failed")}
                >
                  <X className="size-3.5" /> Simulate failure
                </Button>
              )}
            </div>
            <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
              No live subscribers are queried and Resend is never called from
              this preview. The production worker also checks approval, the
              delivery switch, and an idempotency key.
            </p>
          </div>
        </div>
      </OpsSection>

      <OpsSection
        id="sources"
        icon={Database}
        title="Source registry"
        summary="The first activation task is supplying the reviewed 100-channel and registered-handle lists."
        onRefresh={refresh}
      >
        <div className="grid gap-px border border-ink/20 bg-ink/20 sm:grid-cols-4">
          <RegistryTarget
            value="0 / 100"
            label="YouTube channels"
            note="Upload playlists and WebSub leases"
          />
          <RegistryTarget
            value="0 / 100"
            label="X handles"
            note="Manual-first; grouped weekly safety pass"
          />
          <RegistryTarget
            value="0 / 200"
            label="Event URLs"
            note="Narrow official schedules only"
          />
          <RegistryTarget
            value="0"
            label="Official feeds"
            note="RSS, iCal, JSON-LD, calendar exports"
          />
        </div>
      </OpsSection>

      <OpsSection
        id="costs"
        icon={CircleDollarSign}
        title="Costs and schedules"
        summary="Every provider stops before crossing its application ceiling; unknown-cost X video is approval-only."
        onRefresh={refresh}
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr_320px]">
          <div>
            <TableLabel>Provider budgets</TableLabel>
            <div className="border border-ink/15">
              {snapshot.budgets.map((budget) => (
                <div
                  key={budget.provider}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-ink/10 px-3 py-2 font-mono text-[10px] last:border-b-0"
                >
                  <span>{budget.provider}</span>
                  <span className="text-ink-faint">
                    {budget.hardCreditLimit
                      ? `${budget.usedCredits}/${budget.hardCreditLimit} credits`
                      : budget.hardRequestLimit
                        ? `${budget.usedRequests}/${budget.hardRequestLimit} calls`
                        : "quota only"}
                  </span>
                  <span className="text-live">
                    ${budget.usedUsd.toFixed(2)}
                    {budget.hardLimitUsd ? ` / $${budget.hardLimitUsd}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <TableLabel>Configured schedules</TableLabel>
            <div className="border border-ink/15">
              {PRODUCTION_SCHEDULES.map((schedule) => (
                <div
                  key={schedule.id}
                  className="border-b border-ink/10 px-3 py-2 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px]">{schedule.id}</p>
                    <Badge>
                      {schedule.enabledByDefault ? "enabled" : "inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-ink-faint">
                    {schedule.cadence} · {schedule.localTime} ·{" "}
                    {schedule.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-[var(--ts-acc)] bg-[var(--ts-acc-15)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">
              2026 backfill dry run
            </p>
            <p className="mt-3 font-serif text-3xl">
              {estimatedBackfill.expectedCandidates.toLocaleString()}
            </p>
            <p className="font-mono text-[10px] text-ink-faint">
              maximum expected candidates
            </p>
            <div className="mt-4 space-y-1 font-mono text-[10px]">
              <p>
                {estimatedBackfill.youtubeQuotaUnits.toLocaleString()} estimated
                YouTube quota units
              </p>
              <p>
                {estimatedBackfill.batches.toLocaleString()} batches of{" "}
                {BACKFILL_DEFAULTS.batchSize}
              </p>
              <p>Hard ceiling ${BACKFILL_DEFAULTS.maximumUsd}</p>
            </div>
            <Button size="sm" className="mt-4" disabled>
              Dry run not executed
            </Button>
          </div>
        </div>
      </OpsSection>

      <OpsSection
        id="published"
        icon={Check}
        title="Recent publications"
        summary="Publishing remains impossible without a canonical source and a completed rights review."
        onRefresh={refresh}
      >
        {publications.length ? (
          <CandidateTable
            rows={publications}
            expanded={expandedCandidate}
            setExpanded={setExpandedCandidate}
            onSetStatus={setStatus}
          />
        ) : (
          <EmptyState title="No recent publications" className="py-8" />
        )}
      </OpsSection>

      <OpsSection
        id="audit"
        icon={ShieldCheck}
        title="Audit history"
        summary="Append-only production records contain identifiers and bounded detail—not copied source content."
        onRefresh={refresh}
      >
        <div className="border border-ink/15">
          {snapshot.audit.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-1 border-b border-ink/10 px-3 py-2 font-mono text-[10px] last:border-b-0 sm:grid-cols-[180px_180px_1fr]"
            >
              <span className="text-ink-faint">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
              <span>{entry.action}</span>
              <span className="text-ink-soft">{entry.detail}</span>
            </div>
          ))}
        </div>
      </OpsSection>
    </main>
  );
}

function LiveBlockerTable({
  rows,
  onAction,
}: {
  rows: Array<Record<string, unknown>>;
  onAction: (action: string, id?: string, detail?: string) => Promise<void>;
}) {
  const [reasonFilter, setReasonFilter] = useState("all");
  if (!rows.length)
    return (
      <EmptyState
        title="No media fixes"
        hint="Every currently queued appearance passed the public-readiness gate."
        className="py-10"
      />
    );
  const reasons = Array.from(
    new Set(rows.map((row) => String(row.blocker_code ?? "other"))),
  );
  const visible =
    reasonFilter === "all"
      ? rows
      : rows.filter(
          (row) => String(row.blocker_code ?? "other") === reasonFilter,
        );
  return (
    <section className="border border-ink/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 bg-paper-gray px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc2-deep)]">
          {visible.length} recording fixes · incomplete talks stay hidden
        </p>
        <select
          value={reasonFilter}
          onChange={(event) => setReasonFilter(event.target.value)}
          className="border border-ink/20 bg-paper px-2 py-1 font-mono text-[9px] uppercase"
        >
          <option value="all">All actions</option>
          {reasons.map((reason) => (
            <option key={reason} value={reason}>
              {plainBlockerLabel(reason)}
            </option>
          ))}
        </select>
      </div>
      {visible.map((row, index) => (
        <LiveBlockerRow
          key={String(row.id)}
          row={row}
          index={index + 1}
          onAction={onAction}
        />
      ))}
    </section>
  );
}

function LiveBlockerRow({
  row,
  index,
  onAction,
}: {
  row: Record<string, unknown>;
  index: number;
  onAction: (action: string, id?: string, detail?: string) => Promise<void>;
}) {
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [speakers, setSpeakers] = useState("");
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const sourceUrl = String(row.source_url ?? "");
  const appearance =
    row.appearance && typeof row.appearance === "object"
      ? (row.appearance as Record<string, unknown>)
      : {};
  const media =
    appearance.canonical_media && typeof appearance.canonical_media === "object"
      ? (appearance.canonical_media as Record<string, unknown>)
      : {};
  const thumbnail = String(media.thumbnail_url ?? "");
  const reason = plainBlockerReason(
    String(row.blocker_code ?? ""),
    String(row.blocker_reason ?? row.requested_action ?? ""),
  );
  return (
    <div className="border-b border-ink/10 p-3 last:border-b-0">
      <div className="grid items-start gap-3 sm:grid-cols-[36px_82px_130px_minmax(0,1fr)_auto]">
        <span className="grid size-8 place-items-center bg-[var(--ts-acc2)] font-mono text-xs text-paper">
          {String(index).padStart(2, "0")}
        </span>
        <div className="grid aspect-video w-20 place-items-center overflow-hidden border border-ink/15 bg-paper-gray">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-4 text-ink-faint" />
          )}
        </div>
        <span className="border border-[var(--ts-acc2)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--ts-acc2-deep)]">
          {plainBlockerLabel(String(row.blocker_code ?? ""))}
        </span>
        <div>
          <p className="text-sm font-semibold">{String(row.title)}</p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-faint">
            {reason}
          </p>
        </div>
        {isApprovedAdminLink(sourceUrl) && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-[var(--ts-acc-deep)] hover:underline"
          >
            Current source ↗
          </a>
        )}
      </div>
      <div className="mt-3 grid gap-2 pl-0 sm:pl-[118px] md:grid-cols-2">
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Required: official YouTube link"
        />
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title (optional)"
        />
        <Input
          value={speakers}
          onChange={(event) => setSpeakers(event.target.value)}
          placeholder="Relevant speakers, comma-separated (optional)"
        />
        <Input
          type="url"
          value={transcriptUrl}
          onChange={(event) => setTranscriptUrl(event.target.value)}
          placeholder="Transcript URL (optional)"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-0 sm:pl-[118px]">
        <Button
          size="sm"
          variant="ink"
          disabled={!url}
          onClick={() =>
            void onAction(
              "submit-replacement-url",
              String(row.id),
              JSON.stringify({
                url,
                title,
                speakers: speakers
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                transcriptUrl,
              }),
            )
              .then(() =>
                toast({
                  message: "Official link queued without a YouTube search.",
                }),
              )
              .catch((error) =>
                toast({
                  message:
                    error instanceof Error ? error.message : "Link rejected.",
                }),
              )
          }
        >
          Use this link
        </Button>
        <Button
          size="sm"
          onClick={() =>
            void onAction("archive-candidate", String(row.id)).then(() =>
              toast({ message: "Item archived." }),
            )
          }
        >
          <Archive className="size-3" /> Archive
        </Button>
      </div>
    </div>
  );
}

function plainBlockerLabel(code: string) {
  return (
    (
      {
        "needs-official-playable-url": "Missing video",
        "non-embeddable-source": "Cannot embed",
        "needs-approved-transcript": "Needs transcript",
        "analysis-provider-rejected-media": "Analysis failed",
        "identity-channel-mismatch": "Wrong match",
        "rights-verification-required": "Check rights",
        "schema-evidence-validation-failed": "Analysis incomplete",
        "budget-prevented-processing": "Budget stopped",
      } as Record<string, string>
    )[code] ?? "Needs review"
  );
}

function plainBlockerReason(code: string, fallback: string): string {
  const reasons: Record<string, string> = {
    "needs-official-playable-url":
      "We could not confirm an official playable recording. Paste the official YouTube link below.",
    "non-embeddable-source":
      "The current recording cannot play inside TechStage. Add an official embeddable YouTube version.",
    "needs-approved-transcript":
      "The recording is known, but its analysis still needs an approved transcript.",
    "analysis-provider-rejected-media":
      "The analysis service could not read this recording. Check the source or provide a replacement.",
    "identity-channel-mismatch":
      "The title or speaker did not match the official channel strongly enough to publish safely.",
    "rights-verification-required":
      "We need to confirm that this recording may be embedded before publishing it.",
    "schema-evidence-validation-failed":
      "The analysis was incomplete or could not be tied back to the recording.",
    "budget-prevented-processing":
      "Processing stopped before it could exceed the approved cost limit.",
  };
  return (
    reasons[code] ??
    (fallback ||
      "This talk is hidden until its recording is complete and verified.")
  );
}

function isApprovedAdminLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.hostname.endsWith("example.com");
  } catch {
    return false;
  }
}

function LiveEntityWorkspace({
  type,
  verified,
  rows,
  onAction,
  onRefresh,
}: {
  type: "company" | "speaker" | "event";
  verified: Array<Record<string, unknown>>;
  rows: Array<Record<string, unknown>>;
  onAction: (action: string, id?: string, detail?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [prepareQuery, setPrepareQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [prepareSort, setPrepareSort] = useState<
    "az" | "recent" | "prominence"
  >("prominence");
  const [activeSort, setActiveSort] = useState<"az" | "recent" | "prominence">(
    "prominence",
  );
  const [prepareOpen, setPrepareOpen] = useState(true);
  const [activeOpen, setActiveOpen] = useState(true);
  const plural = type === "company" ? "companies" : `${type}s`;
  const filter = (query: string) => (row: Record<string, unknown>) =>
    String(row.name ?? "")
      .toLowerCase()
      .includes(query.toLowerCase());
  const order =
    (sort: "az" | "recent" | "prominence") =>
    (left: Record<string, unknown>, right: Record<string, unknown>) =>
      sort === "az"
        ? String(left.name).localeCompare(String(right.name))
        : sort === "prominence"
          ? Number(right.prominence_score ?? 0) -
              Number(left.prominence_score ?? 0) ||
            String(left.name).localeCompare(String(right.name))
          : String(right.created_at ?? "").localeCompare(
              String(left.created_at ?? ""),
            );
  const approved = verified.filter(filter(activeQuery)).sort(order(activeSort));
  const staged = rows
    .filter(
      (row) =>
        row.status !== "activated" &&
        row.status !== "archived" &&
        filter(prepareQuery)(row),
    )
    .sort(order(prepareSort));
  const controls = (
    query: string,
    setQuery: (value: string) => void,
    sort: "az" | "recent" | "prominence",
    setSort: (value: "az" | "recent" | "prominence") => void,
    label: string,
  ) => (
    <div className="flex min-w-0 flex-1 gap-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${label}`}
      />
      <select
        value={sort}
        onChange={(event) =>
          setSort(event.target.value as "az" | "recent" | "prominence")
        }
        className="border border-ink/20 bg-paper px-2 font-mono text-[9px] uppercase"
      >
        <option value="prominence">Prominence</option>
        <option value="az">A–Z</option>
        <option value="recent">Recently added</option>
      </select>
    </div>
  );
  return (
    <section>
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">
          Live database
        </p>
        <h2 className="font-serif text-3xl capitalize">{plural}</h2>
        <p className="mt-1 font-mono text-[9px] text-ink-faint">
          {staged.length} awaiting action · {approved.length} active
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border border-ink/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 bg-paper-gray p-3">
            <button
              onClick={() => setPrepareOpen((value) => !value)}
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc2-deep)]"
            >
              {prepareOpen ? "−" : "+"} Preparing · {staged.length}
            </button>
            {controls(
              prepareQuery,
              setPrepareQuery,
              prepareSort,
              setPrepareSort,
              plural,
            )}
          </div>
          {prepareOpen && (
            <div className="p-3">
              {staged.length ? (
                <LiveEntityGrid
                  type={type}
                  rows={staged}
                  onAction={onAction}
                  onRefresh={onRefresh}
                />
              ) : (
                <EmptyState
                  title={`No staged ${plural}`}
                  hint="The daily expansion imports them here for image review."
                  className="py-10"
                />
              )}
            </div>
          )}
        </section>
        <section className="border border-ink/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 bg-paper-gray p-3">
            <button
              onClick={() => setActiveOpen((value) => !value)}
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]"
            >
              {activeOpen ? "−" : "+"} Active · {approved.length}
            </button>
            {controls(
              activeQuery,
              setActiveQuery,
              activeSort,
              setActiveSort,
              plural,
            )}
          </div>
          {activeOpen && (
            <div className="grid grid-cols-2 gap-px bg-ink/15 p-3 sm:grid-cols-3">
              {approved.map((row) => (
                <LiveActiveEntityCard
                  key={String(row.id)}
                  row={row}
                  type={type}
                  onAction={onAction}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function LiveActiveEntityCard({
  row,
  type,
  onAction,
}: {
  row: Record<string, unknown>;
  type: "company" | "speaker" | "event";
  onAction: (action: string, id?: string, detail?: string) => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const upload = async (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 6_000_000
    )
      throw new Error("Use a JPEG, PNG, or WebP no larger than 6 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    const form = new FormData();
    form.set("entityId", String(row.id));
    form.set("entityType", type);
    form.set("file", file);
    const response = await fetch(
      `${CLIENT_RUNTIME_CONFIG.supabaseUrl}/functions/v1/admin-asset-upload`,
      {
        method: "POST",
        headers: { apikey: CLIENT_RUNTIME_CONFIG.supabasePublishableKey ?? "" },
        body: form,
      },
    );
    const result = (await response.json()) as {
      revisionId?: string;
      error?: string;
    };
    if (!response.ok)
      throw new Error(result.error ?? "Image upload was rejected.");
    setRevisionId(result.revisionId ?? null);
  };
  return (
    <article
      tabIndex={0}
      onPaste={(event) =>
        void upload(
          Array.from(event.clipboardData.files).find((file) =>
            file.type.startsWith("image/"),
          ),
        ).catch((error) => toast({ message: error.message }))
      }
      className="min-w-0 bg-paper p-2.5"
    >
      <button
        onClick={() => setOpen((value) => !value)}
        className="block w-full text-left"
      >
        <div className="aspect-[4/3] overflow-hidden bg-paper-gray">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : row.image_url ? (
            <img
              src={String(row.image_url)}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <ImageIcon className="size-4 text-ink-faint" />
            </div>
          )}
        </div>
        <p className="mt-2 truncate text-xs font-semibold">
          {String(row.name)}
        </p>
        <p className="mt-0.5 truncate font-mono text-[8px] text-ink-faint">
          Published · {formatAdminDate(row.created_at)}
        </p>
      </button>
      {open && (
        <div className="mt-2 border-t border-ink/10 pt-2">
          <p className="font-mono text-[8px] text-ink-faint">
            Edit stages an image for the next daily intake. Cancel discards the
            staged change.
          </p>
          <label className="mt-2 block cursor-pointer border border-dashed border-ink/25 p-2 text-center font-mono text-[8px] uppercase text-ink-faint">
            Drop, choose, or paste
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                void upload(event.target.files?.[0]).catch((error) =>
                  toast({ message: error.message }),
                )
              }
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {revisionId && (
              <>
                <Button
                  size="sm"
                  variant="ink"
                  onClick={() =>
                    void onAction(
                      "schedule-entity-image-revision",
                      revisionId,
                    ).then(() =>
                      toast({
                        message:
                          "Image change scheduled for the next daily automation.",
                      }),
                    )
                  }
                >
                  Activate change
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    void onAction(
                      "cancel-entity-image-revision",
                      revisionId,
                    ).then(() => {
                      setRevisionId(null);
                      setPreview(null);
                      toast({ message: "Image change discarded." });
                    })
                  }
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() =>
                void onAction(
                  "archive-active-entity",
                  String(row.id),
                  type,
                ).then(() =>
                  toast({
                    message: "Entity archived and its discovery paused.",
                  }),
                )
              }
            >
              <Archive className="size-3" /> Archive
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function LiveEntityGrid({
  type,
  rows,
  onAction,
  onRefresh,
}: {
  type: string;
  rows: Array<Record<string, unknown>>;
  onAction: (action: string, id?: string, detail?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title={`No staged ${type}s`}
        hint="The noon expansion routine adds unique candidates here for your image review."
        className="py-10"
      />
    );
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {rows.map((row) => (
        <LiveEntityCard
          key={String(row.id)}
          row={row}
          onAction={onAction}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

function LiveEntityCard({
  row,
  onAction,
  onRefresh,
}: {
  row: Record<string, unknown>;
  onAction: (action: string, id?: string, detail?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const upload = async (file: File) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 6_000_000
    )
      throw new Error("Use a JPEG, PNG, or WebP no larger than 6 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    const form = new FormData();
    form.set("candidateId", String(row.id));
    form.set("file", file);
    const response = await fetch(
      `${CLIENT_RUNTIME_CONFIG.supabaseUrl}/functions/v1/admin-asset-upload`,
      {
        method: "POST",
        headers: { apikey: CLIENT_RUNTIME_CONFIG.supabasePublishableKey ?? "" },
        body: form,
      },
    );
    if (!response.ok) throw new Error("Image upload was rejected.");
    onRefresh();
  };
  const canActivate =
    row.image_status === "verified" && Boolean(row.image_asset_id);
  const acceptFile = (file?: File) => {
    if (!file) return;
    void upload(file)
      .then(() => toast({ message: "Image uploaded for review." }))
      .catch((error) =>
        toast({
          message: error instanceof Error ? error.message : "Upload failed.",
        }),
      );
  };
  const imageStatus = String(row.image_status ?? "missing");
  return (
    <article
      tabIndex={0}
      onPaste={(event) =>
        acceptFile(
          Array.from(event.clipboardData.files).find((file) =>
            file.type.startsWith("image/"),
          ),
        )
      }
      className="group min-w-0 border border-ink/15 bg-paper p-2 outline-none transition-colors focus:border-[var(--ts-acc)] focus:bg-[var(--ts-acc-15)]"
    >
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden border border-dashed text-center",
          dragging
            ? "border-[var(--ts-acc)] bg-[var(--ts-acc-15-solid)]"
            : "border-ink/25 bg-paper-gray group-hover:border-ink/50",
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : imageStatus === "verified" ? (
          <div className="grid size-full place-items-center bg-live/10">
            <Check className="size-5 text-live" />
            <span className="absolute bottom-2 font-mono text-[8px] uppercase text-live">
              Image ready
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="size-4 text-ink-faint" />
            <span className="font-mono text-[8px] uppercase leading-tight text-ink-faint">
              {imageStatus === "pending" || imageStatus === "processing"
                ? "Preparing…"
                : "Drop, choose, or paste"}
            </span>
          </div>
        )}
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => acceptFile(event.target.files?.[0])}
        />
      </label>
      <div className="pt-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{String(row.name)}</p>
            <p className="mt-1 break-words font-mono text-[8px] text-ink-faint">
              {String(row.name)}
            </p>
          </div>
          <Badge tone={canActivate ? "live" : "neutral"}>
            {canActivate ? "Ready" : imageStatus}
          </Badge>
        </div>
        <Button
          className="mt-2 w-full justify-center"
          size="sm"
          variant="ink"
          disabled={!canActivate}
          onClick={() =>
            void onAction("approve-activate-entity", String(row.id))
              .then(() => {
                toast({
                  message: "Entity activated and queued for discovery.",
                });
                onRefresh();
              })
              .catch((error) =>
                toast({
                  message:
                    error instanceof Error
                      ? error.message
                      : "Activation rejected.",
                }),
              )
          }
        >
          Activate
        </Button>
      </div>
    </article>
  );
}

function CostSchedulePanel({
  costDays,
  campaign,
  dailyUsage,
  youtubeUsage,
}: {
  costDays: Array<{
    date: string;
    total_usd: number;
    entries: Array<Record<string, unknown>>;
  }>;
  campaign?: Record<string, unknown> | null;
  dailyUsage?: Array<Record<string, unknown>>;
  youtubeUsage?: Array<Record<string, unknown>>;
}) {
  const today = chicagoToday();
  const [selected, setSelected] = useState(today);
  const byDate = new Map(costDays.map((day) => [day.date, day]));
  const calendar = chicagoCalendarDays(today);
  const month = today.slice(0, 7);
  const monthTotal = costDays
    .filter((day) => day.date.startsWith(month))
    .reduce((sum, day) => sum + day.total_usd, 0);
  const selectedDay = byDate.get(selected);
  return (
    <section>
      {campaign && (
        <BackfillCampaignPanel
          campaign={campaign}
          usage={dailyUsage ?? []}
          youtubeUsage={youtubeUsage ?? []}
        />
      )}
      <div className="grid border-l border-t border-ink/20 sm:grid-cols-2">
        <Metric
          value={`$${monthTotal.toFixed(6)}`}
          label="Current month actual spend"
          note="Runtime provider usage only"
          tone="live"
        />
        <Metric
          value={costDays.length}
          label="Cost days recorded"
          note="Reconciled and zero-cost records excluded"
          tone="live"
        />
      </div>
      <div className="mt-4 border border-ink/20 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[var(--ts-acc-deep)]" />
            <p className="font-mono text-[10px] uppercase tracking-widest">
              Chicago cost calendar
            </p>
          </div>
          <p className="font-mono text-[10px] text-live">
            {month} · ${monthTotal.toFixed(6)}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] gap-px bg-ink/15">
          <>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="bg-paper-gray p-2 text-center font-mono text-[9px] uppercase text-ink-faint"
              >
                {day}
              </div>
            ))}
          </>
          <div className="bg-paper-gray p-2 font-mono text-[9px] uppercase text-ink-faint">
            Week
          </div>
          {Array.from({ length: 4 }, (_, week) => {
            const days = calendar.slice(week * 7, week * 7 + 7);
            const total = days.reduce(
              (sum, date) => sum + (byDate.get(date)?.total_usd ?? 0),
              0,
            );
            return (
              <>
                <>
                  {days.map((date) => {
                    const day = byDate.get(date);
                    const isToday = date === today;
                    return (
                      <button
                        key={date}
                        onClick={() => setSelected(date)}
                        className={cn(
                          "min-h-20 p-2 text-left",
                          selected === date
                            ? "bg-[var(--ts-acc-15-solid)]"
                            : "bg-paper",
                          isToday && "ring-2 ring-inset ring-[var(--ts-acc)]",
                        )}
                      >
                        <span className="font-mono text-[9px] text-ink-faint">
                          {date.slice(-2)}
                        </span>
                        {day && (
                          <>
                            <span className="mt-2 block size-1.5 rounded-full bg-live" />
                            <span className="mt-1 block font-mono text-[9px] text-live">
                              ${day.total_usd.toFixed(6)}
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </>
                <div className="bg-paper p-2 font-mono text-[9px] text-live">
                  ${total.toFixed(6)}
                </div>
              </>
            );
          })}
        </div>
      </div>
      <div className="mt-4 border border-ink/20">
        <div className="flex items-center justify-between border-b border-ink/15 bg-paper-gray px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest">
            {formatChicagoDay(selected)}
          </p>
          <span className="font-mono text-[10px] text-live">
            ${(selectedDay?.total_usd ?? 0).toFixed(6)}
          </span>
        </div>
        {selectedDay?.entries.length ? (
          selectedDay.entries.map((row, index) => (
            <div
              key={String(row.id ?? index)}
              className="grid grid-cols-[1fr_auto] gap-3 border-b border-ink/10 px-3 py-2 font-mono text-[10px] last:border-b-0"
            >
              <span>
                {row.job_name ? String(row.job_name) : "Other runtime usage"} ·{" "}
                {String(row.operation ?? "provider call").replaceAll("-", " ")}
              </span>
              <span className="text-live">
                ${Number(row.actual_usd ?? 0).toFixed(6)}
              </span>
            </div>
          ))
        ) : (
          <p className="p-4 font-mono text-[10px] text-ink-faint">
            No paid runtime usage on this Chicago day.
          </p>
        )}
      </div>
    </section>
  );
}

function chicagoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function chicagoCalendarDays(today: string) {
  const base = new Date(`${today}T12:00:00Z`);
  const mondayOffset = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - mondayOffset - 21);
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}
function formatChicagoDay(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function BackfillCampaignPanel({
  campaign,
  usage,
  youtubeUsage,
}: {
  campaign: Record<string, unknown>;
  usage: Array<Record<string, unknown>>;
  youtubeUsage: Array<Record<string, unknown>>;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const current = usage.find((row) => String(row.usage_date) === today) ?? {};
  const start = String(campaign.campaign_start_date ?? "");
  const end = String(campaign.campaign_end_date ?? "");
  const mode =
    today >= start && today <= end ? "10-day campaign" : "steady state";
  const transcriptLimit = Number(
    today >= start && today <= end
      ? campaign.campaign_transcript_daily_limit
      : campaign.steady_transcript_daily_limit,
  );
  const videoLimit = Number(
    today >= start && today <= end
      ? campaign.campaign_video_daily_limit
      : campaign.steady_video_daily_limit,
  );
  const youtube = youtubeUsage[0] ?? {};
  return (
    <section className="mb-4 border border-ink/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 bg-ink px-3 py-2 text-paper">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/60">
            Entity backfill
          </p>
          <p className="mt-0.5 text-sm font-semibold">{mode}</p>
        </div>
        <span className="font-mono text-[9px]">
          {start} → {end}
        </span>
      </div>
      <div className="grid border-l border-t border-ink/15 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          value={`${Number(current.transcript_started ?? 0)} / ${transcriptLimit}`}
          label="Transcript lane"
          note={`$${Number(current.transcript_actual_usd ?? 0).toFixed(4)} actual`}
          tone="live"
        />
        <Metric
          value={`${Number(current.video_started ?? 0)} / ${videoLimit}`}
          label="Video lane"
          note={`$${Number(current.video_actual_usd ?? 0).toFixed(4)} actual`}
        />
        <Metric
          value={`${Number(youtube.search_count ?? 0)} / ${Number(campaign.youtube_search_daily_limit ?? 100)}`}
          label="YouTube searches"
          note="Quota resets Pacific time"
        />
        <Metric
          value={`$${(Number(current.transcript_actual_usd ?? 0) + Number(current.video_actual_usd ?? 0)).toFixed(4)}`}
          label="Today's model spend"
          note="Reservations enforced before calls"
          tone="live"
        />
      </div>
    </section>
  );
}

function ArchivedItems({
  rows,
  onRestore,
}: {
  rows: Array<Record<string, unknown>>;
  onRestore: (id: string, type?: string) => Promise<void>;
}) {
  const toast = useToast();
  if (!rows.length)
    return (
      <EmptyState
        title="Archive is empty"
        hint="Archived recordings and entity candidates will remain recoverable here."
        className="py-12"
      />
    );
  return (
    <section className="border border-ink/20">
      <div className="border-b border-ink/15 bg-paper-gray px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
        Archived · {rows.length}
      </div>
      {rows.map((row) => {
        const type =
          typeof row.archived_entity_type === "string"
            ? row.archived_entity_type
            : undefined;
        return (
          <div
            key={String(row.id)}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink/10 p-3 last:border-b-0"
          >
            <div>
              <p className="text-sm font-semibold">
                {String(row.title ?? row.name ?? "Archived item")}
              </p>
              <p className="font-mono text-[9px] text-ink-faint">
                Archived {formatAdminDate(row.updated_at ?? row.created_at)}
                {type ? ` · ${type}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                void onRestore(String(row.id), type).then(() =>
                  toast({
                    message: type
                      ? "Restored to published and discovery resumed."
                      : "Restored to the review queue.",
                  }),
                )
              }
            >
              Restore
            </Button>
          </div>
        );
      })}
    </section>
  );
}

function OpsSection({
  id,
  icon: Icon,
  title,
  summary,
  onRefresh,
  children,
}: {
  id: OperationsSection;
  icon: typeof Gauge;
  title: string;
  summary: string;
  onRefresh: (section: OperationsSection) => void;
  children: ReactNode;
}) {
  return (
    <section className="border-x border-b border-ink/20 bg-paper px-4 py-5 sm:px-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 border border-ink/20 bg-paper-gray p-2">
            <Icon className="size-4 text-[var(--ts-acc-deep)]" />
          </span>
          <div>
            <h2 className="font-serif text-xl">{title}</h2>
            <p className="mt-0.5 max-w-3xl font-mono text-[10px] leading-relaxed text-ink-faint">
              {summary}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRefresh(id)}
          aria-label={`Refresh ${title}`}
        >
          <RefreshCw className="size-3" /> Refresh
        </Button>
      </div>
      {children}
    </section>
  );
}

function Metric({
  value,
  label,
  note,
  tone = "neutral",
}: {
  value: string | number;
  label: string;
  note: string;
  tone?: "neutral" | "warn" | "live";
}) {
  return (
    <div className="border-b border-r border-ink/15 p-4 last:border-r-0">
      <p
        className={cn(
          "font-serif text-3xl tabular-nums",
          tone === "warn" && "text-warn",
          tone === "live" && "text-live",
        )}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{note}</p>
    </div>
  );
}

function IntakePanel({
  icon: Icon,
  title,
  note,
  children,
}: {
  icon: typeof Link2;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 bg-paper p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-[var(--ts-acc-deep)]" />
        <p className="font-mono text-[10px] uppercase tracking-widest">
          {title}
        </p>
      </div>
      <p className="min-h-8 font-mono text-[9px] leading-relaxed text-ink-faint">
        {note}
      </p>
      {children}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full resize-y border border-ink/25 bg-paper px-3 py-2 font-mono text-xs leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-[var(--ts-acc)]"
    />
  );
}

function PreviewRows({
  rows,
  selected,
  onToggle,
}: {
  rows: ManualCandidateDraft[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="max-h-36 overflow-y-auto border border-ink/15">
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          onClick={() => onToggle?.(row.id)}
          className="flex w-full items-start gap-2 border-b border-ink/10 p-2 text-left last:border-b-0"
        >
          <span
            className={cn(
              "mt-0.5 grid size-3.5 shrink-0 place-items-center border border-ink/30",
              selected?.has(row.id) &&
                "border-[var(--ts-acc)] bg-[var(--ts-acc)] text-white",
            )}
          >
            {selected?.has(row.id) && <Check className="size-2.5" />}
          </span>
          <span className="min-w-0">
            <span className="block line-clamp-2 text-[11px] font-semibold">
              {row.title}
            </span>
            <span className="mt-0.5 block font-mono text-[8px] text-ink-faint">
              {row.matchedKeywords.join(", ") || "manual review"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CandidateTable({
  rows,
  expanded,
  setExpanded,
  onSetStatus,
}: {
  rows: IngestionCandidate[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onSetStatus: (candidate: IngestionCandidate, status: IngestionStatus) => void;
}) {
  if (!rows.length)
    return <EmptyState title="No candidates" className="py-8" />;
  return (
    <div className="border border-ink/15">
      {rows.map((candidate) => {
        const open = expanded === candidate.id;
        const stageIndex = PIPELINE_ORDER.indexOf(candidate.currentStage) + 1;
        return (
          <div
            key={candidate.id}
            className="border-b border-ink/10 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setExpanded(open ? null : candidate.id)}
              className="grid w-full cursor-pointer items-center gap-2 px-3 py-3 text-left hover:bg-paper-gray sm:grid-cols-[100px_1fr_180px_110px_18px]"
            >
              <Badge tone={STATUS_TONE[candidate.status]}>
                {candidate.status}
              </Badge>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {candidate.rawTitle}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[9px] text-ink-faint">
                  {candidate.sourceKind} ·{" "}
                  {formatRelative(candidate.updatedAt, DEMO_NOW)}
                </span>
              </span>
              <span className="font-mono text-[9px] text-ink-soft">
                {STAGE_LABELS[candidate.currentStage]}
              </span>
              <span className="font-mono text-[9px] tabular-nums text-ink-faint">
                {stageIndex}/{PIPELINE_ORDER.length}
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 text-ink-faint transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && (
              <div className="border-t border-ink/10 bg-paper-gray/50 px-3 py-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <a
                      href={candidate.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[10px] text-[var(--ts-acc-deep)] hover:underline"
                    >
                      {candidate.sourceUrl}
                      <ExternalLink className="size-2.5 shrink-0" />
                    </a>
                    <p className="mt-2 font-mono text-[9px] leading-relaxed text-ink-faint">
                      Detected speakers:{" "}
                      {candidate.detectedSpeakerNames.join(", ") || "none"} ·
                      retries are bounded · rights review required before
                      production publishing.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(NEXT_STATUS[candidate.status] ?? []).map((action) => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={
                          action.status === "approved" ||
                          action.status === "published"
                            ? "ink"
                            : "outline"
                        }
                        onClick={() => onSetStatus(candidate, action.status)}
                      >
                        {action.status === "rejected" && (
                          <X className="size-3" />
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssetReviewTable({ rows }: { rows: AssetCandidate[] }) {
  if (!rows.length) return null;
  const counts = Object.fromEntries(
    ["company", "speaker", "event", "topic"].map((type) => [
      type,
      rows.filter((row) => row.entityType === type).length,
    ]),
  );
  return (
    <div className={cn(needsSeparation(rows) && "mt-4")}>
      <div className="flex flex-wrap items-end justify-between gap-3 border border-ink/15 bg-paper-gray px-3 py-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest">
            Image manifest · {rows.length} awaiting selection
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-ink-faint">
            {counts.company} companies · {counts.speaker} speakers ·{" "}
            {counts.event} events · {counts.topic} topics · $0 provider budget
          </p>
        </div>
        <Badge tone="warn">editorial approval required</Badge>
      </div>
      <div className="max-h-[30rem] overflow-y-auto border-x border-b border-ink/15">
        {rows.map((asset) => (
          <div
            key={asset.id}
            className="grid items-center gap-2 border-b border-ink/10 px-3 py-2 last:border-b-0 sm:grid-cols-[84px_1fr_120px_1fr_auto]"
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
              {asset.entityType}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                {asset.entitySlug ?? asset.entityId}
              </span>
              <span className="block truncate font-mono text-[8px] text-ink-faint">
                {asset.searchQuery}
              </span>
            </span>
            <Badge>{asset.provider}</Badge>
            <span className="truncate font-mono text-[9px] text-ink-faint">
              {asset.licenseLabel}
            </span>
            <a
              href={asset.sourcePageUrl ?? asset.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[9px] text-[var(--ts-acc-deep)] hover:underline"
            >
              Review <ExternalLink className="size-2.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function needsSeparation(rows: AssetCandidate[]): boolean {
  return rows.length > 0;
}

function RegistryTarget({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className="bg-paper p-4">
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest">
        {label}
      </p>
      <p className="mt-1 font-mono text-[9px] text-ink-faint">{note}</p>
      <Badge className="mt-3">registry required</Badge>
    </div>
  );
}

function TableLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
      {children}
    </p>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
