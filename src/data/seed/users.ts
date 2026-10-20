import type {
  AppNotification,
  Collection,
  PlanConfig,
  Reminder,
  User,
  ViewingProgress,
} from "@/domain/types";

/* Demo user states. The demo bar switches between signed-out,
   the free user, and the pro user. */

const NOW = "2026-07-01T00:00:00Z";

export const seedUsers: User[] = [
  {
    id: "u-free",
    name: "Jordan Reeve",
    email: "jordan@example.com",
    avatarUrl: null,
    subscriptionTier: "free",
    followedSpeakerIds: ["s-elon-musk", "s-sam-altman", "s-jensen-huang"],
    followedTopicIds: ["t-inference"],
    followedCompanyIds: ["c-tesla", "c-openai"],
    savedAppearanceIds: ["a-01", "a-07"],
    savedClipIds: ["cl-021", "cl-005"],
    collectionIds: ["col-1"],
    preferences: { defaultTimezone: "America/Los_Angeles", emailDigest: "weekly", autoplayClips: false },
    notificationSettings: {
      followedSpeakerNewAppearance: true,
      recordingAvailable: true,
      eventStartingSoon: true,
      newInsightBrief: false,
      scheduleChanges: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "u-pro",
    name: "Alex Ferreira",
    email: "alex@example.com",
    avatarUrl: null,
    subscriptionTier: "pro",
    followedSpeakerIds: [
      "s-sam-altman", "s-jensen-huang", "s-satya-nadella", "s-sundar-pichai",
      "s-dario-amodei", "s-lisa-su", "s-mark-zuckerberg",
    ],
    followedTopicIds: ["t-inference", "t-chips", "t-energy", "t-venture-capital", "t-open-source-models"],
    followedCompanyIds: ["c-openai", "c-nvidia", "c-microsoft"],
    savedAppearanceIds: ["a-01", "a-02", "a-04", "a-08", "a-10", "a-23"],
    savedClipIds: ["cl-001", "cl-005", "cl-013", "cl-023", "cl-052"],
    collectionIds: ["col-2", "col-3", "col-4"],
    preferences: { defaultTimezone: "America/New_York", emailDigest: "daily", autoplayClips: true },
    notificationSettings: {
      followedSpeakerNewAppearance: true,
      recordingAvailable: true,
      eventStartingSoon: true,
      newInsightBrief: true,
      scheduleChanges: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const seedCollections: Collection[] = [
  {
    id: "col-1", userId: "u-free", name: "Robotics reality checks",
    description: "Talks with real deployment numbers, no demo-ware.",
    appearanceIds: ["a-07", "a-12", "a-26"], clipIds: ["cl-021", "cl-031"],
    speakerIds: ["s-priya-raghavan"], topicIds: ["t-robotics"],
    visibility: "private", createdAt: NOW, updatedAt: NOW,
  },
  {
    id: "col-2", userId: "u-pro", name: "Watch this weekend",
    description: "",
    appearanceIds: ["a-03", "a-05"], clipIds: [],
    speakerIds: [], topicIds: [],
    visibility: "private", createdAt: NOW, updatedAt: NOW,
  },
  {
    id: "col-3", userId: "u-pro", name: "Compute economics canon",
    description: "The talks I send to every new analyst on the team.",
    appearanceIds: ["a-01", "a-02", "a-10", "a-17", "a-04"], clipIds: ["cl-001", "cl-005", "cl-029"],
    speakerIds: ["s-mira-chen", "s-ravi-menon"], topicIds: ["t-inference", "t-chips"],
    visibility: "unlisted", createdAt: NOW, updatedAt: NOW,
  },
  {
    id: "col-4", userId: "u-pro", name: "Open-model economics",
    description: "Who pays for open weights — the whole debate.",
    appearanceIds: ["a-05", "a-23", "a-14"], clipIds: ["cl-052", "cl-018"],
    speakerIds: ["s-tomas-reyes", "s-nadia-petrova"], topicIds: ["t-open-source-models"],
    visibility: "private", createdAt: NOW, updatedAt: NOW,
  },
];

export const seedReminders: Reminder[] = [
  {
    id: "rem-1", userId: "u-free", eventId: null, appearanceId: "a-40",
    reminderTime: "2026-07-15T16:30:00Z", deliveryChannels: ["in-app"], status: "scheduled",
  },
  {
    id: "rem-2", userId: "u-pro", eventId: null, appearanceId: "a-34",
    reminderTime: "2026-07-18T17:30:00Z", deliveryChannels: ["in-app", "email"], status: "scheduled",
  },
  {
    id: "rem-3", userId: "u-pro", eventId: "e-ascent", appearanceId: null,
    reminderTime: "2026-09-14T16:00:00Z", deliveryChannels: ["email", "push"], status: "scheduled",
  },
];

export const seedNotifications: AppNotification[] = [
  {
    id: "n-01", userId: "u-free", type: "new-appearance",
    title: "Mira Chen announced a new appearance",
    body: "The Substrate Live: Mira Chen — streaming July 15.",
    linkedEntityType: "appearance", linkedEntityId: "a-40", isRead: false,
    createdAt: "2026-07-08T14:00:00Z",
  },
  {
    id: "n-02", userId: "u-free", type: "recording-available",
    title: "New recording",
    body: "Trellis Loom: General Availability is now available to watch.",
    linkedEntityType: "appearance", linkedEntityId: "a-03", isRead: false,
    createdAt: "2026-06-25T10:00:00Z",
  },
  {
    id: "n-03", userId: "u-free", type: "event-starting",
    title: "DevTools Live begins soon",
    body: "Shipping Agent-Native IDEs starts July 18 at 11:00 AM PT.",
    linkedEntityType: "appearance", linkedEntityId: "a-34", isRead: true,
    createdAt: "2026-07-09T09:00:00Z",
  },
  {
    id: "n-04", userId: "u-free", type: "new-clip",
    title: "New clip from Priya Raghavan",
    body: "“Our robots fail at doors, tape, and Mondays” — from Robots That Pay Rent.",
    linkedEntityType: "clip", linkedEntityId: "cl-021", isRead: true,
    createdAt: "2026-06-14T12:00:00Z",
  },
  {
    id: "n-05", userId: "u-pro", type: "insight-brief-ready",
    title: "New insight brief",
    body: "Insight brief published for The Real Cost of a Token — 4 applicable categories.",
    linkedEntityType: "appearance", linkedEntityId: "a-01", isRead: false,
    createdAt: "2026-07-02T08:00:00Z",
  },
  {
    id: "n-06", userId: "u-pro", type: "related-signal",
    title: "Related signal detected",
    body: "The power-first framing in Mira Chen's keynote recurs across 3 other talks you've saved.",
    linkedEntityType: "appearance", linkedEntityId: "a-02", isRead: false,
    createdAt: "2026-07-03T08:00:00Z",
  },
  {
    id: "n-07", userId: "u-pro", type: "transcript-ready",
    title: "Transcript processed",
    body: "Tomás Reyes: Publishing the Failures now has a searchable transcript.",
    linkedEntityType: "appearance", linkedEntityId: "a-14", isRead: true,
    createdAt: "2026-06-20T16:00:00Z",
  },
  {
    id: "n-08", userId: "u-pro", type: "schedule-change",
    title: "Schedule change",
    body: "Interconnect Roadmaps, Off Script moved to Sept 16 at Ascent 2026.",
    linkedEntityType: "appearance", linkedEntityId: "a-32", isRead: false,
    createdAt: "2026-07-06T11:00:00Z",
  },
  {
    id: "n-09", userId: "u-pro", type: "livestream-available",
    title: "Livestream link available",
    body: "Loom Field Day (July 30) now has a livestream link.",
    linkedEntityType: "appearance", linkedEntityId: "a-37", isRead: true,
    createdAt: "2026-07-05T15:00:00Z",
  },
  {
    id: "n-10", userId: "u-free", type: "schedule-change",
    title: "Session cancelled",
    body: "The Grid Interconnect Queue Crisis panel at EnergyTech World was cancelled by the organizer.",
    linkedEntityType: "appearance", linkedEntityId: "a-31", isRead: false,
    createdAt: "2026-07-07T13:00:00Z",
  },
];

export const seedViewingProgress: Record<string, ViewingProgress[]> = {
  "u-free": [
    { appearanceId: "a-07", positionSeconds: 2210, durationSeconds: 4440, updatedAt: "2026-07-08T21:00:00Z" },
    { appearanceId: "a-03", positionSeconds: 610, durationSeconds: 2820, updatedAt: "2026-07-09T19:00:00Z" },
  ],
  "u-pro": [
    { appearanceId: "a-01", positionSeconds: 2900, durationSeconds: 3720, updatedAt: "2026-07-09T22:00:00Z" },
    { appearanceId: "a-08", positionSeconds: 1500, durationSeconds: 4080, updatedAt: "2026-07-07T20:00:00Z" },
    { appearanceId: "a-23", positionSeconds: 300, durationSeconds: 3120, updatedAt: "2026-07-04T18:00:00Z" },
  ],
};

/* Seed pricing — editable configuration, not a committed business decision. */
export const seedPlans: PlanConfig[] = [
  {
    tier: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    followLimit: 5,
    collectionLimit: 1,
    reminderLimit: 1,
    features: [
      "Browse the complete discovery platform",
      "Basic summaries on every processed talk",
      "Selected clips",
      "Follow up to 5 speakers, topics, or companies",
      "1 album",
      "3 active reminders",
      "Upcoming-event access",
    ],
  },
  {
    tier: "pro",
    name: "Premium",
    monthlyPriceUsd: 20,
    annualPriceUsd: 144,
    followLimit: null,
    collectionLimit: null,
    reminderLimit: null,
    features: [
      "Complete insight briefs on applicable talks",
      "Unlimited follows and albums",
      "Advanced transcript search",
      "Related-signal exploration",
      "Personalized alerts",
      "Advanced filters",
      "Export and sharing tools",
      "Advanced reminders (email + push)",
    ],
  },
];
