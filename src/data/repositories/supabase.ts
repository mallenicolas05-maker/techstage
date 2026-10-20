import type { ClientRuntimeConfig } from "@/backend/config";
import type {
  BackfillSpec,
  ManualCandidateDraft,
  OperationsSnapshot,
} from "@/domain/operations";
import type {
  CatalogRepository,
  UserRepository,
} from "@/data/repositories/contracts";
import type {
  Appearance,
  AppNotification,
  Chapter,
  Clip,
  Company,
  Event,
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

export interface AuthSession {
  accessToken: string;
  expiresAt: number;
  user: { id: string; email: string };
}

export class SupabaseHttpGateway {
  constructor(
    private readonly config: ClientRuntimeConfig,
    private readonly getSession: () => AuthSession | null,
  ) {
    if (!config.supabaseUrl || !config.supabasePublishableKey)
      throw new Error("Supabase browser configuration is incomplete");
  }

  startGoogleOAuth(returnTo = window.location.href): void {
    const url = new URL("/auth/v1/authorize", this.requiredUrl());
    url.searchParams.set("provider", "google");
    url.searchParams.set("redirect_to", returnTo);
    window.location.assign(url);
  }

  async readCatalog<T>(
    resource: string,
    options: {
      id?: string;
      lookup?: string;
      userId?: string;
      appearanceId?: string;
      briefId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<T[]> {
    const params = new URLSearchParams({
      resource,
      limit: String(options.limit ?? 50),
    });
    if (options.id) params.set("id", options.id);
    if (options.lookup) params.set("lookup", options.lookup);
    if (options.userId) params.set("userId", options.userId);
    if (options.appearanceId) params.set("appearanceId", options.appearanceId);
    if (options.briefId) params.set("briefId", options.briefId);
    if (options.offset) params.set("offset", String(options.offset));
    const rows = await this.request<Record<string, unknown>[]>(
      `/functions/v1/catalog-api?${params}`,
    );
    return rows.map((row) => normalizeCatalogRow(resource, row) as T);
  }

  async readUserCatalog<T>(
    resource: "profiles" | "notifications" | "viewing_progress",
  ): Promise<T[]> {
    const rows = await this.request<Record<string, unknown>[]>(
      `/functions/v1/user-api?resource=${resource}`,
    );
    return rows.map((row) => normalizeCatalogRow(resource, row) as T);
  }

  async readOperations(): Promise<OperationsSnapshot> {
    return this.request<OperationsSnapshot>("/functions/v1/admin-api");
  }

  async performAdminAction(
    action: string,
    entityId?: string,
    detail?: string,
  ): Promise<{ accepted: boolean; dryRun: boolean }> {
    return this.request("/functions/v1/admin-api", {
      method: "POST",
      body: JSON.stringify({ action, entityId, detail }),
    });
  }

  async submitStructuredCandidates(
    candidates: ManualCandidateDraft[],
  ): Promise<{ accepted: number }> {
    return this.request("/functions/v1/admin-api", {
      method: "POST",
      body: JSON.stringify({ action: "submit-candidates", candidates }),
    });
  }

  async estimateBackfill(
    spec: BackfillSpec,
  ): Promise<{ candidates: number; quotaUnits: number; maximumUsd: number }> {
    return this.request("/functions/v1/admin-api", {
      method: "POST",
      body: JSON.stringify({ action: "estimate-backfill", spec }),
    });
  }

  async createCheckout(priceId: string): Promise<{ url: string }> {
    return this.request("/functions/v1/billing", {
      method: "POST",
      headers: { "x-idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ action: "checkout", priceId }),
    });
  }

  async createCustomerPortal(): Promise<{ url: string }> {
    return this.request("/functions/v1/billing", {
      method: "POST",
      body: JSON.stringify({ action: "portal" }),
    });
  }

  private requiredUrl(): string {
    if (!this.config.supabaseUrl) throw new Error("Supabase URL is missing");
    return this.config.supabaseUrl;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const session = this.getSession();
    const headers: Record<string, string> = {
      apikey: this.config.supabasePublishableKey ?? "",
      ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    };
    // A content type on a bodyless GET forces a browser preflight. Keep public
    // catalog reads simple and add JSON only for requests that actually carry a body.
    if (init.body && !headers["content-type"])
      headers["content-type"] = "application/json";
    const response = await fetch(new URL(path, this.requiredUrl()), {
      ...init,
      headers,
    });
    if (!response.ok)
      throw new Error(`Supabase request failed with ${response.status}`);
    return response.json() as Promise<T>;
  }
}

/**
 * Public catalog boundary. The API itself enforces the publication gate; callers
 * only receive fully playable, evidence-backed appearances.
 */
export class SupabaseCatalogRepository implements CatalogRepository {
  private readonly catalogCache = new Map<
    string,
    { expiresAt: number; value: Promise<unknown[]> }
  >();

  constructor(private readonly gateway: SupabaseHttpGateway) {}

  getAppearance(value: string) {
    return this.one<Appearance>("appearances", value);
  }
  listAppearances(ids?: string[]) {
    return this.list<Appearance>("appearances", ids);
  }
  getSpeaker(value: string) {
    return this.one<Speaker>("speakers", value);
  }
  listSpeakers(ids?: string[]) {
    return this.list<Speaker>("speakers", ids);
  }
  getCompany(value: string) {
    return this.one<Company>("companies", value);
  }
  listCompanies(ids?: string[]) {
    return this.list<Company>("companies", ids);
  }
  getEvent(value: string) {
    return this.one<Event>("events", value);
  }
  listEvents(ids?: string[]) {
    return this.list<Event>("events", ids);
  }
  getTopic(value: string) {
    return this.one<Topic>("topics", value);
  }
  listTopics(ids?: string[]) {
    return this.list<Topic>("topics", ids);
  }
  listClips(ids?: string[]) {
    return this.list<Clip>("highlights", ids);
  }
  async listClipsForAppearance(appearanceId: string) {
    return this.gateway.readCatalog<Clip>("highlights", {
      appearanceId,
      limit: 100,
    });
  }
  listStandoutMoments(ids?: string[]) {
    return this.list<StandoutMoment>("highlights", ids);
  }
  async listStandoutMomentsForAppearance(appearanceId: string) {
    return this.gateway.readCatalog<StandoutMoment>("highlights", {
      appearanceId,
      limit: 100,
    });
  }
  async getTranscript(_id: string): Promise<Transcript | null> {
    return null;
  }
  listChaptersForAppearance(appearanceId: string) {
    return this.gateway.readCatalog<Chapter>("chapters", {
      appearanceId,
      limit: 100,
    });
  }
  getMediaSource(id: string) {
    return this.one<MediaSource>("media_sources", id);
  }
  getInsightBrief(id: string) {
    return this.one<InsightBrief>("insight_briefs", id);
  }
  listInsightsForBrief(briefId: string) {
    return this.gateway.readCatalog<Insight>("insights", {
      briefId,
      limit: 100,
    });
  }
  async latestAppearances(limit: number) {
    return (await this.listAppearances())
      .sort((a, b) =>
        (b.publishedAt ?? b.createdAt).localeCompare(
          a.publishedAt ?? a.createdAt,
        ),
      )
      .slice(0, limit);
  }
  async trendingAppearances(limit: number) {
    return (await this.listAppearances())
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }
  async upcomingAppearances(limit = 50) {
    return (await this.listAppearances())
      .filter((item) =>
        ["upcoming", "live", "rescheduled"].includes(item.status),
      )
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
      .slice(0, limit);
  }
  async trendingClips(limit: number) {
    return (await this.listClips())
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }
  async trendingStandoutMoments(limit: number) {
    return (await this.listStandoutMoments())
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }
  async productLaunches(limit: number) {
    return (await this.listAppearances())
      .filter((item) => item.appearanceType === "product-launch")
      .slice(0, limit);
  }
  async speakersToFollow(excludeIds: string[], limit: number) {
    const excluded = new Set(excludeIds);
    return (await this.listSpeakers())
      .filter((item) => !excluded.has(item.id))
      .sort((a, b) => b.prominenceScore - a.prominenceScore)
      .slice(0, limit);
  }
  async relatedSpeakers(speakerId: string, limit: number) {
    return (await this.listSpeakers())
      .filter((item) => item.id !== speakerId)
      .slice(0, limit);
  }
  listPlans() {
    return this.list<PlanConfig>("plans");
  }

  private async one<T>(resource: string, lookup: string): Promise<T | null> {
    return (
      (await this.gateway.readCatalog<T>(resource, { lookup, limit: 1 }))[0] ??
      null
    );
  }

  private async list<T>(resource: string, ids?: string[]): Promise<T[]> {
    if (!ids) return this.all<T>(resource);
    if (ids.length === 0) return [];
    const rows: Array<T | null> = await Promise.all(
      ids.map(
        async (id): Promise<T | null> =>
          (await this.gateway.readCatalog<T>(resource, { id, limit: 1 }))[0] ??
          null,
      ),
    );
    return rows.filter((row): row is T => row !== null);
  }

  private async all<T>(resource: string): Promise<T[]> {
    const cached = this.catalogCache.get(resource);
    if (cached && cached.expiresAt > Date.now())
      return cached.value as Promise<T[]>;
    const value = this.readAll<T>(resource).catch((error) => {
      this.catalogCache.delete(resource);
      throw error;
    });
    this.catalogCache.set(resource, { expiresAt: Date.now() + 60_000, value });
    return value;
  }

  private async readAll<T>(resource: string): Promise<T[]> {
    const pageSize = 100;
    const all: T[] = [];
    for (let offset = 0; offset < 5000; offset += pageSize) {
      const page = await this.gateway.readCatalog<T>(resource, {
        limit: pageSize,
        offset,
      });
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return all;
  }
}

export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly gateway: SupabaseHttpGateway) {}
  async getUser(_id: string): Promise<User | null> {
    return (await this.gateway.readUserCatalog<User>("profiles"))[0] ?? null;
  }
  listNotifications(_userId: string): Promise<AppNotification[]> {
    return this.gateway.readUserCatalog<AppNotification>("notifications");
  }
  listViewingProgress(_userId: string): Promise<ViewingProgress[]> {
    return this.gateway.readUserCatalog<ViewingProgress>("viewing_progress");
  }
}

export function createSupabaseRepositories(
  config: ClientRuntimeConfig,
  getSession: () => AuthSession | null,
) {
  const gateway = new SupabaseHttpGateway(config, getSession);
  return {
    gateway,
    catalog: new SupabaseCatalogRepository(gateway),
    users: new SupabaseUserRepository(gateway),
  };
}

function normalizeCatalogRow(
  resource: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const row = camelize(raw) as Record<string, unknown>;
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  const relatedIds = (value: unknown, key: string, prefix: string) =>
    Array.isArray(value)
      ? value
          .map((item) =>
            item && typeof item === "object"
              ? (item as Record<string, unknown>)[key]
              : null,
          )
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) =>
            String(
              item.id ?? (item.slug ? `${prefix}-${String(item.slug)}` : ""),
            ),
          )
          .filter(Boolean)
      : [];
  const createdAt = String(row.createdAt ?? new Date(0).toISOString());
  const updatedAt = String(row.updatedAt ?? createdAt);
  const requestedVariant =
    resource === "companies"
      ? "logo-512"
      : resource === "speakers"
        ? "speaker-512"
        : "landscape-1600";
  const image = resolveEntityImage(row.imageAsset, requestedVariant);
  if (resource === "appearances") {
    const relationshipLabels = (
      value: unknown,
      relationKey: string,
      nestedKey: string,
    ) =>
      Array.isArray(value)
        ? [
            ...new Set(
              value
                .map((entry) => {
                  if (!entry || typeof entry !== "object") return "";
                  const relation = entry as Record<string, unknown>;
                  const nested =
                    relation[nestedKey] &&
                    typeof relation[nestedKey] === "object"
                      ? (relation[nestedKey] as Record<string, unknown>)
                      : null;
                  return String(relation[relationKey] ?? nested?.name ?? "");
                })
                .filter(Boolean),
            ),
          ]
        : [];
    const canonical =
      row.canonicalMedia && typeof row.canonicalMedia === "object"
        ? (row.canonicalMedia as Record<string, unknown>)
        : null;
    const event =
      row.event && typeof row.event === "object"
        ? (row.event as Record<string, unknown>)
        : null;
    const chapters = Array.isArray(row.chapters)
      ? (row.chapters as Array<Record<string, unknown>>)
      : [];
    const highlights = Array.isArray(row.highlights)
      ? (row.highlights as Array<Record<string, unknown>>)
      : [];
    const analysisRaw = Array.isArray(row.analysisArtifacts)
      ? (row.analysisArtifacts[0] as Record<string, unknown> | undefined)
      : undefined;
    const duration =
      Number(canonical?.durationSeconds ?? row.durationSeconds ?? 0) || null;
    const normalizeIntervals = (items: Array<Record<string, unknown>>) =>
      items
        .slice()
        .sort(
          (left, right) =>
            Number(left.startSeconds ?? 0) - Number(right.startSeconds ?? 0),
        )
        .map((item, index, sorted) => {
          const startTime = Number(item.startSeconds ?? 0);
          const explicitEnd = Number(item.endSeconds ?? 0);
          const nextStart = Number(sorted[index + 1]?.startSeconds ?? 0);
          const fallbackEnd =
            nextStart > startTime
              ? nextStart
              : Math.min(duration ?? startTime + 60, startTime + 60);
          return {
            ...item,
            startTime,
            endTime:
              explicitEnd > startTime
                ? explicitEnd
                : Math.max(startTime + 1, fallbackEnd),
          };
        });
    return {
      ...row,
      description: String(row.summary ?? ""),
      speakerIds: relatedIds(row.appearanceSpeakers, "speaker", "s"),
      speakerLabels: relationshipLabels(
        row.appearanceSpeakers,
        "speakerName",
        "speaker",
      ),
      companyIds: relatedIds(row.appearanceCompanies, "company", "c"),
      companyLabels: relationshipLabels(
        row.appearanceCompanies,
        "companyName",
        "company",
      ),
      topicIds: relatedIds(row.appearanceTopics, "topic", "t"),
      eventId: event
        ? String(event.id ?? (event.slug ? `e-${String(event.slug)}` : "")) ||
          null
        : null,
      eventLabel: String(row.eventName ?? event?.name ?? "") || null,
      appearanceType: row.appearanceType ?? "panel",
      status: row.status === "published" ? "recorded" : "processing",
      scheduledStart: String(row.occurredAt ?? createdAt),
      publishedAt: row.publishedAt ?? null,
      durationSeconds: duration,
      language: "en",
      sourceIds: row.canonicalSourceId ? [row.canonicalSourceId] : [],
      primaryVideoId: row.canonicalSourceId ?? null,
      transcriptId: null,
      clipIds: [],
      basicSummary: row.summary ?? null,
      chapterIds: [],
      premiumInsightBriefId: null,
      relatedAppearanceIds: [],
      verificationStatus: "verified",
      recordingAvailability: row.canonicalSourceId
        ? "available"
        : "unavailable",
      thumbnailUrl: canonical?.thumbnailUrl ?? null,
      sourceChannel: String(canonical?.channelName ?? "") || null,
      popularityScore: 0,
      relevanceScore: 0,
      rsvpUrl: null,
      livestreamUrl: null,
      locationLabel: null,
      rescheduledFrom: null,
      createdAt,
      updatedAt,
      chapters: normalizeIntervals(chapters),
      highlights: normalizeIntervals(highlights),
      analysisArtifact: analysisRaw
        ? {
            id: String(analysisRaw.id ?? ""),
            route: String(analysisRaw.route ?? "stored-analysis"),
            model: String(analysisRaw.model ?? "TechStage analysis"),
            summary: String(analysisRaw.summary ?? row.summary ?? ""),
            confidence: Number(analysisRaw.confidence ?? 0),
            generatedAt: String(analysisRaw.generatedAt ?? createdAt),
            topics: strings(analysisRaw.topics),
            evidence: Array.isArray(analysisRaw.evidence)
              ? analysisRaw.evidence.map((entry) => {
                  const evidence =
                    entry && typeof entry === "object"
                      ? (entry as Record<string, unknown>)
                      : {};
                  return {
                    kind: String(evidence.kind ?? "summary"),
                    excerpt: String(evidence.excerpt ?? ""),
                    confidence: Number(evidence.confidence ?? 0),
                    timestampSeconds:
                      evidence.timestampSeconds == null
                        ? null
                        : Number(evidence.timestampSeconds),
                  };
                })
              : [],
          }
        : null,
    };
  }
  if (resource === "speakers")
    return {
      ...row,
      biography: String(row.biography ?? ""),
      avatarUrl: image.url,
      imageAttribution: image.attribution,
      companyIds: relatedIds(row.speakerCompanies, "company", "c"),
      roleHistory: [],
      topicIds: relatedIds(row.speakerTopics, "topic", "t"),
      socialLinks: [],
      websiteUrl: null,
      prominenceScore: Number(row.prominenceScore ?? 0),
      verificationStatus:
        row.status === "published" ? "verified" : "unverified",
      upcomingAppearanceIds: [],
      appearanceIds: [],
      createdAt,
      updatedAt,
    };
  if (resource === "companies")
    return {
      ...row,
      logoUrl: image.url,
      imageAttribution: image.attribution,
      description: String(row.description ?? ""),
      websiteUrl: String(row.websiteUrl ?? ""),
      industryTags: [],
      speakerIds: [],
      topicIds: relatedIds(row.companyTopics, "topic", "t"),
      appearanceIds: [],
      productLaunchIds: [],
      prominenceScore: Number(row.prominenceScore ?? 0),
      createdAt,
      updatedAt,
    };
  if (resource === "events")
    return {
      ...row,
      title: row.name,
      organizer: "",
      description: String(row.description ?? ""),
      startDate: String(row.startsAt ?? createdAt),
      endDate: String(row.endsAt ?? row.startsAt ?? createdAt),
      timezone: String(row.timezone ?? "UTC"),
      location: "",
      isOnline: true,
      eventUrl: String(row.officialUrl ?? ""),
      livestreamUrl: null,
      imageUrl: image.url,
      imageAttribution: image.attribution,
      speakerIds: [],
      appearanceIds: [],
      topicIds: relatedIds(row.eventTopics, "topic", "t"),
      prominenceScore: Number(row.prominenceScore ?? 0),
      verificationStatus:
        row.status === "published" ? "verified" : "unverified",
      createdAt,
      updatedAt,
    };
  if (resource === "topics")
    return {
      ...row,
      description: String(row.description ?? ""),
      imageUrl: image.url,
      imageAttribution: image.attribution,
      parentTopicId: null,
      relatedTopicIds: [],
      speakerIds: [],
      appearanceIds: [],
      companyIds: [],
      trendingScore: 0,
    };
  if (resource === "media_sources")
    return {
      ...row,
      sourceUrl: row.sourceUrl,
      embedUrl: row.embedAllowed ? (row.embedUrl ?? null) : null,
      title: row.title ?? "Official recording",
      channelName: row.channelName ?? "Official source",
      publishedAt: row.publishedAt ?? null,
      durationSeconds: row.durationSeconds ?? null,
      thumbnailUrl: row.thumbnailUrl ?? null,
      rightsStatus: mapRights(row.rightsStatus),
      lastCheckedAt: String(row.lastCheckedAt ?? updatedAt),
      metadata: {},
      provider: row.provider === "x" ? "company-site" : row.provider,
    };
  if (resource === "chapters")
    return {
      ...row,
      description: String(row.summary ?? ""),
      startTime: Number(row.startSeconds ?? 0),
      endTime: Number(row.endSeconds ?? row.startSeconds ?? 0),
      topicIds: [],
    };
  if (resource === "highlights")
    return {
      ...row,
      description: String(row.summary ?? ""),
      startTime: Number(row.startSeconds ?? 0),
      endTime: Number(row.endSeconds ?? row.startSeconds ?? 0),
      sourceUrl: "",
      thumbnailUrl: null,
      topicIds: [],
      speakerIds: [],
      clipType: row.kind ?? "highlight",
      kind: row.kind ?? "highlight",
      popularityScore: 0,
      rightsStatus: "official-embed",
    };
  if (resource === "insight_briefs")
    return {
      ...row,
      insightIds: [],
      modelVersion: String(row.modelVersion ?? ""),
      overallConfidence: Number(row.overallConfidence ?? 0),
    };
  if (resource === "insights")
    return {
      ...row,
      insightBriefId: row.insightBriefId,
      isApplicable: true,
      headline: row.title,
      summary: row.body,
      evidence: row.evidenceExcerpt
        ? [
            {
              transcriptSegmentId: null,
              timestamp:
                row.evidenceTimestampSeconds == null
                  ? null
                  : Number(row.evidenceTimestampSeconds),
              quote: row.evidenceExcerpt,
              confidence: Number(row.confidence ?? 0),
              kind: "summary",
            },
          ]
        : [],
      relatedSpeakerIds: [],
      relatedCompanyIds: [],
      relatedTopicIds: [],
      relatedAppearanceIds: [],
      visibility: row.premium ? "premium" : "preview",
      sortOrder: 0,
    };
  if (resource === "plans")
    return {
      tier: row.id,
      name: row.name,
      monthlyPriceUsd: 0,
      annualPriceUsd: 0,
      followLimit: null,
      collectionLimit: null,
      reminderLimit: null,
      features: Object.entries(
        row.entitlements && typeof row.entitlements === "object"
          ? (row.entitlements as Record<string, unknown>)
          : {},
      )
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key),
    };
  if (resource === "profiles")
    return {
      ...row,
      name: String(row.displayName ?? row.email ?? "User"),
      avatarUrl: row.avatarUrl ?? null,
      subscriptionTier: "free",
      followedSpeakerIds: [],
      followedTopicIds: [],
      followedCompanyIds: [],
      savedAppearanceIds: [],
      savedClipIds: [],
      collectionIds: [],
      preferences: {
        defaultTimezone: "UTC",
        emailDigest: "weekly",
        autoplayClips: false,
      },
      notificationSettings: {
        followedSpeakerNewAppearance: true,
        recordingAvailable: true,
        eventStartingSoon: true,
        newInsightBrief: true,
        scheduleChanges: true,
      },
      createdAt,
      updatedAt,
    };
  if (resource === "notifications")
    return {
      ...row,
      isRead: Boolean(row.readAt),
      linkedEntityType: row.linkedEntityType ?? null,
      linkedEntityId: row.linkedEntityId ?? null,
      createdAt,
    };
  if (resource === "viewing_progress")
    return {
      ...row,
      positionSeconds: Number(row.positionSeconds ?? 0),
      durationSeconds: Number(row.durationSeconds ?? 0),
      updatedAt,
    };
  return { ...row, tags: strings(row.tags), createdAt, updatedAt };
}

