import type {
  Appearance,
  AppNotification,
  Chapter,
  Clip,
  Company,
  Event,
  IngestionCandidate,
  IngestionStatus,
  Insight,
  InsightBrief,
  MediaSource,
  PlanConfig,
  Speaker,
  StandoutMoment,
  Topic,
  Transcript,
  User,
  ViewingProgress,
} from "@/domain/types";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { realCompanyIds, realEventIds, realSpeakerIds } from "@/data/seed/catalogScope";
import { seedAppearances as realSeedAppearances } from "@/data/seed/realCatalog";
import type {
  CatalogRepository,
  EnrichmentAdapter,
  IngestionAdapter,
  UserRepository,
} from "./contracts";
import { CLIENT_RUNTIME_CONFIG } from "@/backend/config";
import { createSupabaseRepositories, SupabaseCatalogRepository } from "./supabase";

/* Local seed repository. Simulates a small network latency so
   loading skeletons are real, and keeps admin mutations in memory
   for the session. Production replaces this file with an HTTP/
   Postgres adapter implementing the same contracts. */

const LATENCY_MS = 220;
const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS + Math.random() * 120));

/** Demo clock — seed content lives around 2026-07-10. */
export const DEMO_NOW = new Date("2026-07-10T12:00:00Z");

const db = getSeedDb();

const findByIdOrSlug = <T extends { id: string; slug?: string }>(
  rows: T[],
  idOrSlug: string
): T | null =>
  rows.find((r) => r.id === idOrSlug || ("slug" in r && r.slug === idOrSlug)) ?? null;

const pick = <T extends { id: string }>(rows: T[], ids?: string[]): T[] =>
  ids ? (ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as T[]) : rows;

const isUpcoming = (a: Appearance) =>
  a.status === "upcoming" || a.status === "live" || a.status === "rescheduled";

