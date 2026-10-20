import { Link } from "react-router-dom";

export function StageNotesMasthead({
  issueNumber,
  date,
  panelCount,
  readingMinutes,
  shortStack = false,
}: {
  issueNumber?: number;
  date?: string;
  panelCount?: number;
  readingMinutes?: number;
  shortStack?: boolean;
}) {
  return (
    <div className="text-center">
      <Link to="/stage-notes" className="digest-meta inline-flex items-center gap-2 text-[var(--ts-acc2-deep)]">
        <span>STAGE NOTES</span>
        <span aria-hidden>—</span>
        <span>BY TECH<span className="text-[var(--ts-acc)]">STAGE</span></span>
      </Link>
      <p className="mt-4 font-serif text-[2.5rem] font-semibold leading-none tracking-[-0.025em] text-ink sm:text-[3rem]">
        Stage <span className="mark-a">Notes</span>
      </p>
      {issueNumber !== undefined && date && panelCount !== undefined && readingMinutes !== undefined && (
        <p className="digest-meta mt-5 text-ink-faint">
          {shortStack ? "SHORT STACK" : `ISSUE № ${String(issueNumber).padStart(3, "0")}`} · {date.toUpperCase()} · {panelCount} {panelCount === 1 ? "PANEL" : "PANELS"} · {readingMinutes} MIN READ
        </p>
      )}
    </div>
  );
}
