import type {
  AIBriefItem,
  AIBriefSection,
  Appearance,
  BriefRecord,
  Insight,
  InsightCategory,
  Transcript,
  AnalysisArtifact,
} from "@/domain/types";
import { formatTimestamp } from "@/lib/format";

export const AI_BRIEF_PROMPT_VERSION = "brief-v3";

/* Reading order: Main takeaways always opens the dossier, Bottlenecks
   always follows — both are guaranteed for every talk. Premium
   sections are numbered sequentially after them. */
const sectionSpecs: Array<{
  id: AIBriefSection["id"];
  number: AIBriefSection["number"];
  title: string;
  tier: AIBriefSection["tier"];
  categories?: InsightCategory[];
}> = [
  { id: "main-takeaways", number: 1, title: "Main takeaways", tier: "free" },
  { id: "bottlenecks", number: 2, title: "Bottlenecks", tier: "free", categories: ["bottlenecks"] },
  { id: "investing-edge", number: 3, title: "Investing edge", tier: "pro", categories: ["investment-lens", "competitive-intelligence", "product-timing"] },
  { id: "career-advantage", number: 4, title: "Career advantage", tier: "pro", categories: ["career-signals", "recruiting-relevance", "networking-prep", "builder-implications"] },
  { id: "founder-strategy", number: 5, title: "Founder & startup strategy", tier: "pro", categories: ["builder-implications", "strategic-decisions", "product-timing", "competitive-intelligence"] },
  { id: "research-inspiration", number: 6, title: "Research & trending-topic inspiration", tier: "pro", categories: ["research-relevance", "emerging-narratives", "open-source-implications", "news-context", "related-signals", "builder-implications"] },
  { id: "market-sentiment", number: 7, title: "Market sentiment & reaction", tier: "pro", categories: ["market-sentiment", "investment-lens", "competitive-intelligence", "emerging-narratives", "product-timing"] },
  { id: "industry-effects", number: 8, title: "Effects on other companies & industries", tier: "pro", categories: ["competitive-intelligence", "related-signals", "open-source-implications", "emerging-narratives", "investment-lens", "builder-implications", "product-timing"] },
];

const toItem = (insight: Insight): AIBriefItem => {
  const evidence = insight.evidence[0] ?? null;
  return {
    id: insight.id,
    headline: insight.headline,
    summary: insight.summary,
    timestamp: evidence?.timestamp ?? null,
    quote: evidence?.quote ?? null,
    evidenceKind: evidence?.kind ?? null,
    relatedCompanyIds: insight.relatedCompanyIds,
  };
};

function uniqueInsights(rows: Insight[]) {
  return rows.filter((row, index) => rows.findIndex((candidate) => candidate.id === row.id) === index);
}

