import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  LoaderCircle,
  Lock,
  Maximize2,
  Minimize2,
  Share2,
  X,
} from "lucide-react";
import type { AIBriefItem, AIBriefSection, Appearance, BriefRecord, Transcript } from "@/domain/types";
import { assembleBriefRecord, assembleStoredBriefRecord, briefToMarkdown } from "@/data/aiBrief";
import { summaryAdapter } from "@/data/adapters/services";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { useAppState } from "@/state/AppState";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/primitives";
import { BRIEF_STEPS, useBriefSequence, useStreamingText } from "@/hooks/useBriefSequence";
import { companyName, companySlug } from "@/data/lookup";
import { formatDuration, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIGNALS = ["Investing edge", "Career advantage", "Founder strategy", "Research inspiration", "Market sentiment", "Industry effects"];

function BrandLabel() {
  return <span className="text-[11px] text-ink-soft">AI summary provided by <span className="brief-meta font-semibold uppercase tracking-[0.16em] text-ink">TECH<span className="text-[var(--ts-acc)]">STAGE</span></span></span>;
}

export function AIBriefLauncher({ appearance, transcript, onSeek }: { appearance: Appearance; transcript: Transcript; onSeek: (time: number) => void }) {
  const { user } = useAppState();
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<BriefRecord | null>(null);
  const [completed, setCompleted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const viewedKey = user ? `techstage.brief.viewed.${user.id}.${appearance.id}` : null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => setReady(true), 420);
    if (viewedKey && localStorage.getItem(viewedKey) === "true") {
      void summaryAdapter.getBrief(appearance.id).then((saved) => {
        if (!cancelled && saved) { setRecord(saved); setCompleted(true); }
      });
    }
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [appearance.id, viewedKey]);

  const launch = async () => {
    if (!user) { toast({ message: "Sign in to generate an AI Brief." }); return; }
    const next = await summaryAdapter.getBrief(appearance.id);
    if (!next) return;
    setRecord(next);
    if (viewedKey) localStorage.setItem(viewedKey, "true");
    setOpen(true);
  };
  const close = () => { setOpen(false); if (record && viewedKey && localStorage.getItem(viewedKey) === "true") setCompleted(true); };

  if (!ready) return <Skeleton className="h-40 w-full" />;
  if (record && completed) {
    return <><div className="ai-brief-surface overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-[0_24px_70px_-30px_rgba(23,24,28,.28)]"><div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3"><BrandLabel /><div className="flex items-center gap-2"><button onClick={() => { setPreviewing(true); setRefreshKey((key) => key + 1); }} className="brief-control text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]">Refresh demo</button><button onClick={() => setOpen(true)} className="brief-control px-2.5 py-1.5 text-[11px] text-ink-soft hover:text-ink">Open full view</button></div></div>{previewing ? <BriefExperience key={refreshKey} record={record} appearance={appearance} transcript={transcript} onSeek={onSeek} /> : <BriefDossier record={record} appearance={appearance} transcript={transcript} onSeek={onSeek} embedded />}</div><BriefModal open={open} onClose={close} record={record} appearance={appearance} transcript={transcript} onSeek={(time) => { close(); onSeek(time); }} /></>;
  }

  return <>
    <div className="ai-brief-surface dot-grid overflow-hidden rounded-3xl border border-ink/15 bg-paper p-5 sm:p-7">
      <div className="max-w-2xl"><p className="brief-meta text-[10px] uppercase tracking-[0.25em] text-ink-faint">✦ Powered by TechStage AI</p><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h2 className="brief-title text-3xl">The AI Brief</h2><p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-ink-soft">A sourced dossier of takeaways, bottlenecks, strategic signals, and implications from this talk.</p></div><span className="brief-meta rounded-full bg-paper/85 px-2.5 py-1 text-[9px] uppercase tracking-widest text-ink-soft">8 sections</span></div><button onClick={launch} className="brief-control mt-6 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--ts-acc)] bg-paper px-4 py-2 text-xs uppercase tracking-widest text-[var(--ts-acc-deep)] hover:bg-[var(--ts-acc-15)]">✦ Summarize with AI</button></div>
    </div>
    {record && <BriefModal open={open} onClose={close} record={record} appearance={appearance} transcript={transcript} onSeek={(time) => { close(); onSeek(time); }} />}
  </>;
}

