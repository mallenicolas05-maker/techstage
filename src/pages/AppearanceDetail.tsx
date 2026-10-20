import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Captions,
  Check,
  ExternalLink,
  Maximize,
  Minimize,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Link2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { catalogRepo } from "@/data/repositories/local";
import { mediaAdapter } from "@/data/adapters/services";
import { useAsync } from "@/lib/useAsync";
import { useAppState } from "@/state/AppState";
import { useToast } from "@/components/ui/toast";
import {
  AppearanceRow,
  AppearanceStatusBadge,
  Rail,
  SectionHeader,
  SpeakerChip,
  TopicPillLink,
  VerificationBadge,
} from "@/components/media/cards";
import { AIBriefLauncher, StoredAIBrief } from "@/components/media/AIBrief";
import {
  ReminderButton,
  SaveButton,
  AddToCollectionButton,
} from "@/components/media/actions";
import {
  Button,
  EmptyState,
  RowSkeleton,
  Skeleton,
} from "@/components/ui/primitives";
import { Thumb } from "@/components/ui/Thumb";
import {
  APPEARANCE_TYPE_LABELS,
  eventTitle,
  eventSlug,
  speakerName,
} from "@/data/lookup";
import { formatDate, formatDuration, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appearance, MediaSource } from "@/domain/types";

/* Appearance detail — the central product screen.
   Recording placeholder (rights-aware), chapters, clips, searchable
   transcript with seek, related graph, source metadata, and the
   premium insight section with locked state for free users. */

