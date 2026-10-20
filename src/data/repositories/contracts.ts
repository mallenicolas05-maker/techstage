import type {
  Appearance,
  BriefRecord,
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

/* ————————————————————————————————————————————————
   Repository contracts.
   The UI depends only on these interfaces. The shell ships a
   local seed implementation (./local.ts); production swaps in
   HTTP/Postgres adapters without touching components.
———————————————————————————————————————————————— */

export interface CatalogRepository {
  /* entities */
  getAppearance(idOrSlug: string): Promise<Appearance | null>;
  listAppearances(ids?: string[]): Promise<Appearance[]>;
  getSpeaker(idOrSlug: string): Promise<Speaker | null>;
  listSpeakers(ids?: string[]): Promise<Speaker[]>;
  getCompany(idOrSlug: string): Promise<Company | null>;
  listCompanies(ids?: string[]): Promise<Company[]>;
  getEvent(idOrSlug: string): Promise<Event | null>;
  listEvents(ids?: string[]): Promise<Event[]>;
  getTopic(idOrSlug: string): Promise<Topic | null>;
  listTopics(ids?: string[]): Promise<Topic[]>;
  listClips(ids?: string[]): Promise<Clip[]>;
  listClipsForAppearance(appearanceId: string): Promise<Clip[]>;
  listStandoutMoments(ids?: string[]): Promise<StandoutMoment[]>;
  listStandoutMomentsForAppearance(appearanceId: string): Promise<StandoutMoment[]>;
  getTranscript(id: string): Promise<Transcript | null>;
  listChaptersForAppearance(appearanceId: string): Promise<Chapter[]>;
  getMediaSource(id: string): Promise<MediaSource | null>;

  /* insight layer (precomputed; read-only from the consumer side) */
  getInsightBrief(id: string): Promise<InsightBrief | null>;
  listInsightsForBrief(briefId: string): Promise<Insight[]>;

  /* feed queries */
  latestAppearances(limit: number): Promise<Appearance[]>;
  trendingAppearances(limit: number): Promise<Appearance[]>;
  upcomingAppearances(limit?: number): Promise<Appearance[]>;
  trendingClips(limit: number): Promise<Clip[]>;
  trendingStandoutMoments(limit: number): Promise<StandoutMoment[]>;
  productLaunches(limit: number): Promise<Appearance[]>;
  speakersToFollow(excludeIds: string[], limit: number): Promise<Speaker[]>;
  relatedSpeakers(speakerId: string, limit: number): Promise<Speaker[]>;

  /* pricing config */
  listPlans(): Promise<PlanConfig[]>;
}

export interface UserRepository {
  getUser(id: string): Promise<User | null>;
  listNotifications(userId: string): Promise<AppNotification[]>;
  listViewingProgress(userId: string): Promise<ViewingProgress[]>;
}

/* ——— Search (provider-neutral; see adapters/search.ts) ——— */

export type SearchEntityKind =
  | "appearance"
  | "speaker"
  | "company"
  | "event"
  | "topic"
  | "clip"
  | "moment"
  | "transcript";

export interface SearchFilters {
  topicIds?: string[];
  speakerIds?: string[];
  companyIds?: string[];
  eventIds?: string[];
  appearanceTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  maxDurationSeconds?: number;
  hasRecording?: boolean;
  upcomingOnly?: boolean;
  pastOnly?: boolean;
  premiumEnrichedOnly?: boolean;
  verifiedOnly?: boolean;
}

export type SearchSort = "relevance" | "newest" | "oldest" | "popularity";

export interface SearchQuery {
  text: string;
  kinds?: SearchEntityKind[];
  filters?: SearchFilters;
  sort?: SearchSort;
  limit?: number;
}

export interface SearchHit {
  kind: SearchEntityKind;
  id: string;
  score: number;
  /** For transcript hits: the matching segment + timestamp */
  snippet?: string;
  timestamp?: number;
  appearanceId?: string;
}

export interface SearchAdapter {
  search(query: SearchQuery): Promise<SearchHit[]>;
  suggest(prefix: string, limit: number): Promise<string[]>;
}

/* ——— Admin / ingestion ——— */

export interface IngestionAdapter {
  listCandidates(): Promise<IngestionCandidate[]>;
  getCandidate(id: string): Promise<IngestionCandidate | null>;
  /** Local shell: mutates in-memory state. Production: POST to the pipeline service. */
  setCandidateStatus(id: string, status: IngestionStatus): Promise<IngestionCandidate>;
}

export interface EnrichmentAdapter {
  /** Local shell: flips brief status in memory. Production: enqueues a review action. */
  setBriefStatus(briefId: string, status: InsightBrief["status"]): Promise<InsightBrief>;
}

/* ——— Provider-neutral service contracts (local no-op/mock impls in shell) ——— */

export interface AuthAdapter {
  /** Shell: resolves seed users. Production: Supabase Auth / OIDC session. */
  getSessionUser(userId: string | null): Promise<User | null>;
}

export interface SubscriptionAdapter {
  /** Shell: reads the demo tier toggle. Production: Stripe-backed entitlements. */
  getEntitledTier(userId: string): Promise<"free" | "pro">;
}

export interface MediaAdapter {
  /** Resolve a playable embed for a media source, honoring rights status. */
  resolveEmbed(source: MediaSource): Promise<{ embedUrl: string | null; reason: string | null }>;
}

export interface TranscriptAdapter {
  /** Production: queue transcription with an ASR provider. Shell: not available. */
  requestTranscription(appearanceId: string): Promise<{ queued: boolean }>;
}

export interface SummaryAdapter {
  /** Production: read the shared appearance/prompt-version cache before generating. */
  getBrief(appearanceId: string): Promise<BriefRecord | null>;
  saveBrief(record: BriefRecord): Promise<BriefRecord>;
}

export interface NotificationAdapter {
  /** Production: email/push delivery. Shell: records intent locally. */
  scheduleReminder(reminder: { appearanceId: string | null; eventId: string | null; at: string }): Promise<{ scheduled: boolean }>;
}

export interface AnalyticsAdapter {
  track(event: string, props?: Record<string, string | number | boolean>): void;
}