class LocalCatalogRepository implements CatalogRepository {
  getAppearance(idOrSlug: string): Promise<Appearance | null> {
    return delay(findByIdOrSlug(db.appearances, idOrSlug));
  }
  listAppearances(ids?: string[]): Promise<Appearance[]> {
    return delay(pick(db.appearances, ids));
  }
  getSpeaker(idOrSlug: string): Promise<Speaker | null> {
    return delay(findByIdOrSlug(db.speakers, idOrSlug));
  }
  listSpeakers(ids?: string[]): Promise<Speaker[]> {
    return delay(ids ? pick(db.speakers, ids) : db.speakers.filter((row) => realSpeakerIds.has(row.id)));
  }
  getCompany(idOrSlug: string): Promise<Company | null> {
    return delay(findByIdOrSlug(db.companies, idOrSlug));
  }
  listCompanies(ids?: string[]): Promise<Company[]> {
    return delay(ids ? pick(db.companies, ids) : db.companies.filter((row) => realCompanyIds.has(row.id)));
  }
  getEvent(idOrSlug: string): Promise<Event | null> {
    return delay(findByIdOrSlug(db.events, idOrSlug));
  }
  listEvents(ids?: string[]): Promise<Event[]> {
    return delay(ids ? pick(db.events, ids) : db.events.filter((row) => realEventIds.has(row.id)));
  }
  getTopic(idOrSlug: string): Promise<Topic | null> {
    return delay(findByIdOrSlug(db.topics, idOrSlug));
  }
  listTopics(ids?: string[]): Promise<Topic[]> {
    return delay(pick(db.topics, ids));
  }
  listClips(ids?: string[]): Promise<Clip[]> {
    return delay(pick(db.clips, ids));
  }
  listClipsForAppearance(appearanceId: string): Promise<Clip[]> {
    return delay(db.clips.filter((c) => c.appearanceId === appearanceId));
  }
  listStandoutMoments(ids?: string[]): Promise<StandoutMoment[]> {
    return delay(pick(db.standoutMoments, ids));
  }
  listStandoutMomentsForAppearance(appearanceId: string): Promise<StandoutMoment[]> {
    return delay(db.standoutMoments.filter((moment) => moment.appearanceId === appearanceId));
  }
  getTranscript(id: string): Promise<Transcript | null> {
    return delay(db.transcripts.find((t) => t.id === id) ?? null);
  }
  listChaptersForAppearance(appearanceId: string): Promise<Chapter[]> {
    return delay(db.chapters.filter((c) => c.appearanceId === appearanceId));
  }
  getMediaSource(id: string): Promise<MediaSource | null> {
    return delay(db.mediaSources.find((m) => m.id === id) ?? null);
  }
  getInsightBrief(id: string): Promise<InsightBrief | null> {
    return delay(db.insightBriefs.find((b) => b.id === id) ?? null);
  }
  listInsightsForBrief(briefId: string): Promise<Insight[]> {
    return delay(
      db.insights
        .filter((i) => i.insightBriefId === briefId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }
  latestAppearances(limit: number): Promise<Appearance[]> {
    return delay(
      db.appearances
        .filter((a) => a.status === "recorded" && a.publishedAt)
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
        .slice(0, limit)
    );
  }
  trendingAppearances(limit: number): Promise<Appearance[]> {
    return delay(
      db.appearances
        .filter((a) => a.status === "recorded")
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, limit)
    );
  }
  upcomingAppearances(limit?: number): Promise<Appearance[]> {
    const rows = db.appearances
      .filter((a) => isUpcoming(a) || a.status === "cancelled")
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
    return delay(limit ? rows.slice(0, limit) : rows);
  }
  trendingClips(limit: number): Promise<Clip[]> {
    return delay(
      [...db.clips].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, limit)
    );
  }
  trendingStandoutMoments(limit: number): Promise<StandoutMoment[]> {
    return delay([...db.standoutMoments].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, limit));
  }
  productLaunches(limit: number): Promise<Appearance[]> {
    return delay(
      db.appearances
        .filter((a) => a.appearanceType === "product-launch")
        .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))
        .slice(0, limit)
    );
  }
  speakersToFollow(excludeIds: string[], limit: number): Promise<Speaker[]> {
    return delay(
      db.speakers
        .filter((s) => realSpeakerIds.has(s.id) && !excludeIds.includes(s.id))
        .sort((a, b) => b.prominenceScore - a.prominenceScore)
        .slice(0, limit)
    );
  }
  relatedSpeakers(speakerId: string, limit: number): Promise<Speaker[]> {
    const s = db.speakers.find((x) => x.id === speakerId);
    if (!s) return delay([]);
    const scored = db.speakers
      .filter((x) => x.id !== speakerId)
      .map((x) => {
        const sharedTopics = x.topicIds.filter((t) => s.topicIds.includes(t)).length;
        const sharedCompanies = x.companyIds.filter((c) => s.companyIds.includes(c)).length;
        const sharedPanels = x.appearanceIds.filter((a) => s.appearanceIds.includes(a)).length;
        return { x, score: sharedTopics + sharedCompanies * 2 + sharedPanels * 3 };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return delay(scored.slice(0, limit).map((r) => r.x));
  }
  listPlans(): Promise<PlanConfig[]> {
    return delay(db.plans);
  }
}

class LocalUserRepository implements UserRepository {
  getUser(id: string): Promise<User | null> {
    return delay(db.users.find((u) => u.id === id) ?? null);
  }
  listNotifications(userId: string): Promise<AppNotification[]> {
    return delay(
      db.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }
  listViewingProgress(userId: string): Promise<ViewingProgress[]> {
    return delay(
      [...(db.viewingProgress[userId] ?? [])].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )
    );
  }
}

/* Admin adapters mutate the in-memory seed for the session —
   changes are visible across the app but reset on reload. */

class LocalIngestionAdapter implements IngestionAdapter {
  listCandidates(): Promise<IngestionCandidate[]> {
    return delay([...db.ingestionCandidates]);
  }
  getCandidate(id: string): Promise<IngestionCandidate | null> {
    return delay(db.ingestionCandidates.find((c) => c.id === id) ?? null);
  }
  setCandidateStatus(id: string, status: IngestionStatus): Promise<IngestionCandidate> {
    const c = db.ingestionCandidates.find((x) => x.id === id);
    if (!c) return Promise.reject(new Error(`Unknown candidate ${id}`));
    c.status = status;
    c.updatedAt = new Date().toISOString();
    c.logs = [
      ...c.logs,
      {
        at: new Date().toISOString(),
        stage: c.currentStage,
        level: "info",
        message: `Status set to "${status}" by admin (local demo mutation).`,
      },
    ];
    return delay({ ...c });
  }
}

class LocalEnrichmentAdapter implements EnrichmentAdapter {
  setBriefStatus(briefId: string, status: InsightBrief["status"]): Promise<InsightBrief> {
    const b = db.insightBriefs.find((x) => x.id === briefId);
    if (!b) return Promise.reject(new Error(`Unknown brief ${briefId}`));
    b.status = status;
    if (status === "published") b.reviewedAt = new Date().toISOString();
    return delay({ ...b });
  }
}

export class HybridCatalogRepository implements CatalogRepository {
  constructor(private readonly local: CatalogRepository, private readonly live: SupabaseCatalogRepository) {}
  private readonly protectedAppearanceKeys = new Set(realSeedAppearances.flatMap((row) => [row.id, row.slug]));
  private async merged<T extends { id: string; slug?: string }>(localRows: Promise<T[]>, liveRows: Promise<T[]>): Promise<T[]> {
    const local = await localRows; const live = await liveRows;
    const realBySlug = new Map(live.map((row) => [row.slug ?? row.id, row]));
    return [...live, ...local.filter((row) => !realBySlug.has(row.slug ?? row.id))];
  }
  private async one<T>(live: Promise<T | null>, local: Promise<T | null>) { return (await live) ?? local; }
  private async liveFirst<T extends { id: string; slug?: string }>(liveRows: Promise<T[]>, localRows: Promise<T[]>, limit: number): Promise<T[]> {
    const live = await liveRows;
    if (live.length >= limit) return live.slice(0, limit);
    const liveKeys = new Set(live.map((row) => row.slug ?? row.id));
    const local = (await localRows).filter((row) => !liveKeys.has(row.slug ?? row.id));
    return [...live, ...local].slice(0, limit);
  }
  async getAppearance(v: string) {
    const live = await this.live.getAppearance(v);
    if (live || this.protectedAppearanceKeys.has(v)) return live;
    return this.local.getAppearance(v);
  }
  async listAppearances(ids?: string[]) {
    const [local, live] = await Promise.all([this.local.listAppearances(ids), this.live.listAppearances(ids)]);
    const realBySlug = new Set(live.map((row) => row.slug));
    return [...live, ...local.filter((row) => !this.protectedAppearanceKeys.has(row.id) && !this.protectedAppearanceKeys.has(row.slug) && !realBySlug.has(row.slug))];
  }
  getSpeaker(v: string) { return this.one(this.live.getSpeaker(v), this.local.getSpeaker(v)); }
  listSpeakers(ids?: string[]) { return this.merged(this.local.listSpeakers(ids), this.live.listSpeakers(ids)); }
  getCompany(v: string) { return this.one(this.live.getCompany(v), this.local.getCompany(v)); }
  listCompanies(ids?: string[]) { return this.merged(this.local.listCompanies(ids), this.live.listCompanies(ids)); }
  getEvent(v: string) { return this.one(this.live.getEvent(v), this.local.getEvent(v)); }
  listEvents(ids?: string[]) { return this.merged(this.local.listEvents(ids), this.live.listEvents(ids)); }
  getTopic(v: string) { return this.one(this.live.getTopic(v), this.local.getTopic(v)); }
  listTopics(ids?: string[]) { return this.merged(this.local.listTopics(ids), this.live.listTopics(ids)); }
  listClips(ids?: string[]) { return this.merged(this.local.listClips(ids), this.live.listClips(ids)); }
  listClipsForAppearance(id: string) { return this.live.listClipsForAppearance(id); }
  listStandoutMoments(ids?: string[]) { return this.merged(this.local.listStandoutMoments(ids), this.live.listStandoutMoments(ids)); }
  listStandoutMomentsForAppearance(id: string) { return this.live.listStandoutMomentsForAppearance(id); }
  getTranscript(id: string) { return this.local.getTranscript(id); }
  listChaptersForAppearance(id: string) { return this.live.listChaptersForAppearance(id); }
  getMediaSource(id: string) { return this.one(this.live.getMediaSource(id), this.local.getMediaSource(id)); }
  getInsightBrief(id: string) { return this.one(this.live.getInsightBrief(id), this.local.getInsightBrief(id)); }
  listInsightsForBrief(id: string) { return this.live.listInsightsForBrief(id); }
  latestAppearances(limit: number) { return this.liveFirst(this.live.latestAppearances(limit), this.local.latestAppearances(limit).then((rows) => rows.filter((row) => !this.protectedAppearanceKeys.has(row.id) && !this.protectedAppearanceKeys.has(row.slug))), limit); }
  trendingAppearances(limit: number) { return this.liveFirst(this.live.trendingAppearances(limit), this.local.trendingAppearances(limit).then((rows) => rows.filter((row) => !this.protectedAppearanceKeys.has(row.id) && !this.protectedAppearanceKeys.has(row.slug))), limit); }
  upcomingAppearances(limit = 50) { return this.local.upcomingAppearances(limit); }
  trendingClips(limit: number) { return this.local.trendingClips(limit); }
  trendingStandoutMoments(limit: number) { return this.local.trendingStandoutMoments(limit); }
  productLaunches(limit: number) { return this.merged(this.local.productLaunches(100), this.live.productLaunches(100)).then((rows) => rows.slice(0, limit)); }
  speakersToFollow(ids: string[], limit: number) { return this.merged(this.local.listSpeakers(), this.live.listSpeakers()).then((rows) => rows.filter((row) => !ids.includes(row.id)).slice(0, limit)); }
  relatedSpeakers(id: string, limit: number) { return this.merged(this.local.relatedSpeakers(id, 100), this.live.relatedSpeakers(id, 100)).then((rows) => rows.filter((row) => row.id !== id).slice(0, limit)); }
  listPlans() { return this.local.listPlans(); }
}

const localCatalog = new LocalCatalogRepository();
const liveCatalog = CLIENT_RUNTIME_CONFIG.dataMode === "supabase" && CLIENT_RUNTIME_CONFIG.supabaseUrl && CLIENT_RUNTIME_CONFIG.supabasePublishableKey
  ? createSupabaseRepositories(CLIENT_RUNTIME_CONFIG, () => null).catalog : null;
// Production must not silently fill live pages with demo records.  The local
// repository remains available only when the app is explicitly in demo mode.
export const catalogRepo: CatalogRepository = liveCatalog ?? localCatalog;
export const userRepo: UserRepository = new LocalUserRepository();
export const ingestionAdapter: IngestionAdapter = new LocalIngestionAdapter();
export const enrichmentAdapter: EnrichmentAdapter = new LocalEnrichmentAdapter();
