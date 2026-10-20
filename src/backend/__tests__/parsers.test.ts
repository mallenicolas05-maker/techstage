import { describe, expect, it } from "vitest";
import { parseEventPageText, parseXDump, sanitizeEvidenceExcerpt } from "@/backend/parsers";

describe("ephemeral manual parsers", () => {
  it("deduplicates copied X status links and identifies likely panels", () => {
    const raw = `CEO fireside chat at the AI summit\nhttps://x.com/example/status/123\n\nCEO fireside chat at the AI summit\nhttps://x.com/example/status/123`;
    const rows = parseXDump(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].likelyRelevant).toBe(true);
    expect(rows[0].sourceUrl).toContain("x.com/example/status/123");
  });

  it("extracts only event-like lines", () => {
    const rows = parseEventPageText("Registration opens\n10:00 CEO panel on infrastructure\nLunch break\n14:00 Technical talk: resilient agents");
    expect(rows.map((row) => row.title)).toEqual(["10:00 CEO panel on infrastructure", "14:00 Technical talk: resilient agents"]);
  });

  it("strictly bounds evidence excerpts", () => {
    expect(sanitizeEvidenceExcerpt("x".repeat(500))).toHaveLength(280);
  });
});

