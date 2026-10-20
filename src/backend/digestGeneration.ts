import { renderDigestEmail } from "@/backend/digestEmail";
import { sampleDigest } from "@/data/digests";
import type { DigestIssue } from "@/domain/digest";

export const DIGEST_PROMPT_VERSION = "digest-prompt-v1";
export const DIGEST_TEMPLATE_VERSION = "stage-notes-v1";
export const DIGEST_MAX_WORDS = 2_600;

export const PANEL_PROMPT = `Create a concise Stage Notes panel artifact from the supplied transcript and metadata. Attribute every factual claim to a named speaker. Never invent a quote, number, conclusion, speaker, or timestamp. Return only the requested JSON fields: what_was_said, what_it_means, where_it_lands, why_it_matters, quotes, and claims.`;

export const SYNTHESIS_PROMPT = `Synthesize only the supplied, validated panel artifacts. Do not use outside knowledge. Separate speaker claims from TechStage interpretation. Return issue_title, deck, big_picture, through_line, agreements, tensions, and watch_next; every synthesis item must carry sourcePanelIds.`;

export interface GeneratedQuote {
  text: string;
  speakerId: string;
  timestamp: number;
}

export interface PanelGenerationArtifact {
  panelId: string;
  whatWasSaid: string[];
  whatItMeans: string[];
  whereItLands: { summary: string[]; useCases: string[] };
  whyItMatters: string[];
  quotes: GeneratedQuote[];
}

export interface DigestGateResult {
  gate: "quote-verbatim" | "source-links" | "images" | "word-count" | "banned-phrases" | "heading-order" | "email-size";
  passed: boolean;
  detail: string;
}

const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();

export function quoteAppearsVerbatim(quote: string, transcript: string): boolean {
  return quote.trim().length > 0 && normalize(transcript).includes(normalize(quote));
}

export function validatePanelQuotes(artifact: PanelGenerationArtifact, transcript: string): DigestGateResult {
  const invalid = artifact.quotes.filter((quote) => !quoteAppearsVerbatim(quote.text, transcript));
  return {
    gate: "quote-verbatim",
    passed: invalid.length === 0,
    detail: invalid.length ? `${invalid.length} quote(s) do not appear verbatim in the transcript` : `${artifact.quotes.length} quote(s) matched`,
  };
}

const countWords = (issue: DigestIssue) => {
  const values = [issue.title, issue.deck, issue.bigPicture, ...issue.throughLine, ...issue.agreements, ...issue.tensions];
  issue.panels.forEach((panel) => panel.sections.forEach((section) => values.push(...section.paragraphs)));
  return values.join(" ").trim().split(/\s+/).filter(Boolean).length;
};

const BANNED_PHRASES = ["game-changing", "revolutionary breakthrough", "unprecedented paradigm shift", "must-see"];
const LOCKED_HEADINGS = ["What was said", "What it means", "Where it lands", "Why it matters to you"];

export function validateDigestIssue(issue: DigestIssue, options: { allowImagePlaceholders?: boolean } = {}): DigestGateResult[] {
  const words = countWords(issue);
  const allText = normalize(JSON.stringify(issue));
  const badPhrases = BANNED_PHRASES.filter((phrase) => allText.includes(phrase));
  const headingsValid = issue.panels.every((panel) => panel.sections.map((section) => section.label).join("|") === LOCKED_HEADINGS.join("|"));
  const sourcesValid = issue.panels.every((panel) => {
    try { return new URL(panel.source.url).protocol === "https:"; } catch { return false; }
  });
  const imagesValid = options.allowImagePlaceholders || issue.panels.every((panel) => Boolean(panel.imageUrl && panel.imageAlt && panel.imageCredit));
  let emailSizePassed = true;
  let emailDetail = "Email is below 102 KB";
  try { renderDigestEmail(issue); } catch (error) { emailSizePassed = false; emailDetail = error instanceof Error ? error.message : "Email render failed"; }
  return [
    { gate: "source-links", passed: sourcesValid, detail: sourcesValid ? "Every panel has an HTTPS official source" : "A panel is missing a valid HTTPS source" },
    { gate: "images", passed: imagesValid, detail: imagesValid ? "Every panel has approved imagery or an allowed local placeholder" : "Approved panel imagery is required" },
    { gate: "word-count", passed: words <= DIGEST_MAX_WORDS, detail: `${words}/${DIGEST_MAX_WORDS} words` },
    { gate: "banned-phrases", passed: badPhrases.length === 0, detail: badPhrases.length ? `Blocked: ${badPhrases.join(", ")}` : "No banned hype phrases" },
    { gate: "heading-order", passed: headingsValid, detail: headingsValid ? "Locked section order is intact" : "Panel section order changed" },
    { gate: "email-size", passed: emailSizePassed, detail: emailDetail },
  ];
}

export function deterministicDigestDryRun(): { issue: DigestIssue; gates: DigestGateResult[] } {
  const issue: DigestIssue = { ...sampleDigest, status: "needs_review", panels: sampleDigest.panels.map((panel) => ({ ...panel, sections: panel.sections.map((section) => ({ ...section, paragraphs: [...section.paragraphs] })) })) };
  return { issue, gates: validateDigestIssue(issue, { allowImagePlaceholders: true }) };
}

