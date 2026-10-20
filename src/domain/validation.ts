import { z } from "zod";

/* Zod validation schemas for the TECHSTAGE domain.
   Used to validate seed data at repository boot and, later,
   API payloads at the adapter boundary. Keep in lockstep
   with src/domain/types.ts. */

const id = z.string().min(1);
const isoDate = z.string().min(4);
const score100 = z.number().min(0).max(100);
const confidence = z.number().min(0).max(1);

export const verificationStatusSchema = z.enum(["verified", "unverified", "flagged"]);

export const appearanceTypeSchema = z.enum([
  "panel",
  "interview",
  "product-launch",
  "technical-talk",
  "podcast",
  "livestream",
]);

export const appearanceStatusSchema = z.enum([
  "upcoming",
  "live",
  "recorded",
  "processing",
  "cancelled",
  "rescheduled",
]);

export const rightsStatusSchema = z.enum([
  "official-embed",
  "link-only",
  "licensed",
  "pending-review",
  "restricted",
]);

const entityImageAttributionSchema = z.object({
  assetId: id,
  provider: z.enum(["official", "wikimedia", "pexels", "pixabay"]),
  sourcePageUrl: z.string(),
  attributionText: z.string().nullable(),
  licenseLabel: z.string(),
  licenseUrl: z.string().nullable(),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
});

