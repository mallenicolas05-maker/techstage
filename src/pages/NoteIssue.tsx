import { ArrowUpRight, Clock3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Reveal } from "@/components/motion";
import { SubscribeCard } from "@/components/newsletter/SubscribeCard";
import { StageNotesMasthead } from "@/components/newsletter/StageNotesMasthead";
import { EmptyState, RowSkeleton } from "@/components/ui/primitives";
import { getLiveDigestIssue } from "@/data/liveDigests";
import { useAsync } from "@/lib/useAsync";

const sections = (value: unknown): Array<{ label: string; paragraphs: string[] }> => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Array<{ label: string; paragraphs: string[] }> => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const paragraphs = Array.isArray(record.paragraphs) ? record.paragraphs.filter((part: unknown): part is string => typeof part === "string") : [];
    return [{ label: String(record.label ?? "Analysis"), paragraphs }];
  });
};

export default function NoteIssue() {
  const { issueSlug = "" } = useParams();
  const issue = useAsync(() => getLiveDigestIssue(issueSlug), [issueSlug]);
  if (issue.loading) return <main className="mx-auto max-w-[696px] px-5 py-20"><RowSkeleton /><RowSkeleton className="mt-3" /></main>;
  const item = issue.data;
  if (!item) return <main className="digest-surface mx-auto min-h-[65vh] max-w-[696px] px-5 py-20"><StageNotesMasthead /><EmptyState className="mt-12" title="Issue not found" hint="Only issues whose recordings are public and ready are shown." /><Link to="/stage-notes" className="digest-link mt-5 inline-block text-[var(--ts-acc-deep)]">Browse Stage Notes</Link></main>;
  return <main className="digest-surface bg-paper"><article><header className="ts-paper border-b border-line px-5 py-14 sm:py-20"><Reveal className="mx-auto max-w-[696px]"><StageNotesMasthead issueNumber={item.issue_number} panelCount={item.digest_panels.length} readingMinutes={item.reading_minutes} /><h1 className="mt-12 text-[length:var(--digest-issue-title)] font-bold leading-[var(--digest-issue-title-lh)] tracking-[-0.025em] text-ink">{item.title}</h1><p className="mt-4 text-[length:var(--digest-deck)] leading-[var(--digest-deck-lh)] text-ink-faint">{item.deck}</p><div className="mt-6 flex items-center gap-2 text-sm text-ink-soft"><Clock3 className="size-4 text-[var(--ts-acc)]" /> {item.reading_minutes} minute read</div></Reveal></header><div className="mx-auto max-w-[696px] px-5 sm:px-0"><Reveal className="py-12 sm:py-16"><h2 className="digest-question-label"><span aria-hidden>▸</span>The big picture</h2><p className="digest-body mt-4 text-ink-soft">{item.big_picture}</p></Reveal><div className="space-y-14 border-t border-line py-14 sm:space-y-20 sm:py-20">{item.digest_panels.sort((a, b) => a.position - b.position).map((panel, index) => <Reveal key={panel.id}><article className="border-t border-line pt-8"><p className="digest-meta text-[var(--ts-acc-deep)]">{String(index + 1).padStart(2, "0")} / {String(item.digest_panels.length).padStart(2, "0")}</p><h2 className="mt-4 text-[length:var(--digest-panel-title)] font-bold leading-[var(--digest-panel-title-lh)] tracking-[-0.025em] text-ink">{panel.appearance ? <Link to={`/a/${panel.appearance.slug}`} className="digest-link">{panel.title}</Link> : panel.title}</h2><div className="mt-7 space-y-7">{sections(panel.editorial_sections).map((section) => <section key={section.label}><h3 className="digest-question-label"><span aria-hidden>▸</span>{section.label}</h3><div className="mt-3 space-y-4">{section.paragraphs.map((paragraph) => <p key={paragraph} className="digest-body text-ink-soft">{paragraph}</p>)}</div></section>)}</div><a href={panel.source_url} target="_blank" rel="noreferrer" className="digest-link mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ts-acc-deep)]">Official source <ArrowUpRight className="size-3.5" /></a></article></Reveal>)}</div><Reveal className="py-14 sm:py-20"><SubscribeCard source={`notes-${item.slug}`} /></Reveal></div></article></main>;
}
