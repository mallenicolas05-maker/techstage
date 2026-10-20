import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUpRight, CalendarDays, Rows3 } from "lucide-react";
import { catalogRepo, DEMO_NOW } from "@/data/repositories/local";
import { useAsync } from "@/lib/useAsync";
import { AppearanceRow, UpcomingRow } from "@/components/media/cards";
import { EmptyState, Modal, RowSkeleton } from "@/components/ui/primitives";
import { formatDate, formatTime } from "@/lib/format";
import { speakerNames } from "@/data/lookup";
import type { Appearance } from "@/domain/types";
import { cn } from "@/lib/utils";

export default function Upcoming() {
  const [params] = useSearchParams();
  const showAll = params.get("view") === "all";
  const schedule = useAsync(async () => {
    const [future, recent] = await Promise.all([
      catalogRepo.upcomingAppearances(),
      catalogRepo.latestAppearances(12),
    ]);
    return { future, recent };
  }, []);
  const [preview, setPreview] = useState<Appearance | null>(null);

  const rows = schedule.data?.future ?? [];
  const recent = schedule.data?.recent ?? [];
  const popular = [...rows]
    .filter((row) => row.status !== "cancelled")
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 3);
  const grouped = useMemo(() => {
    const map = new Map<string, Appearance[]>();
    rows.forEach((row) => {
      const key = new Date(row.scheduledStart).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    return [...map.entries()];
  }, [rows]);

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="ts-paper -mx-4 border-b border-line px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--ts-acc2-deep)]">
            <span className="text-backer">What is next</span>
          </p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
            <span className="text-backer">Upcoming appearances</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            <span className="text-backer">
              See confirmed technology conversations in your local time, preview
              the details, and set a reminder.
            </span>
          </p>
        </div>
      </section>

      {schedule.loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      ) : !rows.length ? (
        <section className="py-8">
          <EmptyState
            title="No confirmed future dates yet"
            hint="New appearances will show here as soon as an official date is confirmed."
          />
          <div className="mt-10 flex items-end justify-between border-b border-ink/15 pb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--ts-acc2-deep)]">
                Schedule archive
              </p>
              <h2 className="mt-1 font-serif text-3xl">Recently recorded</h2>
            </div>
            <Link
              to="/discover"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]"
            >
              Open Discover →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {recent.map((row) => (
              <AppearanceRow key={row.id} a={row} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {!showAll && (
            <section className="pt-8">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    Most watched
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    Popular this week
                  </h2>
                </div>
                <Link
                  to="/upcoming?view=all"
                  className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]"
                >
                  View all →
                </Link>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {popular.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setPreview(row)}
                    className="tech-frame cursor-pointer border border-line bg-paper p-5 text-left"
                  >
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--ts-acc2-deep)]">
                      {formatDate(row.scheduledStart)} ·{" "}
                      {formatTime(row.scheduledStart)}
                    </span>
                    <span className="mt-3 block font-serif text-2xl leading-tight">
                      {row.title}
                    </span>
                    <span className="mt-3 block text-xs text-ink-faint">
                      {speakerNames(row.speakerIds, 2)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="sticky top-16 z-20 -mx-4 mt-8 flex justify-center gap-px border-y border-ink/15 bg-paper/95 px-4 py-2 backdrop-blur-sm">
            <a
              href="#feed"
              className="inline-flex items-center gap-2 border border-[var(--ts-acc)] bg-[var(--ts-acc-15)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]"
            >
              <Rows3 className="size-3 text-ink-soft" /> Feed{" "}
              <ArrowDown className="size-3 text-ink-soft" />
            </a>
            <a
              href="#calendar"
              className="inline-flex items-center gap-2 border border-ink/25 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft"
            >
              <CalendarDays className="size-3" /> Calendar{" "}
              <ArrowDown className="size-3" />
            </a>
          </div>

          <section id="feed" className="scroll-mt-32 pt-10">
            <h2 className="font-serif text-3xl">Feed</h2>
            <div className={cn("mt-5", showAll ? "space-y-10" : "space-y-8")}>
              {grouped.map(([month, monthRows]) => (
                <div key={month}>
                  <p className="border-b border-ink/15 pb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    {month}
                  </p>
                  <div
                    className={cn(
                      "mt-3",
                      showAll ? "grid gap-3 lg:grid-cols-2" : "space-y-3",
                    )}
                  >
                    {monthRows.map((row) => (
                      <UpcomingRow key={row.id} a={row} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="calendar" className="scroll-mt-32 pt-16">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--ts-acc2-deep)]">
                  Local time
                </p>
                <h2 className="mt-1 font-serif text-3xl">Calendar</h2>
              </div>
              <a
                href="#feed"
                className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc-deep)]"
              >
                Back to feed ↑
              </a>
            </div>
            <CalendarView appearances={rows} onPreview={setPreview} />
          </section>
        </>
      )}

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Appearance preview"
        className="sm:max-w-xl"
      >
        {preview && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ts-acc2-deep)]">
              {formatDate(preview.scheduledStart)} ·{" "}
              {formatTime(preview.scheduledStart)}
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight">
              {preview.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {preview.description}
            </p>
            <p className="mt-4 font-mono text-[10px] text-ink-faint">
              {speakerNames(preview.speakerIds, 3)}
            </p>
            <Link
              to={`/a/${preview.slug}`}
              className="mt-6 inline-flex items-center gap-2 border border-[var(--ts-acc)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)]"
            >
              Open full appearance{" "}
              <ArrowUpRight className="size-3.5 text-ink-soft" />
            </Link>
          </div>
        )}
      </Modal>
    </main>
  );
}

function CalendarView({
  appearances,
  onPreview,
}: {
  appearances: Appearance[];
  onPreview: (appearance: Appearance) => void;
}) {
  /* Months that actually contain appearances, in order */
  const months = useMemo(() => {
    const seen = new Map<string, { year: number; monthIndex: number }>();
    for (const row of appearances) {
      const d = new Date(row.scheduledStart);
      seen.set(`${d.getFullYear()}-${d.getMonth()}`, {
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
      });
    }
    const list = [...seen.values()].sort(
      (a, b) => a.year - b.year || a.monthIndex - b.monthIndex,
    );
    return list.length
      ? list
      : [{ year: DEMO_NOW.getFullYear(), monthIndex: DEMO_NOW.getMonth() }];
  }, [appearances]);
  const [cursor, setCursor] = useState(0);
  const { year, monthIndex } = months[Math.min(cursor, months.length - 1)];

  const first = new Date(year, monthIndex, 1);
  const start = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: start }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  const MAX_CHIPS = 2;

  const isToday = (day: number) =>
    DEMO_NOW.getFullYear() === year &&
    DEMO_NOW.getMonth() === monthIndex &&
    DEMO_NOW.getDate() === day;

  return (
    <div className="mt-5">
      {/* Month header: serif month on paper, prev/next across busy months */}
      <div className="flex items-center justify-between border border-ink/20 bg-paper px-3 py-2.5">
        <button
          onClick={() => setCursor((c) => Math.max(0, c - 1))}
          disabled={cursor === 0}
          className="cursor-pointer border border-ink/25 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-soft transition-colors hover:border-ink disabled:cursor-default disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="font-serif text-2xl">
          {first.toLocaleDateString(undefined, { month: "long" })}{" "}
          <span className="font-mono text-sm text-ink-faint">{year}</span>
        </span>
        <button
          onClick={() => setCursor((c) => Math.min(months.length - 1, c + 1))}
          disabled={cursor >= months.length - 1}
          className="cursor-pointer border border-ink/25 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-soft transition-colors hover:border-ink disabled:cursor-default disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px border-x border-b border-ink/20 bg-ink/20">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div
            key={label}
            className="bg-paper-gray p-2 text-center font-mono text-[9px] uppercase tracking-widest text-ink-faint"
          >
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          const dayRows = day
            ? appearances.filter((row) => {
                const value = new Date(row.scheduledStart);
                return (
                  value.getFullYear() === year &&
                  value.getMonth() === monthIndex &&
                  value.getDate() === day
                );
              })
            : [];
          return (
            <div
              key={index}
              className={cn(
                "min-h-24 bg-paper p-1.5 sm:min-h-32 sm:p-2",
                !day && "bg-paper-gray/60",
              )}
            >
              {day && (
                <span
                  className={cn(
                    "inline-flex min-w-6 justify-center px-1 py-0.5 font-mono text-[10px]",
                    isToday(day)
                      ? "border border-[var(--ts-acc)] font-semibold text-[var(--ts-acc-deep)]"
                      : "text-ink-faint",
                  )}
                >
                  {day}
                </span>
              )}
              <div className="mt-1.5 space-y-1">
                {dayRows.slice(0, MAX_CHIPS).map((row) => (
                  <button
                    key={row.id}
                    onClick={() => onPreview(row)}
                    title={row.title}
                    className={cn(
                      "block w-full cursor-pointer truncate border p-1 text-left font-mono text-[10px] leading-tight transition-colors",
                      row.status === "cancelled"
                        ? "border-line text-ink-faint line-through"
                        : row.status === "rescheduled"
                          ? "border-warn/50 bg-warn-soft text-warn hover:border-warn"
                          : "border-[var(--ts-acc-45)] bg-[var(--ts-acc-15-solid)] text-[var(--ts-acc-deep)] hover:border-[var(--ts-acc)]",
                    )}
                  >
                    {row.title}
                  </button>
                ))}
                {dayRows.length > MAX_CHIPS && (
                  <button
                    onClick={() => onPreview(dayRows[MAX_CHIPS])}
                    className="block w-full cursor-pointer p-0.5 text-left font-mono text-[9px] uppercase tracking-widest text-ink-faint hover:text-ink"
                  >
                    +{dayRows.length - MAX_CHIPS} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