export const speakerSchema = z.object({
  id,
  slug: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  headline: z.string(),
  biography: z.string(),
  avatarUrl: z.string().nullable(),
  imageAttribution: entityImageAttributionSchema.nullable(),
  companyIds: z.array(id),
  roleHistory: z.array(
    z.object({
      title: z.string(),
      companyId: id.nullable(),
      companyName: z.string(),
      from: isoDate,
      to: isoDate.nullable(),
    })
  ),
  topicIds: z.array(id),
  socialLinks: z.array(
    z.object({
      platform: z.enum(["x", "linkedin", "youtube", "website", "github"]),
      url: z.string(),
    })
  ),
  websiteUrl: z.string().nullable(),
  prominenceScore: score100,
  verificationStatus: verificationStatusSchema,
  upcomingAppearanceIds: z.array(id),
  appearanceIds: z.array(id),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const companySchema = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  imageAttribution: entityImageAttributionSchema.nullable(),
  description: z.string(),
  websiteUrl: z.string(),
  industryTags: z.array(z.string()),
  speakerIds: z.array(id),
  topicIds: z.array(id),
  appearanceIds: z.array(id),
  productLaunchIds: z.array(id),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const eventSchema = z.object({
  id,
  slug: z.string(),
  title: z.string(),
  organizer: z.string(),
  description: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  timezone: z.string(),
  location: z.string(),
  isOnline: z.boolean(),
  eventUrl: z.string(),
  livestreamUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageAttribution: entityImageAttributionSchema.nullable(),
  speakerIds: z.array(id),
  appearanceIds: z.array(id),
  verificationStatus: verificationStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const topicSchema = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  imageAttribution: entityImageAttributionSchema.nullable(),
  parentTopicId: id.nullable(),
  relatedTopicIds: z.array(id),
  speakerIds: z.array(id),
  appearanceIds: z.array(id),
  companyIds: z.array(id),
  trendingScore: score100,
});

export const appearanceSchema = z.object({
  id,
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  speakerIds: z.array(id).min(1),
  companyIds: z.array(id),
  eventId: id.nullable(),
  topicIds: z.array(id),
  appearanceType: appearanceTypeSchema,
  status: appearanceStatusSchema,
  scheduledStart: isoDate,
  publishedAt: isoDate.nullable(),
  durationSeconds: z.number().positive().nullable(),
  language: z.string(),
  sourceIds: z.array(id),
  primaryVideoId: id.nullable(),
  transcriptId: id.nullable(),
  clipIds: z.array(id),
  basicSummary: z.string().nullable(),
  chapterIds: z.array(id),
  premiumInsightBriefId: id.nullable(),
  relatedAppearanceIds: z.array(id),
  verificationStatus: verificationStatusSchema,
  recordingAvailability: z.enum([
    "available",
    "expected",
    "processing",
    "unavailable",
    "removed",
  ]),
  thumbnailUrl: z.string().nullable(),
  popularityScore: score100,
  relevanceScore: score100,
  rsvpUrl: z.string().nullable(),
  livestreamUrl: z.string().nullable(),
  locationLabel: z.string().nullable(),
  rescheduledFrom: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const mediaSourceSchema = z.object({
  id,
  provider: z.enum([
    "youtube",
    "vimeo",
    "podcast-rss",
    "conference-site",
    "company-site",
    "livestream",
    "manual-upload",
  ]),
  sourceUrl: z.string(),
  embedUrl: z.string().nullable(),
  externalId: z.string().nullable(),
  title: z.string(),
  channelName: z.string(),
  publishedAt: isoDate.nullable(),
  durationSeconds: z.number().nullable(),
  thumbnailUrl: z.string().nullable(),
  rightsStatus: rightsStatusSchema,
  embedAllowed: z.boolean(),
  lastCheckedAt: isoDate,
  metadata: z.record(z.string()),
});

export const transcriptSchema = z.object({
  id,
  appearanceId: id,
  sourceType: z.enum(["official-captions", "asr", "human", "uploaded"]),
  language: z.string(),
  fullText: z.string(),
  segments: z.array(
    z.object({
      id,
      startTime: z.number().min(0),
      endTime: z.number().min(0),
      speakerId: id.nullable(),
      text: z.string(),
      confidence,
    })
  ),
  speakerDiarization: z.boolean(),
  confidence,
  processingStatus: z.enum(["queued", "transcribing", "segmenting", "complete", "failed"]),
  generatedAt: isoDate.nullable(),
  reviewedAt: isoDate.nullable(),
});

export const clipSchema = z.object({
  id,
  appearanceId: id,
  title: z.string(),
  description: z.string(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  sourceUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  topicIds: z.array(id),
  speakerIds: z.array(id),
  clipType: z.enum(["highlight", "quote", "demo", "qa", "announcement"]),
  popularityScore: score100,
  rightsStatus: rightsStatusSchema,
});

export const insightCategorySchema = z.enum([
  "investment-lens",
  "market-sentiment",
  "bottlenecks",
  "builder-implications",
  "career-signals",
  "competitive-intelligence",
  "research-relevance",
  "content-angles",
  "networking-prep",
  "recruiting-relevance",
  "product-timing",
  "emerging-narratives",
  "news-context",
  "open-source-implications",
  "strategic-decisions",
  "related-signals",
  "watch-next",
]);

export const insightSchema = z.object({
  id,
  insightBriefId: id,
  category: insightCategorySchema,
  isApplicable: z.boolean(),
  confidence,
  headline: z.string(),
  summary: z.string(),
  evidence: z.array(
    z.object({
      transcriptSegmentId: id.nullable(),
      timestamp: z.number().min(0),
      quote: z.string(),
      confidence,
      kind: z.enum([
        "direct-statement",
        "summary",
        "cautious-inference",
        "model-interpretation",
      ]),
    })
  ),
  relatedSpeakerIds: z.array(id),
  relatedCompanyIds: z.array(id),
  relatedTopicIds: z.array(id),
  relatedAppearanceIds: z.array(id),
  visibility: z.enum(["premium", "preview", "hidden"]),
  sortOrder: z.number(),
});

export const insightBriefSchema = z.object({
  id,
  appearanceId: id,
  status: z.enum([
    "queued",
    "generating",
    "needs-review",
    "published",
    "no-applicable-insights",
  ]),
  modelVersion: z.string(),
  generatedAt: isoDate.nullable(),
  reviewedAt: isoDate.nullable(),
  overallConfidence: confidence,
  insightIds: z.array(id),
});

export const aiBriefSectionIdSchema = z.enum([
  "bottlenecks",
  "main-takeaways",
  "investing-edge",
  "career-advantage",
  "founder-strategy",
  "research-inspiration",
  "market-sentiment",
  "industry-effects",
]);

export const briefRecordSchema = z.object({
  appearanceId: id,
  promptVersion: z.string(),
  model: z.string(),
  sections: z.array(z.object({
    id: aiBriefSectionIdSchema,
    number: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8)]),
    title: z.string(),
    tier: z.enum(["free", "pro"]),
    items: z.array(z.object({
      id,
      headline: z.string(),
      summary: z.string(),
      timestamp: z.number().min(0).nullable(),
      quote: z.string().nullable(),
      evidenceKind: z.enum(["direct-statement", "summary", "cautious-inference", "model-interpretation"]).nullable(),
      relatedCompanyIds: z.array(id),
    })),
  })),
  markdown: z.string(),
  createdAt: isoDate,
});

export const userSchema = z.object({
  id,
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  subscriptionTier: z.enum(["free", "pro"]),
  followedSpeakerIds: z.array(id),
  followedTopicIds: z.array(id),
  followedCompanyIds: z.array(id),
  savedAppearanceIds: z.array(id),
  savedClipIds: z.array(id),
  collectionIds: z.array(id),
  preferences: z.object({
    defaultTimezone: z.string(),
    emailDigest: z.enum(["daily", "weekly", "off"]),
    autoplayClips: z.boolean(),
  }),
  notificationSettings: z.object({
    followedSpeakerNewAppearance: z.boolean(),
    recordingAvailable: z.boolean(),
    eventStartingSoon: z.boolean(),
    newInsightBrief: z.boolean(),
    scheduleChanges: z.boolean(),
  }),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const ingestionCandidateSchema = z.object({
  id,
  sourceKind: z.enum([
    "youtube-api",
    "rss",
    "podcast-feed",
    "conference-site",
    "company-events",
    "university-calendar",
    "event-platform",
    "livestream-announcement",
    "publication",
    "manual-submission",
    "social-announcement",
    "public-calendar",
    "uploaded-transcript",
  ]),
  sourceUrl: z.string(),
  rawTitle: z.string(),
  detectedSpeakerNames: z.array(z.string()),
  matchedSpeakerIds: z.array(id),
  matchedEventId: id.nullable(),
  matchedCompanyIds: z.array(id),
  duplicateOfAppearanceId: id.nullable(),
  status: z.enum([
    "discovered",
    "queued",
    "processing",
    "needs-review",
    "approved",
    "published",
    "rejected",
    "failed",
    "archived",
  ]),
  currentStage: z.string(),
  stages: z.array(
    z.object({
      stage: z.string(),
      status: z.enum(["pending", "running", "done", "failed", "skipped", "awaiting-review"]),
      startedAt: isoDate.nullable(),
      completedAt: isoDate.nullable(),
      retryCount: z.number(),
      requiresHumanReview: z.boolean(),
      error: z.string().nullable(),
    })
  ),
  logs: z.array(
    z.object({
      at: isoDate,
      stage: z.string(),
      level: z.enum(["info", "warn", "error"]),
      message: z.string(),
    })
  ),
  resultingAppearanceId: id.nullable(),
  submittedBy: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
