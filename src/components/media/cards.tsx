import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarX2, CalendarClock, Play, Radio } from "lucide-react";
import type { Appearance, Clip, Speaker, StandoutMoment, Topic } from "@/domain/types";
import {
  APPEARANCE_TYPE_LABELS,
  appearanceSlug,
  appearanceTitle,
  appearanceSpeakerNames,
  eventTitle,
  speakerName,
  speakerHeadline,
  topicName,
  topicSlug,
} from "@/data/lookup";
import { formatDate, formatDuration, formatRelative, formatTime, formatTimestamp, formatWeekday, formatDateShort } from "@/lib/format";
import { DEMO_NOW } from "@/data/repositories/local";
import { useAppState } from "@/state/AppState";
import { Badge } from "@/components/ui/primitives";
import { EntityImage } from "@/components/ui/EntityImage";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { FollowButton, ReminderButton, SaveButton } from "./actions";
import { cn } from "@/lib/utils";

/* The editorial card family. Polaris hard corners + mono metadata,
   in several deliberate shapes: feature cards, standard cards,
   compact rows, clip cards, speaker cards, upcoming rows, rails. */

/* ——— Section scaffolding ——— */

export function SectionHeader({
  title,
  to,
  count,
  annotate,
  className,
}: {
  title: ReactNode;
  to?: string;
  count?: number;
  annotate?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-2", className)}>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        <span className={annotate ? "mark-b" : undefined}>{title}</span>
      </h2>
      <span className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
        {count !== undefined && <span>{count} charted</span>}
        {to && (
          <Link to={to} className="link-sweep text-[var(--ts-acc-deep)]">
            View all →
          </Link>
        )}
      </span>
    </div>
  );
}

export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rail -mx-4 gap-3 px-4 pb-1 sm:mx-0 sm:px-0", className)}>{children}</div>;
}

/* ——— Shared meta bits ——— */

export function AppearanceStatusBadge({ a }: { a: Appearance }) {
  if (a.status === "live")
    return (
      <Badge tone="live">
        <span className="live-dot rounded-none" /> Live
      </Badge>
    );
  if (a.status === "cancelled")
    return (
      <Badge tone="warn">
        <CalendarX2 className="size-2.5" /> Cancelled
      </Badge>
    );
  if (a.status === "rescheduled")
    return (
      <Badge tone="warn">
        <CalendarClock className="size-2.5" /> Rescheduled
      </Badge>
    );
  if (a.status === "processing") return <Badge tone="accent">Processing</Badge>;
  if (a.status === "upcoming") return <Badge tone="accent">Upcoming</Badge>;
  return null;
}

export function VerificationBadge({ status }: { status: Appearance["verificationStatus"] }) {
  if (status === "verified") return null;
  return <Badge tone={status === "flagged" ? "warn" : "neutral"}>{status}</Badge>;
}

function MetaLine({ a, className }: { a: Appearance; className?: string }) {
  return (
    <p className={cn("truncate font-mono text-[11px] uppercase tracking-widest text-ink-faint", className)}>
      {APPEARANCE_TYPE_LABELS[a.appearanceType]}
      {a.eventId ? ` · ${eventTitle(a.eventId)}` : a.locationLabel ? ` · ${a.locationLabel}` : ""}
      {" · "}
      {formatDate(a.scheduledStart)}
      {a.durationSeconds ? ` · ${formatDuration(a.durationSeconds)}` : ""}
    </p>
  );
}

function ProgressBar({ appearanceId }: { appearanceId: string }) {
  const { getProgress } = useAppState();
  const p = getProgress(appearanceId);
  if (!p || p.durationSeconds === 0) return null;
  return (
    <div className="progress-track absolute inset-x-0 bottom-0 z-10">
      <div
        className="progress-fill"
        style={{ width: `${Math.min(100, (p.positionSeconds / p.durationSeconds) * 100)}%` }}
      />
    </div>
  );
}