export default function AppearanceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const toast = useToast();
  const { setProgress, getProgress } = useAppState();

  const appearance = useAsync(() => catalogRepo.getAppearance(slug!), [slug]);
  const a = appearance.data;

  const speakers = useAsync(
    () => (a ? catalogRepo.listSpeakers(a.speakerIds) : Promise.resolve([])),
    [a?.id],
  );
  const clips = useAsync(
    () => (a ? catalogRepo.listClipsForAppearance(a.id) : Promise.resolve([])),
    [a?.id],
  );
  const chapters = useAsync(
    () =>
      a ? catalogRepo.listChaptersForAppearance(a.id) : Promise.resolve([]),
    [a?.id],
  );
  const transcript = useAsync(
    () =>
      a?.transcriptId
        ? catalogRepo.getTranscript(a.transcriptId)
        : Promise.resolve(null),
    [a?.transcriptId],
  );
  const related = useAsync(
    () =>
      a
        ? catalogRepo.listAppearances(a.relatedAppearanceIds)
        : Promise.resolve([]),
    [a?.id],
  );
  const mediaSource = useAsync(
    () =>
      a?.primaryVideoId
        ? catalogRepo.getMediaSource(a.primaryVideoId)
        : Promise.resolve(null),
    [a?.primaryVideoId],
  );

  /* ——— Mock player state (placeholder for a real embed) ——— */
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);
  const [mediaVisible, setMediaVisible] = useState(true);
  const [seekRequest, setSeekRequest] = useState<{
    time: number;
    nonce: number;
  } | null>(null);
  const initializedFor = useRef<string | null>(null);

  /* seek from ?t= or saved progress once the appearance loads */
  useEffect(() => {
    if (!a || initializedFor.current === a.id) return;
    initializedFor.current = a.id;
    const t = params.get("t");
    if (t) {
      const time = Number(t);
      setPosition(time);
      setSeekRequest({ time, nonce: Date.now() });
    } else {
      const saved = getProgress(a.id);
      if (saved) setPosition(saved.positionSeconds);
    }
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  /* mock playback tick (speed-aware) + persist progress */
  useEffect(() => {
    if (!playing || !a?.durationSeconds) return;
    const interval = setInterval(() => {
      setPosition((p) => Math.min(a.durationSeconds!, p + 1));
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [playing, a?.durationSeconds, speed]);

  useEffect(() => {
    if (!a?.durationSeconds || position === 0) return;
    const handle = setTimeout(
      () => setProgress(a.id, position, a.durationSeconds!),
      800,
    );
    return () => clearTimeout(handle);
  }, [position, a?.id, a?.durationSeconds, setProgress]);

  /* sticky mini controls when media scrolls out */
  useEffect(() => {
    const el = mediaBoxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setMediaVisible(e.isIntersecting),
      {
        threshold: 0.1,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [a?.id]);

  const seek = (t: number) => {
    setPosition(t);
    setPlaying(true);
    setSeekRequest({ time: t, nonce: Date.now() });
    mediaBoxRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const activeSegmentId = useMemo(() => {
    const segs = transcript.data?.segments ?? [];
    return (
      segs.find((s) => position >= s.startTime && position < s.endTime)?.id ??
      null
    );
  }, [transcript.data, position]);

  useEffect(() => {
    if (!activeSegmentId || transcriptQuery) return;
    transcriptBoxRef.current
      ?.querySelector<HTMLElement>(`[data-segment-id="${activeSegmentId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSegmentId, transcriptQuery]);

  const filteredSegments = useMemo(() => {
    const segs = transcript.data?.segments ?? [];
    if (!transcriptQuery.trim()) return segs;
    const q = transcriptQuery.toLowerCase();
    return segs.filter((s) => s.text.toLowerCase().includes(q));
  }, [transcript.data, transcriptQuery]);

  const activeSegmentText = useMemo(
    () =>
      transcript.data?.segments.find((s) => s.id === activeSegmentId)?.text ??
      null,
    [transcript.data, activeSegmentId],
  );

  const skip = (delta: number) => {
    if (!a?.durationSeconds) return;
    setPosition((p) => Math.max(0, Math.min(a.durationSeconds!, p + delta)));
  };

  if (appearance.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-8">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="mt-3 h-10 w-2/3" />
        <Skeleton className="mt-6 aspect-video w-full max-w-3xl" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (!a) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-10">
        <EmptyState
          title="Appearance not found"
          action={
            <Link
              to="/discover"
              className="link-sweep font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]"
            >
              Back to Discover →
            </Link>
          }
        />
      </main>
    );
  }

  const isUpcoming =
    a.status === "upcoming" ||
    a.status === "rescheduled" ||
    a.status === "live";

  return (
    <main className="mx-auto max-w-6xl px-4">
      {/* ——— Header ——— */}
      <section className="mx-auto max-w-4xl pt-6 text-center sm:pt-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          {APPEARANCE_TYPE_LABELS[a.appearanceType]}
          {(a.eventId || a.eventLabel) && (
            <>
              {" · "}
              {a.eventId ? (
                <Link
                  to={`/events/${eventSlug(a.eventId)}`}
                  className="link-sweep text-[var(--ts-acc-deep)]"
                >
                  {a.eventLabel ?? eventTitle(a.eventId)}
                </Link>
              ) : (
                <span>{a.eventLabel}</span>
              )}
            </>
          )}
          {" · "}
          {formatDate(a.scheduledStart)}
          {a.durationSeconds ? ` · ${formatDuration(a.durationSeconds)}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
            {a.title}
          </h1>
          <AppearanceStatusBadge a={a} />
          <VerificationBadge status={a.verificationStatus} />
        </div>
        {(a.basicSummary || a.description) && (
          <div className="mx-auto mt-4 max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
              Overview
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {a.basicSummary ?? a.description}
            </p>
          </div>
        )}

        {/* Speakers */}
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Speakers
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {speakers.loading ? (
            <Skeleton className="h-10 w-64" />
          ) : (speakers.data ?? []).length ? (
            <>
              {(speakers.data ?? []).map((s) => (
                <SpeakerChip key={s.id} s={s} />
              ))}
              {(a.speakerLabels ?? [])
                .filter(
                  (label) =>
                    !(speakers.data ?? []).some(
                      (speaker) => speaker.name === label,
                    ),
                )
                .map((label) => (
                  <span
                    key={label}
                    className="border border-dotted border-ink/35 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft"
                  >
                    {label}
                  </span>
                ))}
            </>
          ) : (a.speakerLabels ?? []).length ? (
            (a.speakerLabels ?? []).map((label) => (
              <span
                key={label}
                className="border border-dotted border-ink/35 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft"
              >
                {label}
              </span>
            ))
          ) : (
            <span className="font-mono text-[10px] text-ink-faint">
              No verified speaker is attached to this recording.
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <SaveButton kind="appearance" id={a.id} />
          <AddToCollectionButton kind="appearance" id={a.id} />
          {isUpcoming && (
            <ReminderButton appearanceId={a.id} at={a.scheduledStart} />
          )}
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .catch(() => {});
              setCopied(true);
              toast({ message: "Link copied" });
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Link2 className="size-3.5" />
            )}{" "}
            Share
          </Button>
        </div>
      </section>

      <div className="space-y-8 pt-6">
        <div className="space-y-8">
          {/* Media */}
          <div ref={mediaBoxRef}>
            <MediaBox
              a={a}
              source={mediaSource.data}
              playing={playing}
              position={position}
              speed={speed}
              captionText={activeSegmentText}
              captionsAvailable={
                transcript.data?.processingStatus === "complete"
              }
              onToggle={() => setPlaying((p) => !p)}
              onSeek={setPosition}
              onSkip={skip}
              onCycleSpeed={() =>
                setSpeed((s) =>
                  s === 1 ? 1.25 : s === 1.25 ? 1.5 : s === 1.5 ? 2 : 1,
                )
              }
              seekRequest={seekRequest}
            />
          </div>

          {(chapters.data ?? []).length > 0 && (
            <section>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
                Chapters
              </h2>
              <div className="ide-scroll mt-3 flex gap-2 overflow-x-auto pb-2">
                {(chapters.data ?? []).map((chapter, index) => {
                  const active =
                    position >= chapter.startTime && position < chapter.endTime;
                  return (
                    <button
                      key={chapter.id}
                      onClick={() => seek(chapter.startTime)}
                      className={cn(
                        "w-64 shrink-0 border bg-paper p-3 text-left transition-colors hover:border-[var(--ts-acc)]",
                        active
                          ? "border-[var(--ts-acc)] shadow-[3px_3px_0_0_var(--ts-acc-soft)]"
                          : "border-line",
                      )}
                    >
                      <span className="flex gap-2">
                        <span
                          className={cn(
                            "font-serif text-xl",
                            active ? "text-[var(--ts-acc)]" : "text-ink-faint",
                          )}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {chapter.title}
                            </span>
                            <span className="font-mono text-[9px] text-ink-faint">
                              {formatTimestamp(chapter.startTime)}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[10px] leading-relaxed text-ink-faint">
                            {chapter.description}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
              What you can take away from this
            </h2>
            <div className="mt-3">
              {a.analysisArtifact ? (
                <StoredAIBrief appearance={a} onSeek={seek} />
              ) : transcript.data?.processingStatus === "complete" ? (
                <AIBriefLauncher
                  appearance={a}
                  transcript={transcript.data}
                  onSeek={seek}
                />
              ) : (
                <p className="border border-dashed border-ink/25 px-4 py-5 font-mono text-xs text-ink-faint">
                  {isUpcoming
                    ? "The AI Brief arrives after the recording is processed."
                    : "The stored analysis is not yet available."}
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-6 border-y border-line py-6 md:grid-cols-2">
            <section>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
                Source
              </h2>
              <div className="mt-3 border border-line p-4 font-mono text-[11px] leading-loose text-ink-soft">
                <MetaRow label="language" value={a.language.toUpperCase()} />
                {mediaSource.data && (
                  <>
                    <MetaRow
                      label="provider"
                      value={mediaSource.data.provider}
                    />
                    <MetaRow
                      label="channel"
                      value={mediaSource.data.channelName}
                    />
                  </>
                )}
                {mediaSource.data &&
                  isApprovedExternalSource(mediaSource.data.sourceUrl) && (
                    <a
                      href={mediaSource.data.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 border border-ink/30 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper"
                    >
                      Original recording <ExternalLink className="size-3" />
                    </a>
                  )}
              </div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
                TechStage indexes and links to original sources; recordings stay
                with their rights holders.
              </p>
            </section>
            {(clips.data ?? []).length > 0 && (
              <section>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--ts-acc2-deep)]">
                  <span className="text-backer">Clips from this talk</span>
                </h2>
                <div className="mt-3 grid gap-2">
                  {(clips.data ?? []).slice(0, 4).map((clip) => (
                    <button
                      key={clip.id}
                      onClick={() => seek(clip.startTime)}
                      className="dot-grid flex items-center justify-between gap-3 border border-line p-3 text-left hover:border-[var(--ts-acc)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {clip.title}
                        </span>
                        <span className="mt-1 block line-clamp-1 text-xs text-ink-faint">
                          {clip.description}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--ts-acc-deep)]">
                        {formatTimestamp(clip.startTime)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Transcript */}
          {transcript.data && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
                  Transcript
                </h2>
                {transcript.data?.processingStatus === "complete" && (
                  <div className="flex items-center border border-ink/25">
                    <span className="flex items-center px-2 text-ink-faint">
                      <Search className="size-3.5" />
                    </span>
                    <input
                      value={transcriptQuery}
                      onChange={(e) => setTranscriptQuery(e.target.value)}
                      placeholder="Search this transcript…"
                      className="w-48 bg-transparent py-1.5 pr-2 font-mono text-xs outline-none placeholder:text-ink-faint"
                    />
                  </div>
                )}
              </div>

              <div className="mt-3">
                {transcript.loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : transcript.data.processingStatus !== "complete" ? (
                  <div className="border border-dashed border-[var(--ts-acc-45)] px-4 py-6">
                    <p className="font-mono text-xs text-ink-soft">
                      Transcript {transcript.data.processingStatus} — ASR
                      confidence so far{" "}
                      {(transcript.data.confidence * 100).toFixed(0)}%.
                    </p>
                    <div className="mt-3 space-y-1.5" aria-hidden>
                      <div className="h-3 w-3/4 skeleton" />
                      <div className="h-3 w-1/2 skeleton" />
                      <div className="h-3 w-2/3 skeleton" />
                    </div>
                  </div>
                ) : (
                  <>
                    {transcriptQuery && (
                      <p className="pb-2 font-mono text-[11px] text-ink-faint">
                        {filteredSegments.length}{" "}
                        {filteredSegments.length === 1
                          ? "segment matches"
                          : "segments match"}{" "}
                        “{transcriptQuery}”
                      </p>
                    )}
                    <div className="relative">
                      <div
                        ref={transcriptBoxRef}
                        className="ide-scroll max-h-[540px] space-y-1 overflow-y-auto border border-line p-3"
                      >
                        {filteredSegments.map((seg) => (
                          <button
                            key={seg.id}
                            data-segment-id={seg.id}
                            onClick={() => seek(seg.startTime)}
                            className={cn(
                              "block w-full cursor-pointer px-2 py-1.5 text-left transition-colors hover:bg-paper-gray",
                              activeSegmentId === seg.id && "segment-active",
                            )}
                          >
                            <span className="flex items-baseline gap-3">
                              <span className="w-12 shrink-0 font-mono text-[10px] text-[var(--ts-acc-deep)]">
                                {formatTimestamp(seg.startTime)}
                              </span>
                              <span className="min-w-0">
                                {seg.speakerId && (
                                  <SpeakerLabel speakerId={seg.speakerId} />
                                )}
                                <span className="font-mono text-xs leading-relaxed text-ink-soft">
                                  {activeSegmentId === seg.id &&
                                  !transcriptQuery ? (
                                    <WordByWord
                                      text={seg.text}
                                      start={seg.startTime}
                                      end={seg.endTime}
                                      position={position}
                                    />
                                  ) : (
                                    <HighlightedText
                                      text={seg.text}
                                      query={transcriptQuery}
                                    />
                                  )}
                                </span>
                              </span>
                            </span>
                          </button>
                        ))}
                        {filteredSegments.length === 0 && (
                          <p className="px-2 py-4 font-mono text-xs text-ink-faint">
                            No verbiage matches. Try another keyword.
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-ink-faint">
                      Official captions, prepared by the TechStage team.
                    </p>
                  </>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Topics */}
        {a.topicIds.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
              Topics
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.topicIds.map((t) => (
                <TopicPillLink key={t} topicId={t} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ——— Related ——— */}
      {(related.data ?? []).length > 0 && (
        <section className="pt-12">
          <SectionHeader title="More related to this" />
          <Rail className="mt-4 gap-3">
            {(related.data ?? []).map((row) => (
              <AppearanceRow
                key={row.id}
                a={row}
                className="w-[34rem] max-w-[88vw] shrink-0"
              />
            ))}
          </Rail>
        </section>
      )}

      {/* ——— Sticky mini controls ——— */}
      {!mediaVisible && a.durationSeconds && (
        <div className="fixed inset-x-0 bottom-14 z-30">
          <div className="mx-auto flex max-w-2xl items-center gap-3 border border-ink bg-paper px-3 py-2 shadow-[5px_5px_0_0_rgba(23,24,28,0.15)]">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center border border-ink bg-ink text-paper transition-colors hover:bg-[var(--ts-acc)] hover:border-[var(--ts-acc)]"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
            </button>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs">
                {a.title}
              </span>
              <span className="progress-track mt-1 block">
                <span
                  className="progress-fill block"
                  style={{ width: `${(position / a.durationSeconds) * 100}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-faint">
              {formatTimestamp(position)} / {formatTimestamp(a.durationSeconds)}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

function isApprovedExternalSource(value: string): boolean {
  if (!value || value === "#") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.hostname.endsWith("example.com");
  } catch {
    return false;
  }
}

/* ——— Media placeholder box (rights-aware) ——— */

function MediaBox({
  a,
  source,
  playing,
  position,
  speed,
  captionText,
  captionsAvailable,
  onToggle,
  onSeek,
  onSkip,
  onCycleSpeed,
  seekRequest,
}: {
  a: Appearance;
  source: MediaSource | null;
  playing: boolean;
  position: number;
  speed: number;
  captionText: string | null;
  captionsAvailable: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSkip: (delta: number) => void;
  onCycleSpeed: () => void;
  seekRequest: { time: number; nonce: number } | null;
}) {
  const embed = useAsync(
    () => (source ? mediaAdapter.resolveEmbed(source) : Promise.resolve(null)),
    [source?.id],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canEmbed = embed.data?.embedUrl;

  const sendPlayerSeek = (time: number) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [time, true] }),
      "https://www.youtube-nocookie.com",
    );
    target.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "https://www.youtube-nocookie.com",
    );
  };

  useEffect(() => {
    if (canEmbed && seekRequest) sendPlayerSeek(seekRequest.time);
    // `nonce` deliberately replays identical timestamp selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEmbed, seekRequest?.nonce]);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  const isUpcoming = a.status === "upcoming" || a.status === "rescheduled";

  if (isUpcoming || a.status === "cancelled") {
    return (
      <div className="seam border border-dashed border-[var(--ts-acc-45)] bg-paper px-5 py-8 text-center">
        <p className="font-serif text-3xl sm:text-4xl">
          {a.status === "cancelled"
            ? "This session was cancelled."
            : "Not yet on stage."}
        </p>
        <p className="mt-1 font-mono text-xs text-ink-faint">
          {a.status === "cancelled"
            ? "The organizer cancelled this session; we keep the record for context."
            : a.recordingAvailability === "expected"
              ? `Scheduled for ${formatDate(a.scheduledStart)} — a recording is expected afterward.`
              : `Scheduled for ${formatDate(a.scheduledStart)}.`}
        </p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="border border-dashed border-ink/25 px-5 py-8 text-center">
        <p className="font-mono text-sm text-ink-soft">
          {a.recordingAvailability === "removed"
            ? "The recording was removed at the source."
            : a.recordingAvailability === "processing"
              ? "Recording is being processed."
              : a.recordingAvailability === "expected"
                ? "Recording expected — not yet published by the organizer."
                : "No recording available for this session."}
        </p>
      </div>
    );
  }

  const hasApprovedSource = isApprovedExternalSource(source.sourceUrl);

  // Approved live records use the provider's own controls.  The simulated player
  // below remains only for local mock records, so public playback is never faked.
  if (canEmbed) {
    const separator = canEmbed.includes("?") ? "&" : "?";
    const requestedStart = seekRequest
      ? `&start=${Math.max(0, Math.floor(seekRequest.time))}&autoplay=1`
      : "";
    const playerUrl = `${canEmbed}${separator}enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}${requestedStart}`;
    return (
      <div
        ref={containerRef}
        className={cn(
          "border border-ink/20 bg-paper",
          isFullscreen && "flex h-full flex-col justify-center",
        )}
      >
        <iframe
          key={seekRequest?.nonce ?? source.id}
          ref={iframeRef}
          src={playerUrl}
          onLoad={() => seekRequest && sendPlayerSeek(seekRequest.time)}
          title={`${a.title} — official YouTube recording`}
          className="aspect-video w-full border-0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "border border-ink/20 bg-paper",
        isFullscreen && "flex h-full flex-col justify-center",
      )}
    >
      <div className="relative">
        <Thumb
          seed={a.id}
          label={a.title.slice(0, 1)}
          className="aspect-video w-full"
          glyphClassName="text-8xl"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            {hasApprovedSource ? (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 border border-ink bg-paper/90 px-4 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors hover:bg-ink hover:text-paper"
              >
                Watch at the source <ArrowUpRight className="size-3.5" />
              </a>
            ) : (
              <span className="border border-dashed border-ink/30 bg-paper/90 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-ink-faint">
                Demo item — no approved recording attached
              </span>
            )}
          </div>
          {/* Captions overlay — the active transcript line */}
          {captionsOn && captionText && (
            <span className="absolute inset-x-6 bottom-3 z-10 mx-auto line-clamp-2 w-fit max-w-full bg-ink/85 px-2.5 py-1 text-center font-mono text-xs leading-snug text-paper">
              {captionText}
            </span>
          )}
        </Thumb>
      </div>

      {/* Scrubber */}
      {a.durationSeconds && !canEmbed && (
        <div className="flex items-center gap-3 border-t border-ink/15 px-3 py-2">
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {formatTimestamp(position)}
          </span>
          <input
            type="range"
            min={0}
            max={a.durationSeconds}
            value={position}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="min-w-0 flex-1"
            style={{ accentColor: "var(--ts-acc)" }}
            aria-label="Seek"
          />
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {formatTimestamp(a.durationSeconds)}
          </span>
        </div>
      )}

      {/* Control bar */}
      {a.durationSeconds && !canEmbed && (
        <div className="flex items-center gap-0.5 border-t border-ink/15 px-2 py-1.5">
          <ControlButton label="Back 10 seconds" onClick={() => onSkip(-10)}>
            <SkipBack className="size-4" />
          </ControlButton>
          <ControlButton label={playing ? "Pause" : "Play"} onClick={onToggle}>
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </ControlButton>
          <ControlButton label="Forward 10 seconds" onClick={() => onSkip(10)}>
            <SkipForward className="size-4" />
          </ControlButton>
          <button
            onClick={onCycleSpeed}
            aria-label={`Playback speed ${speed}x`}
            className="ml-1 cursor-pointer border border-ink/20 px-2 py-1 font-mono text-[10px] tabular-nums text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {speed}×
          </button>
          <span className="flex-1" />
          <ControlButton
            label={captionsOn ? "Hide captions" : "Show captions"}
            onClick={() => setCaptionsOn((on) => !on)}
            active={captionsOn}
            disabled={!captionsAvailable}
          >
            <Captions className="size-4" />
          </ControlButton>
          <ControlButton
            label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted((m) => !m)}
            active={muted}
          >
            {muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </ControlButton>
          <ControlButton
            label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={toggleFullscreen}
            active={isFullscreen}
          >
            {isFullscreen ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            )}
          </ControlButton>
        </div>
      )}

      {!canEmbed && embed.data?.reason && (
        <p className="border-t border-ink/15 px-3 py-2 font-mono text-[10px] text-ink-faint">
          {embed.data.reason}
        </p>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center border border-transparent text-ink-soft transition-colors hover:border-ink/25 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30",
        active && "border-ink/25 bg-paper-gray text-ink",
      )}
    >
      {children}
    </button>
  );
}

/* Word-by-word karaoke highlight inside the active segment.
   Word timing is linearly interpolated across the segment. */
function WordByWord({
  text,
  start,
  end,
  position,
}: {
  text: string;
  start: number;
  end: number;
  position: number;
}) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(
    () => tokens.filter((t) => !/^\s*$/.test(t)).length,
    [tokens],
  );
  if (wordCount === 0) return <>{text}</>;
  const progress =
    end > start
      ? Math.max(0, Math.min(1, (position - start) / (end - start)))
      : 0;
  const currentWord = Math.min(wordCount - 1, Math.floor(progress * wordCount));
  let wordIndex = -1;
  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s*$/.test(token)) return token;
        wordIndex += 1;
        return wordIndex === currentWord ? (
          <span key={i} className="mark-a">
            {token}
          </span>
        ) : (
          token
        );
      })}
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="uppercase tracking-widest text-ink-faint">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function SpeakerLabel({ speakerId }: { speakerId: string }) {
  return (
    <span className="mr-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink">
      {speakerName(speakerId).split(" ").pop()}:
    </span>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="mark-a">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
