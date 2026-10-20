/* ————————————————————————————————————————————————
   TECHSTAGE domain model.
   The central object is an Appearance: one speaking
   appearance connecting speakers, an event, companies,
   a recording, a transcript, chapters, clips, topics,
   and optional premium insights.
   These types are shared by web, future mobile, and the
   future API package — keep them framework-free.
———————————————————————————————————————————————— */

export type Id = string;
export type IsoDate = string;

export type SubscriptionTier = "free" | "pro";

export type VerificationStatus = "verified" | "unverified" | "flagged";

export type AppearanceType =
  | "panel"
  | "interview"
  | "product-launch"
  | "technical-talk"
  | "podcast"
  | "livestream";

export type AppearanceStatus =
  | "upcoming"
  | "live"
  | "recorded"
  | "processing"
  | "cancelled"
  | "rescheduled";

export type RecordingAvailability =
  | "available"
  | "expected"
  | "processing"
  | "unavailable"
  | "removed";

export type RightsStatus =
  | "official-embed"
  | "link-only"
  | "licensed"
  | "pending-review"
  | "restricted";

/* ——— People, companies, events, topics ——— */

export interface RoleHistoryEntry {
  title: string;
  companyId: Id | null;
  companyName: string;
  from: IsoDate;
  to: IsoDate | null;
}

export interface SocialLink {
  platform: "x" | "linkedin" | "youtube" | "website" | "github";
  url: string;
}

export interface EntityImageAttribution {
  assetId: Id;
  provider: "official" | "wikimedia" | "pexels" | "pixabay";
  sourcePageUrl: string;
  attributionText: string | null;
  licenseLabel: string;
  licenseUrl: string | null;
  focalX: number;
  focalY: number;
}

