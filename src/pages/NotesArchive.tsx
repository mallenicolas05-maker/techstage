import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion";
import { StageNotesMasthead } from "@/components/newsletter/StageNotesMasthead";
import { SubscribeCard } from "@/components/newsletter/SubscribeCard";
import { EmptyState, RowSkeleton } from "@/components/ui/primitives";
import { listLiveDigestIssues } from "@/data/liveDigests";
import { useAsync } from "@/lib/useAsync";

function formatIssueDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value)) : ""; }

export default function NotesArchive() {
  const issues = useAsync(() => listLiveDigestIssues(), []);
  return <main className="digest-surface min-h-screen bg-paper"><section className="ts-paper border-b border-line px-5 py-16 sm:py-24"><Reveal className="mx-auto max-w-[696px]"><StageNotesMasthead /><h1 className="mx-auto mt-10 max-w-2xl text-center font-serif text-[length:var(--digest-issue-title)] font-bold leading-[var(--digest-issue-title-lh)] tracking-[-0.025em] text-ink">Stage Notes</h1><p className="mx-auto mt-4 max-w-xl text-center text-[length:var(--digest-deck)] leading-[var(--digest-deck-lh)] text-ink-soft">Source-grounded analysis of public TechStage recordings.</p></Reveal></section><section className="mx-auto max-w-[696px] px-5 py-14 sm:px-0 sm:py-20"><p className="digest-meta border-b border-line pb-3 text-ink-faint">LATEST ISSUES</p><div>{issues.loading && <div className="mt-5 space-y-3"><RowSkeleton /><RowSkeleton /></div>}{!issues.loading && !(issues.data ?? []).length && <EmptyState className="mt-5" title="No published Stage Notes yet" hint="Issues appear only after every linked recording is public and ready." />}{(issues.data ?? []).map((issue, index) => <Reveal key={issue.id} delay={index * 80}><Link to={`/stage-notes/${issue.slug}`} className="dot-grid group grid gap-5 border-b border-dotted border-ink/35 px-3 py-9 sm:grid-cols-[88px_1fr_auto] sm:items-start"><span className="digest-meta text-[var(--ts-acc-deep)]">№ {String(issue.issue_number).padStart(3, "0")}</span><span><span className="block text-[length:var(--digest-panel-title)] font-bold leading-[var(--digest-panel-title-lh)] tracking-[-0.02em] text-ink transition-colors group-hover:text-[var(--ts-acc-deep)]">{issue.title}</span><span className="mt-3 block text-[length:var(--digest-deck)] leading-[var(--digest-deck-lh)] text-ink-soft">{issue.deck}</span><span className="digest-meta mt-4 block text-ink-faint">{formatIssueDate(issue.sent_at).toUpperCase()} · {issue.digest_panels.length} PANELS · {issue.reading_minutes} MIN</span></span><ArrowRight className="mt-1 size-5 text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-[var(--ts-acc)]" /></Link></Reveal>)}</div><Reveal className="mt-14"><SubscribeCard source="notes-archive" /></Reveal></section></main>;
}