export function StoredAIBrief({ appearance, onSeek }: { appearance: Appearance; onSeek: (time: number) => void }) {
  const artifact = appearance.analysisArtifact;
  const record = useMemo(() => artifact ? assembleStoredBriefRecord(appearance, artifact) : null, [appearance, artifact]);
  const transcript = useMemo<Transcript>(() => ({
    id: `evidence-${appearance.id}`, appearanceId: appearance.id, sourceType: "human", language: appearance.language,
    fullText: artifact?.evidence.map((row) => row.excerpt).join("\n") ?? "", segments: artifact?.evidence.map((row, index) => ({ id: `${appearance.id}-e-${index}`, startTime: row.timestampSeconds ?? 0, endTime: (row.timestampSeconds ?? 0) + 20, speakerId: null, text: row.excerpt, confidence: row.confidence })) ?? [],
    speakerDiarization: false, confidence: artifact?.confidence ?? 0, processingStatus: "complete", generatedAt: artifact?.generatedAt ?? null, reviewedAt: null,
  }), [appearance.id, appearance.language, artifact]);
  if (!record) return null;
  return <div className="ai-brief-surface overflow-hidden border border-ink/10 bg-paper shadow-[0_24px_70px_-30px_rgba(23,24,28,.28)]"><div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3"><BrandLabel /><span className="brief-meta text-[9px] uppercase tracking-widest text-ink-faint">Stored once · shared with every viewer</span></div><BriefDossier record={record} appearance={appearance} transcript={transcript} onSeek={onSeek} embedded /></div>;
}

