export interface EventFeedItem {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  url: string | null;
  speakers: string[];
  sourceFormat: "json-ld" | "ical" | "rss";
}

export function extractJsonLdEvents(html: string): EventFeedItem[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const items: EventFeedItem[] = [];
  for (const match of scripts) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      const nodes = flattenJsonLd(parsed);
      for (const node of nodes) {
        const type = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (!type.some((value) => value === "Event" || value === "EducationEvent" || value === "BusinessEvent")) continue;
        items.push({
          title: String(node.name ?? "Untitled event").slice(0, 500),
          startsAt: typeof node.startDate === "string" ? node.startDate : null,
          endsAt: typeof node.endDate === "string" ? node.endDate : null,
          url: typeof node.url === "string" ? node.url : null,
          speakers: extractPeople(node.performer ?? node.actor),
          sourceFormat: "json-ld",
        });
      }
    } catch {
      // Invalid JSON-LD is ignored; an official-feed fallback or manual paste can handle the page.
    }
  }
  return items;
}

export function parseICalendar(value: string): EventFeedItem[] {
  const unfolded = value.replace(/\r?\n[ \t]/g, "");
  return [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map((match) => {
    const field = (name: string) => match[1].match(new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:(.*)`, "i"))?.[1]?.trim() ?? null;
    return { title: field("SUMMARY") ?? "Untitled event", startsAt: field("DTSTART"), endsAt: field("DTEND"), url: field("URL"), speakers: [], sourceFormat: "ical" as const };
  });
}

export function parseRssItems(xml: string): EventFeedItem[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => ({
    title: xmlValue(match[1], "title") ?? "Untitled item",
    startsAt: xmlValue(match[1], "pubDate"),
    endsAt: null,
    url: xmlValue(match[1], "link"),
    speakers: [],
    sourceFormat: "rss" as const,
  }));
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = Array.isArray(record["@graph"]) ? record["@graph"].flatMap(flattenJsonLd) : [];
  return [record, ...graph];
}

function extractPeople(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((entry) => typeof entry === "string" ? entry : typeof entry === "object" && entry ? String((entry as Record<string, unknown>).name ?? "") : "").filter(Boolean);
}

function xmlValue(xml: string, tag: string): string | null {
  return xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"))?.[1]?.trim() ?? null;
}

