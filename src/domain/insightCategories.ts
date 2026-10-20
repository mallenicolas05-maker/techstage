import type { InsightCategory } from "./types";

/* Registry of premium insight categories. The enrichment
   pipeline evaluates all of these per transcript and stores
   only the applicable ones. The UI never forces a category
   onto an appearance — it renders whatever the brief contains. */

export interface InsightCategoryMeta {
  category: InsightCategory;
  label: string;
  /** Short label used in locked-state teasers, e.g. "5 bottlenecks identified" */
  teaser: (count: number) => string;
  description: string;
}

export const INSIGHT_CATEGORIES: Record<InsightCategory, InsightCategoryMeta> = {
  "investment-lens": {
    category: "investment-lens",
    label: "Investing edge",
    teaser: (n) => `${n} investment ${n === 1 ? "angle" : "angles"} identified`,
    description: "What this talk suggests for capital allocation themes. Not financial advice.",
  },
  "market-sentiment": {
    category: "market-sentiment",
    label: "Market sentiment & reaction",
    teaser: (n) => `${n} market ${n === 1 ? "implication" : "implications"} available`,
    description: "Directional reads on markets and demand expressed or implied by the speaker.",
  },
  bottlenecks: {
    category: "bottlenecks",
    label: "Bottlenecks",
    teaser: (n) => `${n} ${n === 1 ? "bottleneck" : "bottlenecks"} identified`,
    description: "Constraints the speaker names: compute, power, data, talent, supply.",
  },
  "builder-implications": {
    category: "builder-implications",
    label: "Founder & startup strategy",
    teaser: (n) => `${n} builder ${n === 1 ? "implication" : "implications"}`,
    description: "What founders and engineers can act on from this appearance.",
  },
  "career-signals": {
    category: "career-signals",
    label: "Career advantage",
    teaser: () => "Career signals available",
    description: "Hiring themes, skill demand, and role shifts referenced in the talk.",
  },
  "competitive-intelligence": {
    category: "competitive-intelligence",
    label: "Effects on other companies & industries",
    teaser: (n) => `${n} competitive ${n === 1 ? "note" : "notes"}`,
    description: "Positioning against named or implied competitors.",
  },
  "research-relevance": {
    category: "research-relevance",
    label: "Research & trending-topic inspiration",
    teaser: (n) => `${n} research ${n === 1 ? "connection" : "connections"}`,
    description: "Papers, benchmarks, and open problems the talk touches.",
  },
  "content-angles": {
    category: "content-angles",
    label: "Content angles",
    teaser: (n) => `${n} content ${n === 1 ? "angle" : "angles"}`,
    description: "Story angles for writers and analysts covering this appearance.",
  },
  "networking-prep": {
    category: "networking-prep",
    label: "Networking prep",
    teaser: () => "Networking preparation available",
    description: "Conversation starters and context if you'll meet this speaker.",
  },
  "recruiting-relevance": {
    category: "recruiting-relevance",
    label: "Interview & recruiting",
    teaser: () => "Recruiting relevance available",
    description: "Useful context for interviews at or with the companies discussed.",
  },
  "product-timing": {
    category: "product-timing",
    label: "Product timing",
    teaser: (n) => `${n} timing ${n === 1 ? "signal" : "signals"}`,
    description: "Stated or implied timelines for launches and capabilities.",
  },
  "emerging-narratives": {
    category: "emerging-narratives",
    label: "Emerging narratives",
    teaser: (n) => `${n} emerging ${n === 1 ? "narrative" : "narratives"}`,
    description: "New framings that may become industry consensus.",
  },
  "news-context": {
    category: "news-context",
    label: "News context",
    teaser: () => "News context available",
    description: "How this appearance connects to current developments.",
  },
  "open-source-implications": {
    category: "open-source-implications",
    label: "Open-source implications",
    teaser: (n) => `${n} open-source ${n === 1 ? "implication" : "implications"}`,
    description: "Effects on open models, licenses, and community projects.",
  },
  "strategic-decisions": {
    category: "strategic-decisions",
    label: "Strategic decision support",
    teaser: (n) => `${n} strategic ${n === 1 ? "consideration" : "considerations"}`,
    description: "Inputs for build/buy/wait decisions raised by the talk.",
  },
  "related-signals": {
    category: "related-signals",
    label: "Related signals",
    teaser: (n) => `Related signals detected across ${n} other ${n === 1 ? "talk" : "talks"}`,
    description: "Cross-references where other speakers address the same claim.",
  },
  "watch-next": {
    category: "watch-next",
    label: "What to watch next",
    teaser: (n) => `${n} follow-up ${n === 1 ? "recommendation" : "recommendations"}`,
    description: "The most useful appearances to watch after this one.",
  },
};

/* Configurable enrichment thresholds — seed values, not business decisions. */
export const ENRICHMENT_CONFIG = {
  /** Insights below this confidence are stored but never displayed. */
  displayConfidenceThreshold: 0.65,
  /** An insight must cite at least this many transcript evidence entries. */
  minEvidenceCount: 1,
  modelVersion: "enrich-2026-06",
};

export function categoryLabel(category: InsightCategory): string {
  return INSIGHT_CATEGORIES[category].label;
}