function BriefModal({ open, onClose, record, appearance, transcript, onSeek }: { open: boolean; onClose: () => void; record: BriefRecord; appearance: Appearance; transcript: Transcript; onSeek: (time: number) => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="ai-brief-modal fixed inset-0 z-50 flex items-end justify-center bg-ink/15 sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label="TechStage AI Brief"><div className="ai-brief-surface brief-pop-enter flex h-[96svh] max-h-[96svh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-paper shadow-[0_30px_90px_-18px_rgba(23,24,28,.35)] sm:h-[88vh] sm:max-h-[88vh] sm:max-w-6xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-ink/10 px-4 py-3 sm:px-5"><BrandLabel /><button onClick={onClose} className="flex size-7 items-center justify-center rounded-full text-ink-faint hover:bg-ink/5 hover:text-ink" aria-label="Close"><X className="size-4" /></button></div><BriefExperience record={record} appearance={appearance} transcript={transcript} onSeek={onSeek} /></div></div>;
}

function BriefExperience({ record, appearance, transcript, onSeek, demo = false, active = true }: { record: BriefRecord; appearance: Appearance; transcript: Transcript; onSeek?: (time: number) => void; demo?: boolean; active?: boolean }) {
  const [replayKey, setReplayKey] = useState(0);
  const sequence = useBriefSequence(active, transcript.segments.length, replayKey, demo ? 19000 : 20000);
  /* In demo mode the dossier tours every section (3–4s each) and then
     the whole sequence replays. */
  if (sequence.done) return <BriefDossier record={record} appearance={appearance} transcript={transcript} onSeek={onSeek} demo={demo} onDemoTourEnd={demo ? () => setReplayKey((key) => key + 1) : undefined} />;
  return <div className="grid min-h-0 flex-1 overflow-y-auto bg-paper-gray/50 lg:grid-cols-[.9fr_1.1fr] lg:overflow-hidden"><AgentTimeline appearance={appearance} transcript={transcript} record={record} sequence={sequence} /><ArtifactPane record={record} sequence={sequence} /></div>;
}

function AgentTimeline({ appearance, transcript, record, sequence }: { appearance: Appearance; transcript: Transcript; record: BriefRecord; sequence: ReturnType<typeof useBriefSequence> }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  /* Start the ride-along at the top of the transcript, then follow
     the highlighted line. `relative` on the viewport keeps offsetTop
     local so the scroll can never jump out of frame. */
  useEffect(() => {
    if (sequence.stageIndex === 1 && viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [sequence.stageIndex]);
  useEffect(() => {
    if (sequence.stageIndex !== 1) return;
    const viewport = viewportRef.current;
    const row = viewport?.querySelector<HTMLElement>(`[data-mini-segment="${sequence.transcriptIndex}"]`);
    if (viewport && row) viewport.scrollTo({ top: Math.max(0, row.offsetTop - viewport.clientHeight / 2 + row.clientHeight / 2), behavior: "smooth" });
  }, [sequence.transcriptIndex, sequence.stageIndex]);
  return <section className="border-b border-ink/10 p-4 sm:p-6 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between gap-4"><div><p className="brief-meta text-[9px] uppercase tracking-[0.24em] text-ink-faint">Agent work</p><h2 className="brief-title mt-1 text-2xl">Building your brief</h2></div><ProgressDonut progress={sequence.progress} /></div><div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-paper">{BRIEF_STEPS.map((label, index) => { const status = index < sequence.stageIndex ? "done" : index === sequence.stageIndex ? "running" : "pending"; return <div key={label} className={cn("border-b border-ink/5 px-3.5 py-2.5 last:border-b-0", status === "running" && "bg-[var(--ts-acc-15)]/50")}><div className="flex items-center gap-3"><StageDot status={status} /><span className={cn("min-w-0 flex-1 text-[13px]", status === "pending" ? "text-ink-faint" : "font-medium text-ink")}>{label}</span><span className="shrink-0 text-[10px] font-light text-ink-faint">{index === 0 && status !== "pending" ? `${transcript.segments.length} segments · ${formatDuration(appearance.durationSeconds ?? 0)}` : status === "done" ? "done" : status === "running" ? "running" : "queued"}</span></div>{status === "running" && sequence.thinking && <p className="brief-artifact-enter mt-1.5 pl-6 text-[11px] font-light italic text-ink-faint" key={sequence.thinking}>{sequence.thinking}</p>}</div>; })}</div>
    {sequence.stageIndex === 1 && <div ref={viewportRef} className="ide-scroll relative mt-4 max-h-44 overflow-y-auto rounded-xl border border-ink/10 bg-paper p-2">{transcript.segments.map((segment, index) => <div key={segment.id} data-mini-segment={index} className={cn("flex gap-2 rounded-md border-l-2 border-transparent px-2 py-1 font-mono text-xs leading-relaxed text-ink-soft", index === sequence.transcriptIndex ? "segment-reading text-ink" : index < sequence.transcriptIndex ? "" : "opacity-60")}><span className="w-10 shrink-0 font-mono text-[10px] text-[var(--ts-acc-deep)]">{formatTimestamp(segment.startTime)}</span><span>{segment.text}</span></div>)}</div>}
    {sequence.stageIndex === 2 && <div className="mt-4 space-y-1.5">{record.sections.find((section) => section.id === "main-takeaways")?.items.slice(0, sequence.takeawayCount).map((item) => <div key={item.id} className="brief-stamp flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-[11px] text-ink-soft"><CheckCircle2 className="size-3.5 shrink-0 text-[var(--ts-acc-deep)]" />{item.headline}</div>)}</div>}
    {sequence.stageIndex === 3 && <div className="mt-4 grid grid-cols-2 gap-1.5">{SIGNALS.map((signal, index) => { const section = record.sections[index + 2]; const resolved = index <= sequence.signalIndex; return <div key={signal} className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper px-2.5 py-2 text-[11px] text-ink-soft"><span>{signal}</span><span className={cn("text-[10px]", resolved ? section?.items.length ? "font-medium text-[var(--ts-acc-deep)]" : "text-ink-faint" : "text-ink-faint")}>{resolved ? section?.items.length ? `✓ found (${section.items.length})` : "— none" : "…"}</span></div>; })}</div>}
  </section>;
}

function ProgressDonut({ progress }: { progress: number }) {
  const value = Math.round(progress * 100);
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center" aria-label={`${value}% complete`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="color-mix(in srgb, var(--color-ink) 10%, transparent)" strokeWidth="3.5" />
        <circle cx="22" cy="22" r={radius} fill="none" stroke="var(--ts-acc)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} style={{ transition: "stroke-dashoffset 120ms linear" }} />
      </svg>
      <span className="relative text-[10px] tabular-nums text-ink-soft">{value}%</span>
    </div>
  );
}

function StageDot({ status }: { status: "done" | "running" | "pending" }) {
  if (status === "running") return <LoaderCircle className="size-3.5 shrink-0 animate-spin text-[var(--ts-acc-deep)]" aria-hidden />;
  if (status === "done") return <CheckCircle2 className="size-3.5 shrink-0 text-ink-soft" aria-hidden />;
  return <Circle className="size-3.5 shrink-0 text-ink/20" aria-hidden />;
}

function ArtifactPane({ record, sequence }: { record: BriefRecord; sequence: ReturnType<typeof useBriefSequence> }) {
  const takeaway = record.sections.find((section) => section.id === "main-takeaways");
  const bottlenecks = record.sections.find((section) => section.id === "bottlenecks");
  const streamSource = takeaway?.items.map((item) => `${item.headline} — ${item.summary}`).join("\n\n") ?? "";
  const streaming = useStreamingText(streamSource, sequence.streamProgress);
  /* Follow the composing text so the whole stream stays in view. */
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = streamRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [streaming]);
  return <section className="min-h-[26rem] p-4 sm:p-6 lg:overflow-y-auto"><div className="flex items-center justify-between border-b border-ink/10 pb-3"><span className="brief-meta text-[9px] uppercase tracking-[0.24em] text-ink-faint">Artifacts</span><span className="text-[10px] font-light text-ink-faint">appear as the agent works</span></div><div className="dot-grid mt-4 min-h-[20rem] rounded-2xl border border-ink/10 bg-paper/60 p-4">{sequence.stageIndex < 2 ? <p className="brief-meta text-[10px] text-ink-faint">Waiting for transcript read…</p> : <div className="space-y-3"><ArtifactCard label="01 · Main takeaways" items={takeaway?.items.slice(0, Math.max(1, sequence.takeawayCount)) ?? []} />{sequence.stageIndex >= 3 && <ArtifactCard label="02 · Bottlenecks" items={bottlenecks?.items.slice(0, 2) ?? []} />}{sequence.stageIndex >= 4 && <div className="brief-artifact-enter rounded-xl border border-[var(--ts-acc)]/40 bg-paper p-4"><p className="brief-meta text-[9px] uppercase tracking-widest text-[var(--ts-acc-deep)]">Completing dossier</p><div ref={streamRef} className="ide-scroll mt-3 max-h-48 overflow-y-auto"><p className="whitespace-pre-line text-sm font-light leading-relaxed">{streaming}<span className="ml-0.5 inline-block h-4 w-px bg-ink align-middle" /></p></div></div>}</div>}</div></section>;
}

function ArtifactCard({ label, items }: { label: string; items: AIBriefItem[] }) {
  return <div className="brief-artifact-enter rounded-xl border border-ink/10 bg-paper p-4"><p className="brief-meta text-[9px] uppercase tracking-widest text-ink-faint">{label}</p><div className="mt-2 space-y-2">{items.map((item) => <p key={item.id} className="text-sm font-medium leading-snug"><span className="mark-a">{item.headline}</span></p>)}</div></div>;
}

function BriefDossier({ record, appearance, transcript, onSeek, demo = false, embedded = false, onDemoTourEnd }: { record: BriefRecord; appearance: Appearance; transcript: Transcript; onSeek?: (time: number) => void; demo?: boolean; embedded?: boolean; onDemoTourEnd?: () => void }) {
  const { isPro } = useAppState();
  const [page, setPage] = useState(0);
  const [dense, setDense] = useState(false);
  const [sharing, setSharing] = useState(false);
  const section = record.sections[page];

  /* Demo tour: dwell on each section, then hand control back so the
     whole sequence replays. */
  useEffect(() => {
    if (!demo) return;
    const last = page >= record.sections.length - 1;
    const timer = window.setTimeout(() => {
      if (last) onDemoTourEnd?.();
      else setPage(page + 1);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [demo, page, record.sections.length, onDemoTourEnd]);
  const locked = section.tier === "pro" && !isPro && !demo;
  const accessible = (demo || isPro) ? record.sections : record.sections.filter((row) => row.tier === "free");
  const assistantCopy = useMemo(() => {
    const instruction = `Use this TechStage brief to help me think more deeply about ${appearance.title}. Connect the speaker's claims to what you know about my goals, challenge weak assumptions, and give me three practical next steps.`;
    const transcriptText = transcript.fullText.split(/\s+/).length <= 8000 ? `\n\n## Timestamped transcript\n${transcript.segments.map((row) => `[${formatTimestamp(row.startTime)}] ${row.text}`).join("\n")}` : "";
    return `${instruction}\n\n${briefToMarkdown(appearance.title, accessible)}${transcriptText}`;
  }, [accessible, appearance.title, transcript]);
  const nextPage = (direction: number) => setPage((current) => Math.max(0, Math.min(record.sections.length - 1, current + direction)));
  const shareImages = async () => { setSharing(true); try { const files = await Promise.all(accessible.map((row) => renderSectionPng(row, appearance.title))); if (navigator.share && navigator.canShare?.({ files })) await navigator.share({ title: `${appearance.title} — TechStage`, files }); else { for (const file of files) { const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); URL.revokeObjectURL(url); } } } catch { /* native share sheet dismissed */ } finally { setSharing(false); } };
  const touchStart = useRef<number | null>(null);
  const touchEnd = (x: number) => { if (touchStart.current == null) return; const delta = x - touchStart.current; if (Math.abs(delta) > 55) nextPage(delta < 0 ? 1 : -1); touchStart.current = null; };

  return <div className={cn("brief-print-root flex min-h-0 flex-1 flex-col bg-paper", embedded && "h-[42rem]")}>
    <div className="flex items-center justify-between gap-4 border-b border-ink/10 bg-[var(--ts-acc-15)]/60 px-4 py-2.5"><p className="brief-meta text-[9px] uppercase tracking-[0.22em] text-ink-soft">Done · saved to this talk</p><p className="brief-meta hidden text-[9px] text-ink-faint sm:block">{record.model}</p></div>
    <SectionRail sections={record.sections} page={page} setPage={setPage} isPro={isPro || demo} />
    <div className="brief-interactive ide-scroll min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden">
      <div className={cn("relative ide-scroll min-h-[24rem] overflow-y-auto px-4 py-4 sm:px-12 sm:py-6", dense && "brief-density-compact")} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => touchEnd(event.changedTouches[0]?.clientX ?? 0)}>
        <button onClick={() => nextPage(-1)} disabled={page === 0} className="absolute left-2 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center text-ink-soft hover:text-[var(--ts-acc-deep)] disabled:opacity-20 lg:flex" aria-label="Previous section"><ArrowLeft className="size-5" /></button><button onClick={() => nextPage(1)} disabled={page === record.sections.length - 1} className="absolute right-2 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center text-ink-soft hover:text-[var(--ts-acc-deep)] disabled:opacity-20 lg:flex" aria-label="Next section"><ArrowRight className="size-5" /></button>
        <div key={section.id} className="brief-page-enter mx-auto max-w-xl"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-3"><div className="min-w-0"><p className="brief-meta text-[10px] uppercase tracking-[0.18em] text-ink-faint">Section {String(section.number).padStart(2, "0")}</p><h2 className="brief-title mt-1 text-2xl">{section.title}</h2></div><span className={cn("brief-meta tech-frame tech-frame-always tech-frame-compact shrink-0 border px-2.5 py-1 text-[10px] uppercase tracking-wider", section.tier === "pro" ? "text-[var(--ts-acc-deep)]" : "text-ink-soft")}>{section.tier === "pro" ? "Premium" : "Included"}</span></div>{locked ? <LockedPage section={section} /> : <SectionPage section={section} onSeek={onSeek} />}</div>
      </div>
      {!demo && <AssistantWorkbench text={assistantCopy} appearance={appearance} />}
    </div>
    <PrintBrief appearance={appearance} sections={accessible} />
    <div className="brief-interactive relative flex min-h-14 flex-col items-center gap-1 border-t border-ink/10 bg-paper px-3 py-2 sm:flex-row sm:px-5"><div className="flex items-center gap-1 sm:absolute sm:left-1/2 sm:-translate-x-1/2"><button onClick={() => nextPage(-1)} disabled={page === 0} className="flex size-7 items-center justify-center text-ink-soft hover:text-[var(--ts-acc-deep)] disabled:opacity-20" aria-label="Previous section"><ArrowLeft className="size-3.5" /></button><span className="brief-meta min-w-12 text-center text-[11px] tabular-nums text-ink-soft">{page + 1} / {record.sections.length}</span><button onClick={() => nextPage(1)} disabled={page === record.sections.length - 1} className="flex size-7 items-center justify-center text-ink-soft hover:text-[var(--ts-acc-deep)] disabled:opacity-20" aria-label="Next section"><ArrowRight className="size-3.5" /></button></div>{!demo && <div className="flex items-center gap-1 sm:ml-auto"><FooterAction label={dense ? "Comfortable" : "Fit more"} onClick={() => setDense((value) => !value)}>{dense ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}</FooterAction><FooterAction label="PDF" onClick={() => window.print()}><Download className="size-3.5" /></FooterAction><FooterAction label={sharing ? "Preparing" : "Share images"} onClick={shareImages}><Share2 className="size-3.5" /></FooterAction></div>}</div>
  </div>;
}

function SectionRail({ sections, page, setPage, isPro }: { sections: AIBriefSection[]; page: number; setPage: (page: number) => void; isPro: boolean }) {
  /* shrink-0 keeps the rail pinned and always fully in frame — only
     the section content below it scrolls. */
  return <nav className="brief-interactive ide-scroll shrink-0 overflow-x-auto overflow-y-hidden border-b border-ink/10 bg-paper px-3 py-3" aria-label="Brief sections"><div className="mx-auto flex w-max min-w-full justify-center gap-3">{sections.map((row, index) => { const active = index === page; const locked = row.tier === "pro" && !isPro; return <button key={row.id} onClick={() => setPage(index)} className={cn("tech-frame min-w-[8.25rem] border border-transparent px-3 py-2 text-left transition-colors", active ? "tech-frame-always text-ink" : "text-ink-soft hover:text-ink")} aria-current={active ? "true" : undefined}><span className="brief-meta block text-[10px] tabular-nums text-[var(--ts-acc-deep)]">{locked ? <Lock className="size-3.5" /> : String(row.number).padStart(2, "0")}</span><span className="mt-1 block whitespace-nowrap text-[12px] font-medium">{row.title}</span></button>; })}</div></nav>;
}

function AssistantWorkbench({ text, appearance }: { text: string; appearance: Appearance }) {
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<number | null>(null);
  useEffect(() => { setProgress(0); const started = performance.now(); const timer = window.setInterval(() => { const next = Math.min(1, (performance.now() - started) / 7600); setProgress(next); if (next >= 1) window.clearInterval(timer); }, 45); return () => window.clearInterval(timer); }, [text]);
  const visible = useStreamingText(text, progress);
  const clearHintTimer = () => { if (hintTimer.current != null) window.clearTimeout(hintTimer.current); hintTimer.current = null; };
  const copy = async () => { await navigator.clipboard?.writeText(text); clearHintTimer(); setCopied(true); setShowHint(true); window.setTimeout(() => { setCopied(false); setShowHint(false); }, 700); };
  return <aside className="border-t border-ink/10 bg-paper-gray/45 p-5 lg:ide-scroll lg:overflow-y-auto lg:border-l lg:border-t-0"><p className="brief-meta text-[10px] uppercase tracking-[0.18em] text-ink-faint">Continue the conversation</p><h3 className="brief-title mt-2 text-2xl">Bring this into your assistant.</h3><p className="mt-2 text-sm font-light leading-relaxed text-ink-soft">Copy this ready-made prompt into ChatGPT, Claude, or Grok. It includes the brief and transcript so your assistant can connect the talk to your own goals.</p><div className="relative mt-4 overflow-visible rounded-2xl bg-[#f3f3f3] p-4"><div className="mb-3 flex items-center justify-between"><span className="brief-meta text-[11px] text-ink-soft">TechStage brief prompt</span><button onClick={copy} onMouseEnter={() => { clearHintTimer(); hintTimer.current = window.setTimeout(() => setShowHint(true), 2000); }} onMouseLeave={() => { clearHintTimer(); if (!copied) setShowHint(false); }} className="relative flex size-8 items-center justify-center rounded-lg text-ink-soft hover:bg-white hover:text-ink" aria-label={copied ? "Response copied" : "Copy response"}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}<span className={cn("pointer-events-none absolute right-0 top-full z-20 mt-1 w-max rounded-md bg-ink px-2 py-1.5 font-sans text-[10px] font-normal text-paper transition-opacity", showHint ? "opacity-100" : "opacity-0")}>{copied ? "Copied" : "Copy"}</span></button></div><pre className="ide-scroll max-h-[30rem] overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-[1.65] text-ink-soft antialiased">{visible}<span className={cn("inline-block h-3 w-px bg-ink align-middle", progress >= 1 && "hidden")} /></pre><div className="mt-3 flex items-center justify-end border-t border-ink/10 pt-2"><button onClick={copy} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-sans text-[11px] text-ink-soft hover:bg-white hover:text-ink" aria-label={copied ? "Response copied" : "Copy response"}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}<span>{copied ? "Copied" : "Copy"}</span></button></div></div><p className="mt-4 text-sm font-medium leading-relaxed text-ink">Run this in your assistant to pressure-test what was said in “{appearance.title}” and turn it into actions that fit you.</p></aside>;
}

function FooterAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="brief-control flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-ink-soft hover:text-[var(--ts-acc-deep)]" aria-label={label}>{children}<span className="hidden sm:inline">{label}</span></button>;
}

function LockedPage({ section }: { section: AIBriefSection }) {
  return <div className="relative mt-4 min-h-64 overflow-hidden rounded-2xl border border-ink/10"><div className="locked-veil dot-grid space-y-4 p-6"><div className="h-8 w-3/4 rounded-md bg-ink/20" /><div className="h-16 rounded-md bg-paper-gray" /><div className="h-16 rounded-md bg-paper-gray" /></div><div className="absolute inset-0 flex flex-col items-center justify-center bg-paper/45 p-6 text-center backdrop-blur-md"><Lock className="size-4 text-ink-soft" /><p className="brief-title mt-3 text-xl">{section.items.length || "More"} sourced {section.items.length === 1 ? "signal" : "signals"} inside</p><p className="mt-2 max-w-sm text-xs font-light leading-relaxed text-ink-faint">Premium keeps the evidence, timestamps, and strategic interpretation together.</p><Link to="/subscription" className="brief-control mt-5 rounded-lg border border-[var(--ts-acc)] bg-paper px-4 py-2 text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)] hover:bg-[var(--ts-acc-15)]">Unlock the complete brief</Link></div></div>;
}

function SectionPage({ section, onSeek }: { section: AIBriefSection; onSeek?: (time: number) => void }) {
  if (!section.items.length) return <p className="mt-6 rounded-xl border border-dashed border-ink/20 p-5 text-xs font-light text-ink-faint">No strong signal was detected in the transcript. TechStage does not pad a brief.</p>;
  const useMarkB = section.id === "market-sentiment";
  return <div className="mt-3 divide-y divide-ink/10">{section.items.map((item, index) => <article key={item.id} className="brief-insight py-4"><div className="flex flex-col items-start gap-3 sm:flex-row">{section.id === "founder-strategy" && <span className="brief-meta mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--ts-acc-15)] text-[9px] text-[var(--ts-acc-deep)]">{String(index + 1).padStart(2, "0")}</span>}<div className="min-w-0 flex-1"><h3 className="text-base font-medium leading-snug sm:text-lg"><span className={useMarkB ? "mark-b" : "mark-a"}>{item.headline}</span></h3><ul className="mt-2 space-y-1.5">{summaryBullets(item.summary).map((bullet) => <li key={bullet} className="flex gap-2 text-xs font-light leading-relaxed text-ink-soft sm:text-sm"><span className="mt-[.55em] size-1 shrink-0 rounded-full bg-ink/35" />{bullet}</li>)}</ul>{section.id === "industry-effects" && item.relatedCompanyIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.relatedCompanyIds.map((id) => <Link key={id} to={`/companies/${companySlug(id)}`} className="brief-meta rounded-md bg-paper-gray px-2 py-1 text-[9px] text-ink-soft">{companyName(id)}</Link>)}</div>}</div><Timestamp item={item} onSeek={onSeek} /></div></article>)}</div>;
}

function summaryBullets(summary: string) {
  const sentences = summary.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((value) => value.trim()).filter(Boolean) ?? [summary];
  return sentences.slice(0, 2).map((sentence) => sentence.length > 220 ? `${sentence.slice(0, 217).trim()}…` : sentence);
}

function Timestamp({ item, onSeek }: { item: AIBriefItem; onSeek?: (time: number) => void }) {
  if (item.timestamp == null || item.timestamp <= 0) return null;
  return <button onClick={() => onSeek?.(item.timestamp!)} disabled={!onSeek} className="brief-meta h-fit shrink-0 border border-[var(--ts-acc-45)] bg-[var(--ts-acc-15)] px-3 py-2 text-[11px] font-medium text-[var(--ts-acc-deep)] hover:border-[var(--ts-acc)] disabled:border-ink/10 disabled:bg-ink/5 disabled:text-ink-faint">Find this at {formatTimestamp(item.timestamp)}</button>;
}

function PrintBrief({ appearance, sections }: { appearance: Appearance; sections: AIBriefSection[] }) {
  const pages = Array.from({ length: Math.ceil(sections.length / 2) }, (_, index) => sections.slice(index * 2, index * 2 + 2));
  return <div className="brief-print-all hidden p-8"><p className="brief-meta text-[10px] uppercase tracking-[.25em] text-ink-faint">TechStage AI Brief</p><h1 className="brief-title mt-2 text-4xl">{appearance.title}</h1>{pages.map((rows, page) => <div key={page} className="brief-print-page">{rows.map((section) => <section key={section.id} className="py-5"><p className="brief-meta text-[9px] uppercase tracking-widest text-ink-faint">Section {String(section.number).padStart(2, "0")}</p><h2 className="brief-title mt-1 text-2xl">{section.title}</h2><div className="mt-3 space-y-3">{section.items.length ? section.items.map((item) => <article key={item.id}><h3 className="text-base font-semibold">{item.headline}</h3><ul className="mt-1 list-disc pl-5 text-xs">{summaryBullets(item.summary).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>{item.timestamp != null && item.timestamp > 0 && <p className="brief-meta mt-1 text-[9px]">Find this at {formatTimestamp(item.timestamp)}</p>}</article>) : <p>No strong signal detected.</p>}</div></section>)}</div>)}</div>;
}

async function renderSectionPng(section: AIBriefSection, talkTitle: string) {
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1500;
  const context = canvas.getContext("2d")!; context.fillStyle = "#f5f5f6"; context.fillRect(0, 0, canvas.width, canvas.height);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--ts-acc").trim() || "#2b5cff";
  context.fillStyle = "#17181c"; context.font = "500 28px Tabular-Variable, sans-serif"; context.fillText("TECHSTAGE", 76, 84);
  context.fillStyle = accent; context.fillRect(76, 112, 1048, 8);
  context.fillStyle = "#8b8e98"; context.font = "400 22px Switzer-Variable, sans-serif"; context.fillText(`AI BRIEF · SECTION ${String(section.number).padStart(2, "0")}`, 76, 176);
  context.fillStyle = "#17181c"; context.font = "500 52px Tabular-Variable, sans-serif"; let y = drawWrapped(context, section.title, 76, 244, 1048, 62, 2) + 42;
  context.fillStyle = "#4b4e57"; context.font = "300 25px Switzer-Variable, sans-serif"; y = drawWrapped(context, talkTitle, 76, y, 1048, 34, 2) + 52;
  for (const item of section.items.slice(0, 4)) { context.fillStyle = accent; context.fillRect(76, y - 21, 8, 8); context.fillStyle = "#17181c"; context.font = "500 29px Switzer-Variable, sans-serif"; y = drawWrapped(context, item.headline, 104, y, 990, 38, 2) + 18; context.fillStyle = "#4b4e57"; context.font = "300 23px Switzer-Variable, sans-serif"; for (const bullet of summaryBullets(item.summary)) y = drawWrapped(context, `• ${bullet}`, 104, y, 970, 32, 3) + 10; if (item.timestamp != null && item.timestamp > 0) { context.fillStyle = accent; context.font = "500 20px Tabular-Variable, sans-serif"; context.fillText(`FIND THIS AT ${formatTimestamp(item.timestamp)}`, 104, y + 8); y += 64; } y += 24; if (y > 1340) break; }
  context.fillStyle = "#8b8e98"; context.font = "400 18px Switzer-Variable, sans-serif"; context.fillText("Generated from the verified transcript · techstage.app", 76, 1440);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png", .92));
  return new File([blob], `techstage-${String(section.number).padStart(2, "0")}-${section.id}.png`, { type: "image/png" });
}

function drawWrapped(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/); let line = ""; let lines = 0;
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (context.measureText(next).width > width && line) { context.fillText(line, x, y); y += lineHeight; lines += 1; line = word; if (lines >= maxLines) return y; } else line = next; }
  if (line && lines < maxLines) { context.fillText(line, x, y); y += lineHeight; }
  return y;
}

export function SummaryShowcase() {
  const db = getSeedDb();
  const sourceBrief = db.insightBriefs.find((brief) => db.appearances.some((appearance) => appearance.id === brief.appearanceId));
  const appearance = sourceBrief ? db.appearances.find((row) => row.id === sourceBrief.appearanceId) : undefined;
  const transcript = appearance ? db.transcripts.find((row) => row.appearanceId === appearance.id) : undefined;
  const record = useMemo(() => appearance && transcript && sourceBrief ? assembleBriefRecord(appearance, transcript, db.insights.filter((row) => row.insightBriefId === sourceBrief.id)) : null, [appearance, transcript, sourceBrief, db.insights]);
  const ref = useRef<HTMLDivElement>(null); const [active, setActive] = useState(false);
  useEffect(() => { const node = ref.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: .25 }); observer.observe(node); return () => observer.disconnect(); }, []);
  if (!appearance || !transcript || !record) return <div className="ai-brief-surface border border-ink/15 bg-paper p-6 text-sm text-ink-soft">The AI brief demo will appear when a transcript-backed panel is available.</div>;
  return <div ref={ref} className="ai-brief-surface relative overflow-hidden rounded-2xl border border-ink/15 bg-paper shadow-[0_24px_70px_-24px_rgba(23,24,28,.3)]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-2.5"><BrandLabel /><span className="brief-meta tech-frame tech-frame-always tech-frame-compact border px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--ts-acc-deep)]">Live demo</span></div><div className="pointer-events-none max-h-[36rem] overflow-hidden"><BriefExperience record={record} appearance={appearance} transcript={transcript} demo active={active} /></div></div>;
}

export function DemoReel({ title, note, src, poster = "/media/techstage-stage.png" }: { title: string; note: string; src?: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { const node = videoRef.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => entry.isIntersecting ? void node.play().catch(() => {}) : node.pause(), { threshold: .3 }); observer.observe(node); return () => observer.disconnect(); }, []);
  return <article className="border border-ink/20 bg-paper"><div className="flex items-center justify-between border-b border-ink/15 px-3 py-2"><span className="font-mono text-[8px] uppercase tracking-widest text-ink-soft">{title}</span><span className="font-mono text-[8px] uppercase tracking-widest text-ink-faint">Demo · 0:20</span></div><div className="relative aspect-video overflow-hidden bg-paper-gray">{src ? <video ref={videoRef} src={src} poster={poster} muted loop playsInline className="size-full object-cover" /> : <><img src={poster} alt="" className="size-full object-cover grayscale-[35%]" /><div className="absolute inset-0 dot-grid bg-paper/55" /><div className="absolute inset-0 flex items-center justify-center"><span className="border border-ink bg-paper/90 px-3 py-2 font-mono text-[9px] uppercase tracking-widest">Recording coming soon</span></div></>}</div><p className="p-4 text-sm text-ink-soft">{note}</p></article>;
}
