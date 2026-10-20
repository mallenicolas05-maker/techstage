import { describe, expect, it } from "vitest";
import { extractOfficialAssetCandidates } from "@/backend/assets";

describe("official asset extraction", () => {
  it("collects official logos and images without generating replacements", () => {
    const html = `<meta property="og:image" content="/press/hero.jpg"><script type="application/ld+json">{"@type":"Organization","logo":{"url":"https://example.com/logo.svg"}}</script>`;
    const rows = extractOfficialAssetCandidates({ html, pageUrl: "https://example.com/about", entityType: "company", entityId: "company-1" });
    expect(rows.map((row) => row.sourceUrl)).toEqual(["https://example.com/press/hero.jpg", "https://example.com/logo.svg"]);
    expect(rows[1].transparentBackground).toBe(true);
    expect(rows.every((row) => row.status === "candidate")).toBe(true);
  });

  it("rejects LinkedIn and X speaker images", () => {
    const html = `<meta property="og:image" content="https://linkedin.com/photo.jpg"><link rel="icon" href="/speaker.png">`;
    const rows = extractOfficialAssetCandidates({ html, pageUrl: "https://speaker.example.com", entityType: "speaker", entityId: "speaker-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceUrl).toContain("speaker.example.com/speaker.png");
  });
});
