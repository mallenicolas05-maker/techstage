export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "appearanceType", "speakerNames", "companyNames", "eventName", "topics", "chapters", "highlights", "evidence", "confidence"],
  properties: {
    summary: { type: "string", maxLength: 2400 },
    appearanceType: { type: "string", enum: ["panel", "interview", "product-launch", "technical-talk", "podcast", "livestream"] },
    speakerNames: { type: "array", maxItems: 20, items: { type: "string" } },
    companyNames: { type: "array", maxItems: 20, items: { type: "string" } },
    eventName: { anyOf: [{ type: "string" }, { type: "null" }] },
    topics: { type: "array", maxItems: 15, items: { type: "string" } },
    chapters: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["title", "summary", "startSeconds", "endSeconds", "kind"], properties: {
      title: { type: "string" }, summary: { type: "string" }, startSeconds: { anyOf: [{ type: "integer" }, { type: "null" }] },
      endSeconds: { anyOf: [{ type: "integer" }, { type: "null" }] }, kind: { type: "string" },
    } } },
    highlights: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "summary", "startSeconds", "endSeconds", "kind"], properties: {
      title: { type: "string" }, summary: { type: "string" }, startSeconds: { anyOf: [{ type: "integer" }, { type: "null" }] },
      endSeconds: { anyOf: [{ type: "integer" }, { type: "null" }] }, kind: { type: "string" },
    } } },
    evidence: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["excerpt", "timestampSeconds", "confidence", "kind"], properties: {
      excerpt: { type: "string" }, timestampSeconds: { anyOf: [{ type: "integer" }, { type: "null" }] },
      confidence: { type: "number" }, kind: { type: "string" },
    } } },
    confidence: { type: "number" },
  },
} as const;

/**
 * Gemini structured output accepts a useful subset of JSON Schema. Keep the
 * full strict schema for our own validation, but remove unsupported keywords
 * and express nullable values in Gemini's native shape before the request.
 */
export function toGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiResponseSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const alternatives = Array.isArray(source.anyOf) ? source.anyOf : [];
  const nullable = alternatives.length
    ? alternatives.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).type !== "null")
    : null;
  if (nullable && alternatives.some((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "null")) {
    return { ...(toGeminiResponseSchema(nullable) as Record<string, unknown>), nullable: true };
  }

  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => key !== "additionalProperties" && key !== "$schema")
      .map(([key, item]) => [key, toGeminiResponseSchema(item)]),
  );
}

export const analysisPrompt = (route: "pasted-transcript" | "youtube-video" | "x-video") => `
You are producing one evidence-bounded TechStage analysis for an editorial catalog.
Return only JSON matching the supplied schema. Extract only claims supported by the provided source.
Do not use outside knowledge. Never invent a quotation, number, speaker, company, event, topic, or timestamp.
Classify evidence.kind as direct-statement, summary, cautious-inference, or model-interpretation.
Keep evidence excerpts under 280 characters. A direct-statement excerpt must be verbatim.
Produce a concise summary, up to 8 useful chapters, up to 5 standout highlights, and up to 8 evidence rows.
${route === "pasted-transcript" ? "Use timestamps only when the transcript contains reliable timecodes." : "Use 4-5 timestamped moments when the media supplies reliable timing."}
${route === "x-video" ? "X video timestamps are not reliable for clipping; return null startSeconds and endSeconds." : "Do not guess missing timing."}
`.trim();

export const DIGEST_SCHEMA = {
  type: "object",
  required: ["title", "deck", "bigPicture", "throughLine", "agreements", "tensions", "watchNext", "panels"],
  properties: {
    title: { type: "string" }, deck: { type: "string" }, bigPicture: { type: "string" },
    throughLine: { type: "array", items: { type: "string" } }, agreements: { type: "array", items: { type: "string" } },
    tensions: { type: "array", items: { type: "string" } }, watchNext: { type: "array", items: { type: "string" } },
    panels: { type: "array", items: { type: "object", required: ["appearanceId", "whatWasSaid", "whatItMeans", "whereItLands", "whyItMattersToYou"], properties: {
      appearanceId: { type: "string" }, whatWasSaid: { type: "string" }, whatItMeans: { type: "string" },
      whereItLands: { type: "string" }, whyItMattersToYou: { type: "string" },
    } } },
  },
} as const;

export const DIGEST_PROMPT = `
Synthesize exactly four validated TechStage analysis artifacts into one Stage Notes issue.
Use only the supplied summaries and evidence. Do not use outside knowledge, raw media, or unstated facts.
Do not invent quotations or numbers. Attach every panel section to its supplied appearanceId.
Use the exact editorial headings: What was said; What it means; Where it lands; Why it matters to you.
Also produce a concise title, deck, big picture, through-line, agreements, tensions, and what to watch next.
Return only JSON matching the supplied schema. Keep the total issue below 2,600 words.
`.trim();
