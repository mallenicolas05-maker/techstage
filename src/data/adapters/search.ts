import { catalogRepo } from "@/data/repositories/local";
import type { Appearance } from "@/domain/types";
import type {
  SearchAdapter,
  SearchFilters,
  SearchHit,
  SearchQuery,
} from "@/data/repositories/contracts";

const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
const passes = (a: Appearance, f: SearchFilters) => {
  if (f.topicIds?.length && !a.topicIds.some((id) => f.topicIds!.includes(id)))
    return false;
  if (
    f.speakerIds?.length &&
    !a.speakerIds.some((id) => f.speakerIds!.includes(id))
  )
    return false;
  if (
    f.companyIds?.length &&
    !a.companyIds.some((id) => f.companyIds!.includes(id))
  )
    return false;
  if (f.eventIds?.length && !f.eventIds.includes(a.eventId ?? "")) return false;
  if (
    f.appearanceTypes?.length &&
    !f.appearanceTypes.includes(a.appearanceType)
  )
    return false;
  if (f.dateFrom && a.scheduledStart < f.dateFrom) return false;
  if (f.dateTo && a.scheduledStart > `${f.dateTo}T23:59:59Z`) return false;
  if (f.maxDurationSeconds && (a.durationSeconds ?? 0) > f.maxDurationSeconds)
    return false;
  if (f.hasRecording && a.recordingAvailability !== "available") return false;
  if (f.verifiedOnly && a.verificationStatus !== "verified") return false;
  return true;
};

class LiveSearchAdapter implements SearchAdapter {
  async search(query: SearchQuery): Promise<SearchHit[]> {
    const [appearances, speakers, companies, events, topics] =
      await Promise.all([
        catalogRepo.listAppearances(),
        catalogRepo.listSpeakers(),
        catalogRepo.listCompanies(),
        catalogRepo.listEvents(),
        catalogRepo.listTopics(),
      ]);
    const [clips, moments] = query.text.trim()
      ? await Promise.all([
          catalogRepo.listClips(),
          catalogRepo.listStandoutMoments(),
        ])
      : [[], []];
    const terms = words(query.text);
    const filters = query.filters ?? {};
    const hits: SearchHit[] = [];
    const score = (primary: string, secondary = "") => {
      if (!terms.length) return 1;
      const all = `${primary} ${secondary}`.toLowerCase();
      const main = primary.toLowerCase();
      const value = terms.reduce(
        (total, term) =>
          total + (main.includes(term) ? 3 : 0) + (all.includes(term) ? 1 : 0),
        0,
      );
      return value;
    };
    for (const row of appearances.filter((item) => passes(item, filters))) {
      const value = score(
        row.title,
        `${row.description} ${row.basicSummary ?? ""}`,
      );
      if (value)
        hits.push({
          kind: "appearance",
          id: row.id,
          appearanceId: row.id,
          score: value,
        });
    }
    const entityRows = [
      ...speakers.map((row) => ({
        kind: "speaker" as const,
        id: row.id,
        primary: row.name,
        secondary: `${row.headline} ${row.biography}`,
      })),
      ...companies.map((row) => ({
        kind: "company" as const,
        id: row.id,
        primary: row.name,
        secondary: row.description,
      })),
      ...events.map((row) => ({
        kind: "event" as const,
        id: row.id,
        primary: row.title,
        secondary: `${row.organizer} ${row.description}`,
      })),
      ...topics.map((row) => ({
        kind: "topic" as const,
        id: row.id,
        primary: row.name,
        secondary: row.description,
      })),
    ];
    for (const row of entityRows) {
      const value = score(row.primary, row.secondary);
      if (value) hits.push({ kind: row.kind, id: row.id, score: value });
    }
    for (const row of clips) {
      const value = score(row.title, row.description);
      if (value)
        hits.push({
          kind: "clip",
          id: row.id,
          appearanceId: row.appearanceId,
          timestamp: row.startTime,
          score: value,
        });
    }
    for (const row of moments) {
      const value = score(row.title, row.description);
      if (value)
        hits.push({
          kind: "moment",
          id: row.id,
          appearanceId: row.appearanceId,
          timestamp: row.startTime,
          score: value,
        });
    }
    const byId = new Map(appearances.map((row) => [row.id, row]));
    hits.sort((left, right) =>
      query.sort === "newest"
        ? (
            byId.get(right.appearanceId ?? "")?.scheduledStart ?? ""
          ).localeCompare(
            byId.get(left.appearanceId ?? "")?.scheduledStart ?? "",
          )
        : query.sort === "oldest"
          ? (
              byId.get(left.appearanceId ?? "")?.scheduledStart ?? ""
            ).localeCompare(
              byId.get(right.appearanceId ?? "")?.scheduledStart ?? "",
            )
          : query.sort === "popularity"
            ? (byId.get(right.appearanceId ?? "")?.popularityScore ?? 0) -
              (byId.get(left.appearanceId ?? "")?.popularityScore ?? 0)
            : right.score - left.score,
    );
    return hits.slice(0, query.limit ?? 80);
  }
  async suggest(prefix: string, limit: number) {
    const [speakers, companies, events, topics] = await Promise.all([
      catalogRepo.listSpeakers(),
      catalogRepo.listCompanies(),
      catalogRepo.listEvents(),
      catalogRepo.listTopics(),
    ]);
    const value = prefix.toLowerCase();
    return [
      ...speakers.map((row) => row.name),
      ...companies.map((row) => row.name),
      ...events.map((row) => row.title),
      ...topics.map((row) => row.name),
    ]
      .filter((name) => name.toLowerCase().includes(value))
      .slice(0, limit);
  }
}

export const searchAdapter: SearchAdapter = new LiveSearchAdapter();