function AppearanceArtwork({ a, className, children, glyphClassName }: { a: Appearance; className?: string; children?: ReactNode; glyphClassName?: string }) {
  const ready = Boolean(a.analysisArtifact && a.primaryVideoId && a.thumbnailUrl);
  return <div className={cn("thumb relative overflow-hidden bg-paper-gray", className)}>
    {a.thumbnailUrl ? <img src={a.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center"><span className={cn("font-serif text-ink/70", glyphClassName ?? "text-5xl")}>{a.title.slice(0, 1)}</span></div>}
    {a.thumbnailUrl && <div className="absolute inset-0 bg-ink/5" />}
    <div className="absolute bottom-3 left-3 z-10 flex items-end gap-1" aria-label={ready ? "Published and complete" : "Preview data"}>
      <span className="h-1.5 w-8 bg-[var(--ts-acc)]" />
      <span className={cn("h-1.5 w-6", ready ? "bg-[var(--ts-acc2)]" : "bg-[var(--ts-acc)]")} />
      <span className={cn("h-1.5 w-4", ready ? "bg-[var(--ts-acc2)]" : "bg-[var(--ts-acc)]")} />
    </div>
    {children}
  </div>;
}

/* ——— Feature card (large, editorial) ——— */

export function AppearanceFeatureCard({ a, className }: { a: Appearance; className?: string }) {
  return (
    <Link
      to={`/a/${a.slug}`}
      className={cn(
        "tech-frame group grid border border-line bg-paper transition-colors md:grid-cols-2",
        className
      )}
    >
      <div className="relative">
        <AppearanceArtwork a={a} className="aspect-video h-full w-full md:aspect-auto md:min-h-56" glyphClassName="text-7xl">
          <span className="absolute left-3 top-3 flex items-center gap-1 border border-ink/20 bg-paper/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            <Play className="size-3" /> {a.durationSeconds ? formatDuration(a.durationSeconds) : "—"}
          </span>
        </AppearanceArtwork>
        <ProgressBar appearanceId={a.id} />
      </div>
      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <MetaLine a={a} className="flex-1" />
          <SaveButton kind="appearance" id={a.id} iconOnly />
        </div>
        <h3 className="mt-2 font-serif text-2xl leading-snug group-hover:text-[var(--ts-acc-deep)] sm:text-3xl">
          {a.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
          {a.basicSummary ?? a.description}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-4">
          <span className="truncate font-mono text-xs text-ink-soft">{appearanceSpeakerNames(a, 3)}</span>
          <ArrowUpRight className="ml-auto size-4 shrink-0 text-ink-faint opacity-40 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}

/* ——— Standard card ——— */

export function AppearanceCard({ a, className }: { a: Appearance; className?: string }) {
  return (
    <Link
      to={`/a/${a.slug}`}
      className={cn(
        "tech-frame group flex w-64 shrink-0 flex-col border border-line bg-paper transition-colors sm:w-72",
        className
      )}
    >
      <div className="relative">
        <AppearanceArtwork a={a} className="aspect-video w-full">
          <span className="absolute left-2 top-2 border border-ink/20 bg-paper/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-soft">
            {APPEARANCE_TYPE_LABELS[a.appearanceType]}
          </span>
          {a.durationSeconds && (
            <span className="absolute bottom-2 right-2 bg-ink/85 px-1.5 py-0.5 font-mono text-[10px] text-paper">
              {formatDuration(a.durationSeconds)}
            </span>
          )}
        </AppearanceArtwork>
        <ProgressBar appearanceId={a.id} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold leading-snug group-hover:text-[var(--ts-acc-deep)]">
            {a.title}
          </h3>
          <SaveButton kind="appearance" id={a.id} iconOnly className="-mr-1.5 -mt-1" />
        </div>
        <p className="mt-1 line-clamp-1 font-mono text-[11px] text-ink-soft">
          {appearanceSpeakerNames(a)}
        </p>
        <p className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {a.eventId ? eventTitle(a.eventId) : (a.locationLabel ?? "Independent")} ·{" "}
          {formatRelative(a.scheduledStart, DEMO_NOW)}
        </p>
      </div>
    </Link>
  );
}

/* ——— Compact feed row ——— */

export function AppearanceRow({ a, className }: { a: Appearance; className?: string }) {
  return (
    <Link
      to={`/a/${a.slug}`}
      className={cn(
        "tech-frame group flex min-w-0 w-full items-center gap-4 border border-line bg-paper px-4 py-3.5 transition-colors duration-300 hover:bg-[var(--ts-acc-15)] sm:px-5",
        className
      )}
    >
      <AppearanceArtwork a={a} className="hidden h-14 w-24 shrink-0 sm:block" glyphClassName="text-2xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold group-hover:text-[var(--ts-acc-deep)]">
            {a.title}
          </span>
          <AppearanceStatusBadge a={a} />
          <VerificationBadge status={a.verificationStatus} />
        </span>
        <MetaLine a={a} className="mt-0.5" />
        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-soft">
          {appearanceSpeakerNames(a, 3)}
        </span>
      </span>
      <SaveButton kind="appearance" id={a.id} iconOnly className="shrink-0" />
      <ArrowUpRight className="hidden size-4 shrink-0 text-ink-faint opacity-40 transition-opacity group-hover:opacity-100 sm:block" />
    </Link>
  );
}

/* ——— Compact square tile (mobile result grids) ——— */

export function AppearanceSquare({ a, className }: { a: Appearance; className?: string }) {
  return (
    <Link
      to={`/a/${a.slug}`}
      className={cn(
        "tech-frame group flex aspect-square flex-col overflow-hidden border border-line bg-paper transition-colors",
        className
      )}
    >
      <AppearanceArtwork a={a} className="h-[46%] w-full shrink-0" glyphClassName="text-3xl">
        <span className="absolute left-1.5 top-1.5 border border-ink/20 bg-paper/90 px-1 py-0.5 font-mono text-[7px] uppercase tracking-widest text-ink-soft">
          {APPEARANCE_TYPE_LABELS[a.appearanceType]}
        </span>
      </AppearanceArtwork>
      <span className="dot-grid flex min-h-0 flex-1 flex-col p-2.5">
        <span className="line-clamp-3 text-[11px] font-semibold leading-snug group-hover:text-[var(--ts-acc-deep)]">
          {a.title}
        </span>
        <span className="mt-auto block truncate font-mono text-[9px] text-ink-soft">
          {appearanceSpeakerNames(a, 1)}
        </span>
        <span className="block truncate font-mono text-[9px] text-ink-faint">
          {formatDateShort(a.scheduledStart)}
          {a.durationSeconds ? ` · ${formatDuration(a.durationSeconds)}` : ""}
        </span>
      </span>
    </Link>
  );
}

/* ——— Clip card ——— */

export function ClipCard({ clip, className, onSeek, appearanceSlugOverride }: { clip: Clip; className?: string; onSeek?: (time: number) => void; appearanceSlugOverride?: string }) {
  const isQuote = clip.clipType === "quote";
  return (
    <Link
      to={`/a/${appearanceSlugOverride ?? appearanceSlug(clip.appearanceId)}?t=${clip.startTime}`}
      onClick={(event) => { if (onSeek) { event.preventDefault(); onSeek(clip.startTime); } }}
      className={cn(
        "tech-frame group flex w-60 shrink-0 flex-col border border-line bg-paper p-4 transition-colors",
        isQuote && "dot-grid",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Badge tone={clip.clipType === "announcement" ? "annotate" : "neutral"}>{clip.clipType}</Badge>
      </div>
      <p
        className={cn(
          "mt-3 line-clamp-3 leading-snug group-hover:text-[var(--ts-acc-deep)]",
          isQuote ? "font-serif text-lg" : "text-sm font-semibold"
        )}
      >
        {clip.title}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ts-acc-deep)]">Find this at {formatTimestamp(clip.startTime)}–{formatTimestamp(clip.endTime)}</span>
        <SaveButton kind="clip" id={clip.id} iconOnly className="-mr-1.5 shrink-0" />
      </div>
    </Link>
  );
}

/* ——— Standout moment: editorial words, not playable video ——— */

export function StandoutMomentCard({
  moment,
  onOpen,
  className,
}: {
  moment: StandoutMoment;
  onOpen?: (moment: StandoutMoment) => void;
  className?: string;
}) {
  const speakerId = moment.speakerIds[0];
  const name = speakerId ? speakerName(speakerId) : "TechStage speaker";
  const speaker = speakerId ? getSeedDb().speakers.find((row) => row.id === speakerId) : null;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(moment)}
      className={cn(
        "tech-frame group grid min-h-56 w-80 shrink-0 cursor-pointer grid-cols-[1fr_5.5rem] overflow-hidden border border-line bg-paper text-left transition-colors sm:w-96 sm:grid-cols-[1fr_7rem]",
        className
      )}
    >
      <span className="dot-grid flex min-w-0 flex-col p-5">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ts-acc2-deep)]">Standout moment</span>
        <span className="mt-3 line-clamp-4 font-serif text-xl leading-snug text-ink">{moment.title}</span>
        <span className="mt-auto pt-5">
          <span className="block text-sm font-semibold"><span className="mark-b">{name}</span></span>
          <span className="mt-0.5 block line-clamp-1 font-mono text-[10px] text-ink-faint">{speakerId ? speakerHeadline(speakerId) : appearanceTitle(moment.appearanceId)}</span>
        </span>
      </span>
      <span className="relative flex items-end justify-center border-l border-line bg-[var(--ts-acc-15)] p-3">
        <EntityImage entityType="speaker" entitySlug={speaker?.slug ?? speakerId ?? moment.id} name={name} src={speaker?.avatarUrl ?? null} focalX={speaker?.imageAttribution?.focalX} focalY={speaker?.imageAttribution?.focalY} className="absolute inset-3 h-auto w-auto" />
        <span className="relative z-10 ml-auto flex size-8 items-center justify-center text-ink-soft transition-colors group-hover:text-[var(--ts-acc-deep)]">          <ArrowUpRight className="size-4" />
        </span>
      </span>
    </button>
  );
}

/* ——— Speaker card + chip ——— */

export function SpeakerCard({ s, className }: { s: Speaker; className?: string }) {
  return (
    <div
      className={cn(
        "tech-frame group flex w-60 shrink-0 flex-col items-start border border-line bg-paper p-4 transition-colors hover:bg-[var(--ts-acc-15)]",
        className
      )}
    >
      <Link to={`/speakers/${s.slug}`} className="flex w-full flex-col items-start gap-3">
        <EntityImage entityType="speaker" entitySlug={s.slug} name={s.name} src={s.avatarUrl} focalX={s.imageAttribution?.focalX} focalY={s.imageAttribution?.focalY} className="mx-auto size-28" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold group-hover:text-[var(--ts-acc-deep)]">
            {s.name}
          </span>
          <span className="mt-0.5 line-clamp-2 font-mono text-[10px] leading-relaxed text-ink-faint">
            {s.headline}
          </span>
        </span>
      </Link>
      <div className="mt-3 flex w-full items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {s.appearanceIds.length} talks
        </span>
        <FollowButton kind="speaker" id={s.id} size="sm" />
      </div>
    </div>
  );
}

export function SpeakerChip({ s, className }: { s: Speaker; className?: string }) {
  return (
    <Link
      to={`/speakers/${s.slug}`}
      className={cn(
        "flex shrink-0 items-center gap-2 border border-line bg-paper py-1.5 pl-1.5 pr-3 transition-colors hover:border-[var(--ts-acc)]",
        className
      )}
    >
      <EntityImage entityType="speaker" entitySlug={s.slug} name={s.name} src={s.avatarUrl} focalX={s.imageAttribution?.focalX} focalY={s.imageAttribution?.focalY} className="size-7" />
      <span className="font-mono text-xs">{s.name}</span>
    </Link>
  );
}

/* ——— Upcoming row (date block + details + actions) ——— */

export function UpcomingRow({ a, className }: { a: Appearance; className?: string }) {
  const cancelled = a.status === "cancelled";
  return (
    <div
      className={cn(
        "tech-frame flex w-full min-w-0 items-stretch gap-0 overflow-hidden border border-line bg-paper transition-colors",
        cancelled && "opacity-60",
        className
      )}
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-line bg-paper-gray px-2 py-3 sm:w-20">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {formatWeekday(a.scheduledStart)}
        </span>
        <span className="font-serif text-2xl leading-none text-[var(--ts-acc)]">
          {formatDateShort(a.scheduledStart)}
        </span>
        <span className="mt-1 font-mono text-[10px] text-ink-faint">{formatTime(a.scheduledStart)}</span>
      </div>
      <div className="min-w-0 flex-1 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/a/${a.slug}`}
            className={cn("truncate text-sm font-semibold hover:text-[var(--ts-acc-deep)]", cancelled && "line-through")}
          >
            {a.title}
          </Link>
          <AppearanceStatusBadge a={a} />
          <VerificationBadge status={a.verificationStatus} />
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          {APPEARANCE_TYPE_LABELS[a.appearanceType]}
          {a.eventId ? ` · ${eventTitle(a.eventId)}` : ""} · {a.locationLabel ?? "TBA"}
          {a.recordingAvailability === "expected" ? " · recording expected" : ""}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-soft">
          {appearanceSpeakerNames(a, 3)}
        </p>
        {a.rescheduledFrom && (
          <p className="mt-1 font-mono text-[10px] text-warn">
            Moved from {formatDate(a.rescheduledFrom)}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {!cancelled && (
            <ReminderButton appearanceId={a.id} at={a.scheduledStart} size="sm" />
          )}
          {a.livestreamUrl && !cancelled && (
            <a
              href={a.livestreamUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-ink/30 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              <Radio className="size-3" /> Livestream
            </a>
          )}
          {a.rsvpUrl && !cancelled && (
            <a
              href={a.rsvpUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-ink/30 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              RSVP <ArrowUpRight className="size-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ——— Topic pill link ——— */

export function TopicPillLink({ topicId, topic, className }: { topicId: string; topic?: Pick<Topic, "slug" | "name">; className?: string }) {
  return (
    <Link
      to={`/topics/${topic?.slug ?? topicSlug(topicId)}`}
      className={cn(
        "shrink-0 border border-ink/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-soft transition-colors hover:border-[var(--ts-acc)] hover:text-[var(--ts-acc-deep)]",
        className
      )}
    >
      {topic?.name ?? topicName(topicId)}
    </Link>
  );
}