export function assembleBriefRecord(
  appearance: Appearance,
  transcript: Transcript | null,
  insights: Insight[]
): BriefRecord {
  const applicable = insights
    .filter((insight) => insight.isApplicable && insight.confidence >= 0.65 && insight.evidence.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sections = sectionSpecs.map((spec): AIBriefSection => {
    if (spec.id === "main-takeaways") {
      const summaryItem: AIBriefItem[] = appearance.basicSummary || appearance.description
        ? [{
            id: `${appearance.id}-overview`,
            headline: "The talk in one clear read",
            summary: appearance.basicSummary ?? appearance.description,
            timestamp: transcript?.segments[0]?.startTime ?? null,
            quote: null,
            evidenceKind: "summary",
            relatedCompanyIds: appearance.companyIds,
          }]
        : [];
      return {
        ...spec,
        items: [...summaryItem, ...uniqueInsights(applicable.filter((row) => row.category !== "bottlenecks")).slice(0, 3).map(toItem)],
      };
    }
    const categories = spec.categories ?? [];
    const items = uniqueInsights(applicable.filter((row) => categories.includes(row.category))).map(toItem);
    /* Bottlenecks is a guaranteed section: when the transcript names no
       explicit constraint, surface the open questions the talk leaves. */
    if (spec.id === "bottlenecks" && items.length === 0) {
      return {
        ...spec,
        items: [{
          id: `${appearance.id}-open-questions`,
          headline: "the claims here survive contact with reality",
          summary: `No hard constraint was named on stage, so the open question is execution: ${appearance.basicSummary ?? appearance.description} Watch the related appearances to see whether the follow-through matches the framing.`,
          timestamp: transcript?.segments.at(-1)?.startTime ?? null,
          quote: null,
          evidenceKind: "cautious-inference",
          relatedCompanyIds: appearance.companyIds,
        }],
      };
    }
    return { ...spec, items };
  });

  const markdown = briefToMarkdown(appearance.title, sections);
  return {
    appearanceId: appearance.id,
    promptVersion: AI_BRIEF_PROMPT_VERSION,
    model: "TechStage enrichment · seed preview",
    sections,
    markdown,
    createdAt: new Date().toISOString(),
  };
}

/** Builds the viewer dossier from the one persisted analysis artifact. No per-user model call occurs. */
export function assembleStoredBriefRecord(appearance: Appearance, artifact: AnalysisArtifact): BriefRecord {
  const evidenceItems: AIBriefItem[] = artifact.evidence.filter((row) => row.excerpt).map((row, index) => ({
    id: `${artifact.id}-evidence-${index}`,
    headline: row.kind === "direct-statement" ? "What was said" : row.kind === "model-interpretation" ? "What the analysis finds" : "What it means",
    summary: row.excerpt,
    timestamp: row.timestampSeconds,
    quote: row.kind === "direct-statement" ? row.excerpt : null,
    evidenceKind: row.kind,
    relatedCompanyIds: appearance.companyIds,
  }));
  const topicItems: AIBriefItem[] = artifact.topics.slice(0, 5).map((topic, index) => ({
    id: `${artifact.id}-topic-${index}`, headline: topic, summary: `This theme is materially present in the stored analysis of the talk.`, timestamp: null, quote: null, evidenceKind: "summary", relatedCompanyIds: appearance.companyIds,
  }));
  const summary: AIBriefItem = { id: `${artifact.id}-summary`, headline: "The talk in one clear read", summary: artifact.summary, timestamp: evidenceItems[0]?.timestamp ?? null, quote: null, evidenceKind: "summary", relatedCompanyIds: appearance.companyIds };
  const sections: AIBriefSection[] = sectionSpecs.map((spec) => {
    if (spec.id === "main-takeaways") return { ...spec, items: [summary, ...evidenceItems.slice(0, 3)] };
    if (spec.id === "bottlenecks") {
      const constraints = evidenceItems.filter((item) => item.evidenceKind === "cautious-inference" || item.evidenceKind === "model-interpretation").slice(0, 3);
      return { ...spec, items: constraints.length ? constraints : [{ ...summary, id: `${artifact.id}-execution`, headline: "The execution question", summary: `The stored analysis identifies the direction clearly; the open question is how the claims translate into durable execution. ${artifact.summary}` }] };
    }
    const offset = (spec.number - 3) % Math.max(1, evidenceItems.length || topicItems.length);
    return { ...spec, items: [...evidenceItems.slice(offset, offset + 2), ...topicItems.slice(0, 1)] };
  });
  return { appearanceId: appearance.id, promptVersion: "stored-analysis-v1", model: artifact.model, sections, markdown: briefToMarkdown(appearance.title, sections), createdAt: artifact.generatedAt };
}

export function briefToMarkdown(title: string, sections: AIBriefSection[]) {
  const body = sections.map((section) => {
    const items = section.items.length
      ? section.items.map((item) => `- **${item.headline}**${item.timestamp != null ? ` (${formatTimestamp(item.timestamp)})` : ""}\n  ${item.summary}`).join("\n")
      : "- No strong signal detected in the transcript.";
    return `## ${String(section.number).padStart(2, "0")} · ${section.title}\n\n${items}`;
  }).join("\n\n");
  return `# TechStage AI Brief\n\n## ${title}\n\n${body}\n\n---\nGenerated from the verified transcript. Every interpretive claim should be read with its cited timestamp.`;
}
