import { describe, expect, it } from "vitest";
import { extractJsonLdEvents, parseICalendar, parseRssItems } from "@/backend/eventFeeds";

describe("official event feeds", () => {
  it("extracts official JSON-LD event records", () => {
    const html = `<script type="application/ld+json">{"@type":"Event","name":"AI Summit","startDate":"2026-08-01","url":"https://example.com/ai"}</script>`;
    expect(extractJsonLdEvents(html)[0].title).toBe("AI Summit");
  });

  it("parses iCal and RSS without fetching", () => {
    expect(parseICalendar("BEGIN:VEVENT\nSUMMARY:CEO Panel\nDTSTART:20260801T100000Z\nEND:VEVENT")[0].title).toBe("CEO Panel");
    expect(parseRssItems("<rss><item><title>Keynote</title><link>https://example.com/k</link></item></rss>")[0].url).toBe("https://example.com/k");
  });
});