export interface Speaker {
  id: Id;
  slug: string;
  name: string;
  aliases: string[];
  headline: string;
  biography: string;
  avatarUrl: string | null;
  imageAttribution: EntityImageAttribution | null;
  companyIds: Id[];
  roleHistory: RoleHistoryEntry[];
  topicIds: Id[];
  socialLinks: SocialLink[];
  websiteUrl: string | null;
  prominenceScore: number; // 0–100
  verificationStatus: VerificationStatus;
  upcomingAppearanceIds: Id[];
  appearanceIds: Id[];
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Company {
  id: Id;
  slug: string;
  name: string;
  logoUrl: string | null;
  imageAttribution: EntityImageAttribution | null;
  description: string;
  websiteUrl: string;
  industryTags: string[];
  speakerIds: Id[];
  topicIds: Id[];
  appearanceIds: Id[];
  productLaunchIds: Id[]; // appearance ids of type product-launch
  prominenceScore?: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Event {
  id: Id;
  slug: string;
  title: string;
  organizer: string;
  description: string;
  startDate: IsoDate;
  endDate: IsoDate;
  timezone: string;
  location: string;
  isOnline: boolean;
  eventUrl: string;
  livestreamUrl: string | null;
  imageUrl: string | null;
  imageAttribution: EntityImageAttribution | null;
  speakerIds: Id[];
  appearanceIds: Id[];
  prominenceScore?: number;
  verificationStatus: VerificationStatus;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Topic {
  id: Id;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAttribution: EntityImageAttribution | null;
  parentTopicId: Id | null;
  relatedTopicIds: Id[];
  speakerIds: Id[];
  appearanceIds: Id[];
  companyIds: Id[];
  trendingScore: number; // 0–100
}

/* ——— The central object ——— */

export interface Appearance {
  id: Id;
  slug: string;
  title: string;
  description: string;
  speakerIds: Id[];
  speakerLabels?: string[];
  companyIds: Id[];
  companyLabels?: string[];
  eventId: Id | null;
  eventLabel?: string | null;
  topicIds: Id[];
  appearanceType: AppearanceType;
  status: AppearanceStatus;
  scheduledStart: IsoDate;
  publishedAt: IsoDate | null;
  durationSeconds: number | null;
  language: string;
  sourceIds: Id[];
  primaryVideoId: Id | null; // MediaSource id
  transcriptId: Id | null;
  clipIds: Id[];
  basicSummary: string | null;
  chapterIds: Id[];
  premiumInsightBriefId: Id | null;
  relatedAppearanceIds: Id[];
  verificationStatus: VerificationStatus;
  recordingAvailability: RecordingAvailability;
  thumbnailUrl: string | null;
  sourceChannel?: string | null;
  popularityScore: number; // 0–100
  relevanceScore: number; // 0–100
  /* Upcoming-specific metadata */
  rsvpUrl: string | null;
  livestreamUrl: string | null;
  locationLabel: string | null; // "Moscone West, SF" | "Online"
  rescheduledFrom: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  /** Persisted, evidence-backed analysis shared by every viewer of the talk. */
  analysisArtifact?: AnalysisArtifact | null;
}

export interface AnalysisEvidence {
  kind: EvidenceKind;
  excerpt: string;
  confidence: number;
  timestampSeconds: number | null;
}

export interface AnalysisArtifact {
  id: Id;
  route: string;
  model: string;
  summary: string;
  confidence: number;
  generatedAt: IsoDate;
  topics: string[];
  evidence: AnalysisEvidence[];
}

/* ——— Media + transcript ——— */

export type MediaProvider =
  | "youtube"
  | "vimeo"
  | "podcast-rss"
  | "conference-site"
  | "company-site"
  | "livestream"
  | "manual-upload";

export interface MediaSource {
  id: Id;
  provider: MediaProvider;
  sourceUrl: string;
  embedUrl: string | null;
  externalId: string | null;
  title: string;
  channelName: string;
  publishedAt: IsoDate | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  rightsStatus: RightsStatus;
  embedAllowed: boolean;
  lastCheckedAt: IsoDate;
  metadata: Record<string, string>;
}

export type TranscriptProcessingStatus =
  | "queued"
  | "transcribing"
  | "segmenting"
  | "complete"
  | "failed";

export interface TranscriptSegment {
  id: Id;
  startTime: number; // seconds
  endTime: number;
  speakerId: Id | null;
  text: string;
  confidence: number; // 0–1
}

export interface Transcript {
  id: Id;
  appearanceId: Id;
  sourceType: "official-captions" | "asr" | "human" | "uploaded";
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  speakerDiarization: boolean;
  confidence: number;
  processingStatus: TranscriptProcessingStatus;
  generatedAt: IsoDate | null;
  reviewedAt: IsoDate | null;
}

export interface Chapter {
  id: Id;
  appearanceId: Id;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  topicIds: Id[];
}

export type ClipType = "highlight" | "quote" | "demo" | "qa" | "announcement";

export interface Clip {
  id: Id;
  appearanceId: Id;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  sourceUrl: string; // timestamped link to original
  thumbnailUrl: string | null;
  topicIds: Id[];
  speakerIds: Id[];
  clipType: ClipType;
  popularityScore: number;
  rightsStatus: RightsStatus;
}

/** Editorially selected words and moments, distinct from playable short video clips. */
export interface StandoutMoment {
  id: Id;
  appearanceId: Id;
  title: string;
  description: string;
  startTime: number;
  speakerIds: Id[];
  topicIds: Id[];
  kind: Exclude<ClipType, "demo">;
  popularityScore: number;
}

/* ——— Premium insight layer ——— */

export type InsightCategory =
  | "investment-lens"
  | "market-sentiment"
  | "bottlenecks"
  | "builder-implications"
  | "career-signals"
  | "competitive-intelligence"
  | "research-relevance"
  | "content-angles"
  | "networking-prep"
  | "recruiting-relevance"
  | "product-timing"
  | "emerging-narratives"
  | "news-context"
  | "open-source-implications"
  | "strategic-decisions"
  | "related-signals"
  | "watch-next";

export type InsightBriefStatus =
  | "queued"
  | "generating"
  | "needs-review"
  | "published"
  | "no-applicable-insights";

/** How the statement relates to what was actually said. */
export type EvidenceKind =
  | "direct-statement"
  | "summary"
  | "cautious-inference"
  | "model-interpretation";

export interface InsightEvidence {
  transcriptSegmentId: Id | null;
  timestamp: number; // seconds into recording
  quote: string;
  confidence: number;
  kind: EvidenceKind;
}

export interface Insight {
  id: Id;
  insightBriefId: Id;
  category: InsightCategory;
  isApplicable: boolean;
  confidence: number; // 0–1; must exceed configured threshold to display
  headline: string;
  summary: string;
  evidence: InsightEvidence[];
  relatedSpeakerIds: Id[];
  relatedCompanyIds: Id[];
  relatedTopicIds: Id[];
  relatedAppearanceIds: Id[];
  visibility: "premium" | "preview" | "hidden";
  sortOrder: number;
}

export interface InsightBrief {
  id: Id;
  appearanceId: Id;
  status: InsightBriefStatus;
  modelVersion: string;
  generatedAt: IsoDate | null;
  reviewedAt: IsoDate | null;
  overallConfidence: number;
  insightIds: Id[];
}

/* ——— User-facing AI brief dossier ——— */

export type AIBriefSectionId =
  | "bottlenecks"
  | "main-takeaways"
  | "investing-edge"
  | "career-advantage"
  | "founder-strategy"
  | "research-inspiration"
  | "market-sentiment"
  | "industry-effects";

export interface AIBriefItem {
  id: Id;
  headline: string;
  summary: string;
  timestamp: number | null;
  quote: string | null;
  evidenceKind: EvidenceKind | null;
  relatedCompanyIds: Id[];
}

export interface AIBriefSection {
  id: AIBriefSectionId;
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  title: string;
  tier: SubscriptionTier;
  items: AIBriefItem[];
}

/** Cached per talk and prompt version. The presentation sequence is intentionally not stored. */
export interface BriefRecord {
  appearanceId: Id;
  promptVersion: string;
  model: string;
  sections: AIBriefSection[];
  markdown: string;
  createdAt: IsoDate;
}

/* ——— User space ——— */

export interface UserPreferences {
  defaultTimezone: string;
  emailDigest: "daily" | "weekly" | "off";
  autoplayClips: boolean;
}

export interface NotificationSettings {
  followedSpeakerNewAppearance: boolean;
  recordingAvailable: boolean;
  eventStartingSoon: boolean;
  newInsightBrief: boolean;
  scheduleChanges: boolean;
}

export interface User {
  id: Id;
  name: string;
  email: string;
  avatarUrl: string | null;
  subscriptionTier: SubscriptionTier;
  followedSpeakerIds: Id[];
  followedTopicIds: Id[];
  followedCompanyIds: Id[];
  savedAppearanceIds: Id[];
  savedClipIds: Id[];
  collectionIds: Id[];
  preferences: UserPreferences;
  notificationSettings: NotificationSettings;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Collection {
  id: Id;
  userId: Id;
  name: string;
  description: string;
  appearanceIds: Id[];
  clipIds: Id[];
  momentIds?: Id[];
  speakerIds: Id[];
  topicIds: Id[];
  visibility: "private" | "unlisted" | "public";
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** UI-facing name for a mixed-media collection. */
export type Album = Collection;

export type ReminderStatus = "scheduled" | "sent" | "cancelled";

export interface Reminder {
  id: Id;
  userId: Id;
  eventId: Id | null;
  appearanceId: Id | null;
  reminderTime: IsoDate;
  deliveryChannels: ("email" | "push" | "in-app")[];
  status: ReminderStatus;
}

export type NotificationType =
  | "new-appearance"
  | "recording-available"
  | "event-starting"
  | "new-clip"
  | "transcript-ready"
  | "insight-brief-ready"
  | "related-signal"
  | "schedule-change"
  | "livestream-available";

export interface AppNotification {
  id: Id;
  userId: Id;
  type: NotificationType;
  title: string;
  body: string;
  linkedEntityType: "appearance" | "event" | "speaker" | "clip" | null;
  linkedEntityId: Id | null;
  isRead: boolean;
  createdAt: IsoDate;
}

/* ——— Viewing progress (continue watching) ——— */

export interface ViewingProgress {
  appearanceId: Id;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: IsoDate;
}

/* ——— Ingestion pipeline ——— */

export type IngestionStage =
  | "discover-source"
  | "create-candidate"
  | "normalize-metadata"
  | "detect-duplicates"
  | "match-entities"
  | "verify-source"
  | "acquire-transcript"
  | "segment-transcript"
  | "identify-speakers"
  | "identify-chapters"
  | "identify-highlights"
  | "generate-summary"
  | "insight-applicability"
  | "generate-insights"
  | "attach-evidence"
  | "link-related"
  | "review-queue"
  | "publish"
  | "recheck-source";

export type IngestionStatus =
  | "discovered"
  | "queued"
  | "processing"
  | "needs-review"
  | "approved"
  | "published"
  | "rejected"
  | "failed"
  | "archived";

export type IngestionSourceKind =
  | "youtube-api"
  | "rss"
  | "podcast-feed"
  | "conference-site"
  | "company-events"
  | "university-calendar"
  | "event-platform"
  | "livestream-announcement"
  | "publication"
  | "manual-submission"
  | "social-announcement"
  | "public-calendar"
  | "uploaded-transcript";

export interface IngestionLogEntry {
  at: IsoDate;
  stage: IngestionStage;
  level: "info" | "warn" | "error";
  message: string;
}

export interface StageState {
  stage: IngestionStage;
  status: "pending" | "running" | "done" | "failed" | "skipped" | "awaiting-review";
  startedAt: IsoDate | null;
  completedAt: IsoDate | null;
  retryCount: number;
  requiresHumanReview: boolean;
  error: string | null;
}

export interface IngestionCandidate {
  id: Id;
  sourceKind: IngestionSourceKind;
  sourceUrl: string;
  rawTitle: string;
  detectedSpeakerNames: string[];
  matchedSpeakerIds: Id[];
  matchedEventId: Id | null;
  matchedCompanyIds: Id[];
  duplicateOfAppearanceId: Id | null;
  status: IngestionStatus;
  currentStage: IngestionStage;
  stages: StageState[];
  logs: IngestionLogEntry[];
  resultingAppearanceId: Id | null;
  submittedBy: string | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/* ——— Pricing (seed-configurable, not a business decision) ——— */

export interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  followLimit: number | null; // null = unlimited
  collectionLimit: number | null;
  reminderLimit: number | null;
  features: string[];
}
