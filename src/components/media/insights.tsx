import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type { Insight, InsightBrief } from "@/domain/types";
import { ENRICHMENT_CONFIG, INSIGHT_CATEGORIES } from "@/domain/insightCategories";
import { appearanceSlug, appearanceTitle } from "@/data/lookup";
import { formatTimestamp } from "@/lib/format";
import { useAppState } from "@/state/AppState";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* Premium insight modules.
   - Insights are precomputed and stored; the UI only renders what the
     brief contains and what clears the display confidence threshold.
   - Free users see restrained locked modules (real markup, veiled).
   - Briefs with no applicable insights say so honestly. */

export function displayableInsights(insights: Insight[]): Insight[] {
  return insights
    .filter(
      (i) =>
        i.isApplicable &&
        i.confidence >= ENRICHMENT_CONFIG.displayConfidenceThreshold &&
        i.evidence.length >= ENRICHMENT_CONFIG.minEvidenceCount
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

const EVIDENCE_KIND_LABELS: Record<Insight["evidence"][number]["kind"], string> = {
  "direct-statement": "said directly",
  summary: "summarized",
  "cautious-inference": "cautious inference",
  "model-interpretation": "model interpretation",
};

const PLAIN_LABELS: Partial<Record<Insight["category"], string>> = {
  bottlenecks: "Constraints to watch",
  "builder-implications": "What builders can do",
  "investment-lens": "Investment view",
  "related-signals": "Related signals",
  "market-sentiment": "What the market is saying",
  "research-relevance": "Why the research matters",
  "strategic-decisions": "Decisions to consider",
};

function InsightBody({ insight, onSeek }: { insight: Insight; onSeek?: (t: number) => void }) {
  const meta = INSIGHT_CATEGORIES[insight.category];
  return (
    <div className="border-t border-ink/15 py-5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{PLAIN_LABELS[insight.category] ?? meta.label}</Badge>
      </div>
      <h4 className="mt-2.5 font-serif text-lg leading-snug">{insight.headline}</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{insight.summary}</p>
      {insight.evidence.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
          {insight.evidence.map((ev, i) => (
            <button
              key={i}
              onClick={() => onSeek?.(ev.timestamp)}
              disabled={!onSeek}
              className={cn(
                "block w-full text-left",
                onSeek && "cursor-pointer group"
              )}
            >
              <span className="flex items-baseline gap-2">
                <span className="shrink-0 font-mono text-[10px] text-[var(--ts-acc-deep)] group-hover:underline">
                  {formatTimestamp(ev.timestamp)}
                </span>
                <span className="font-mono text-xs leading-relaxed text-ink-soft">
                  “{ev.quote}”
                </span>
              </span>
              <span className="ml-10 mt-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                {EVIDENCE_KIND_LABELS[ev.kind]}
              </span>
            </button>
          ))}
        </div>
      )}
      {insight.relatedAppearanceIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 pt-3">
          {insight.relatedAppearanceIds.map((id) => (
            <Link
              key={id}
              to={`/a/${appearanceSlug(id)}`}
              className="link-sweep font-mono text-[11px] text-[var(--ts-acc-deep)]"
            >
              {appearanceTitle(id)} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightSection({
  brief,
  insights,
  onSeek,
  className,
}: {
  brief: InsightBrief;
  insights: Insight[];
  onSeek?: (t: number) => void;
  className?: string;
}) {
  const { isPro, user } = useAppState();
  const visible = displayableInsights(insights);

  /* Honest pipeline states */
  if (brief.status === "queued" || brief.status === "generating") {
    return (
      <ModuleFrame className={className}>
        <p className="font-mono text-xs text-ink-faint">
          Insight brief {brief.status === "queued" ? "queued" : "generating"} — published
          automatically once the transcript clears the pipeline.
        </p>
      </ModuleFrame>
    );
  }
  if (brief.status === "needs-review") {
    return (
      <ModuleFrame className={className}>
        <p className="font-mono text-xs text-ink-faint">
          An insight brief exists for this talk and is in editorial review. It will appear
          here once approved.
        </p>
      </ModuleFrame>
    );
  }
  if (brief.status === "no-applicable-insights" || visible.length === 0) {
    return (
      <ModuleFrame className={className}>
        <p className="font-mono text-xs text-ink-faint">
          The enrichment pass evaluated all {Object.keys(INSIGHT_CATEGORIES).length} insight
          categories and found none that meaningfully apply to this talk. We don't pad briefs.
        </p>
      </ModuleFrame>
    );
  }

  /* Pro: full brief */
  if (isPro) {
    return (
      <div className={cn("border border-[var(--ts-acc-45)] bg-[var(--ts-acc-15)] p-5 sm:p-7", className)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-soft" aria-hidden>✦</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">
            Powered by TechStage AI · {visible.length} useful {visible.length === 1 ? "area" : "areas"}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">
            model {brief.modelVersion} · reviewed{" "}
            {brief.reviewedAt ? brief.reviewedAt.slice(0, 10) : "pending"}
          </span>
        </div>
        {visible.map((i) => (
          <InsightBody key={i.id} insight={i} onSeek={onSeek} />
        ))}
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          Generated once at ingestion from the transcript; every claim cites its timestamp.
          Market-related insights summarize what was said on stage and are not investment advice.
        </p>
      </div>
    );
  }

  /* Free / signed-out: locked module with honest teasers */
  return (
    <div className={cn("glass-panel relative overflow-hidden min-h-72", className)}>
      <div className="seam absolute inset-0" aria-hidden />
      <div className="locked-veil space-y-3 p-4 sm:p-5" aria-hidden>
        {visible.slice(0, 2).map((i) => (
          <InsightBody key={i.id} insight={i} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/35 p-6 text-center backdrop-blur-md">
        <Lock className="size-4 text-ink-soft" />
        <div className="space-y-1">
          {visible.slice(0, 3).map((i) => (
            <p key={i.id} className="font-mono text-xs text-ink">
              {INSIGHT_CATEGORIES[i.category].teaser(
                i.category === "related-signals" ? i.relatedAppearanceIds.length : i.evidence.length
              )}
            </p>
          ))}
          {visible.length > 3 && (
            <p className="font-mono text-xs text-ink-faint">
              +{visible.length - 3} more {visible.length - 3 === 1 ? "category" : "categories"}
            </p>
          )}
        </div>
        <Link
          to="/subscription"
          className="border border-[var(--ts-acc)] bg-paper/85 px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--ts-acc-deep)] transition-colors hover:bg-[var(--ts-acc-15)]"
        >
          {user ? "Unlock the complete insight brief" : "Sign in to unlock insights"}
        </Link>
      </div>
    </div>
  );
}

function ModuleFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border border-dashed border-ink/25 px-4 py-5 sm:px-5", className)}>
      <div className="flex items-center gap-2 pb-2">
        <span className="font-mono text-xs text-ink-faint" aria-hidden>✦</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
          Powered by TechStage AI
        </span>
      </div>
      {children}
    </div>
  );
}
