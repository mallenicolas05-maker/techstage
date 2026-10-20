import { describe, expect, it } from "vitest";
import { DIGEST_EMAIL_MAX_BYTES, digestEmailHeaders, renderDigestEmail } from "@/backend/digestEmail";
import { sampleDigest } from "@/data/digests";

describe("Stage Notes email", () => {
  it("renders the locked editorial sections with official sources", () => {
    const html = renderDigestEmail(sampleDigest);
    expect(html).toContain("What was said");
    expect(html).toContain("What it means");
    expect(html).toContain("Where it lands");
    expect(html).toContain("Why it matters to you");
    expect(html).toContain("https://developer.apple.com/videos/play/wwdc2026/101/");
  });

  it("stays below the conservative 102 KB delivery ceiling", () => {
    const bytes = new TextEncoder().encode(renderDigestEmail(sampleDigest)).length;
    expect(bytes).toBeLessThan(DIGEST_EMAIL_MAX_BYTES);
  });

  it("escapes editorial input", () => {
    const html = renderDigestEmail({ ...sampleDigest, title: "Systems <script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("provides one-click unsubscribe headers", () => {
    expect(digestEmailHeaders("https://techstage.com/notes/preferences?token=safe")).toEqual({
      "List-Unsubscribe": "<https://techstage.com/notes/preferences?token=safe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});