function resolveEntityImage(
  value: unknown,
  variantName: string,
): { url: string | null; attribution: Record<string, unknown> | null } {
  if (!value || typeof value !== "object")
    return { url: null, attribution: null };
  const asset = value as Record<string, unknown>;
  const variants = Array.isArray(asset.assetVariants)
    ? asset.assetVariants.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
  const variant =
    variants.find(
      (item) => item.variant === variantName && item.format === "webp",
    ) ??
    variants.find((item) => item.variant === variantName) ??
    variants[0];
  const url = typeof variant?.publicUrl === "string" ? variant.publicUrl : null;
  if (!url) return { url: null, attribution: null };
  const provider =
    asset.provider === "official-site" || asset.provider === "official"
      ? "official"
      : asset.provider === "wikimedia"
        ? "wikimedia"
        : asset.provider === "pixabay"
          ? "pixabay"
          : "pexels";
  return {
    url,
    attribution: {
      assetId: String(asset.id ?? ""),
      provider,
      sourcePageUrl: String(asset.sourcePageUrl ?? ""),
      attributionText:
        typeof asset.attributionText === "string"
          ? asset.attributionText
          : null,
      licenseLabel: String(asset.licenseLabel ?? ""),
      licenseUrl:
        typeof asset.licenseUrl === "string" ? asset.licenseUrl : null,
      focalX: Number(asset.focalX ?? 0.5),
      focalY: Number(asset.focalY ?? 0.5),
    },
  };
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      camelize(entry),
    ]),
  );
}

function mapRights(
  value: unknown,
):
  | "official-embed"
  | "link-only"
  | "licensed"
  | "pending-review"
  | "restricted" {
  if (value === "embed-allowed") return "official-embed";
  if (value === "link-only" || value === "licensed") return value;
  if (value === "blocked") return "restricted";
  return "pending-review";
}
