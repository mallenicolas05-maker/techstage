import type {
  Appearance,
  AppNotification,
  Chapter,
  Clip,
  Collection,
  Company,
  Event,
  IngestionCandidate,
  InsightBrief,
  Insight,
  MediaSource,
  PlanConfig,
  Reminder,
  Speaker,
  StandoutMoment,
  Topic,
  Transcript,
  User,
  ViewingProgress,
} from "@/domain/types";
import {
  appearanceSchema,
  clipSchema,
  companySchema,
  eventSchema,
  ingestionCandidateSchema,
  insightBriefSchema,
  insightSchema,
  mediaSourceSchema,
  speakerSchema,
  topicSchema,
  transcriptSchema,
  userSchema,
} from "@/domain/validation";
import { seedTopics } from "./topics";
import {
  seedAppearances as realAppearances,
  seedChapters as realChapters,
  seedCompanies as realCompanies,
  seedEvents as realEvents,
  seedMediaSources as realMediaSources,
  seedSpeakers as realSpeakers,
} from "./realCatalog";
import {
  seedAppearances as demoAppearances,
  seedChapters as demoChapters,
  seedMediaSources as demoMediaSources,
} from "./appearances";
import { seedCompanies as demoCompanies } from "./companies";
import { seedSpeakers as demoSpeakers } from "./speakers";
import { seedEvents as demoEvents } from "./events";
import { seedClips } from "./clips";
import { seedTranscripts } from "./transcripts";
import { seedInsightBriefs, seedInsights } from "./insights";
import {
  seedCollections,
  seedNotifications,
  seedPlans,
  seedReminders,
  seedUsers,
  seedViewingProgress,
} from "./users";
import { seedIngestionCandidates } from "./ingestion";

// Keep the researched catalog and the authored product demo side-by-side. Demo
// transcripts and clips remain attached only to demo appearances; they are
// never presented as sourced material for a real person or event.
const mergeById = <T extends { id: string }>(...groups: T[][]): T[] => {
  const rows = new Map<string, T>();
  for (const group of groups) for (const row of group) rows.set(row.id, row);
  return [...rows.values()];
};

export interface SeedDb {
  topics: Topic[];
  companies: Company[];
  speakers: Speaker[];
  events: Event[];
  appearances: Appearance[];
  mediaSources: MediaSource[];
  chapters: Chapter[];
  clips: Clip[];
  standoutMoments: StandoutMoment[];
  transcripts: Transcript[];
  insightBriefs: InsightBrief[];
  insights: Insight[];
  users: User[];
  collections: Collection[];
  reminders: Reminder[];
  notifications: AppNotification[];
  viewingProgress: Record<string, ViewingProgress[]>;
  plans: PlanConfig[];
  ingestionCandidates: IngestionCandidate[];
}

/* Appearances are the authored source of truth for graph edges.
   All reverse links (speaker→appearances, event→speakers,
   topic→companies, …) are derived here so the graph can never
   drift out of sync. Attachments (clips, chapters, transcripts,
   briefs) are joined by appearanceId. */
function assemble(includeDemo = false): SeedDb {
  const appearances = (includeDemo ? mergeById(realAppearances, demoAppearances) : realAppearances).map((a) => ({ ...a, clipIds: [...a.clipIds], chapterIds: [...a.chapterIds], relatedAppearanceIds: [...a.relatedAppearanceIds] }));
  const speakers = (includeDemo ? mergeById(realSpeakers, demoSpeakers) : realSpeakers).map((s) => ({ ...s, appearanceIds: [...s.appearanceIds], upcomingAppearanceIds: [...s.upcomingAppearanceIds] }));
  const companies = (includeDemo ? mergeById(realCompanies, demoCompanies) : realCompanies).map((c) => ({ ...c, appearanceIds: [...c.appearanceIds], productLaunchIds: [...c.productLaunchIds], speakerIds: [...c.speakerIds] }));
  const events = (includeDemo ? mergeById(realEvents, demoEvents) : realEvents).map((e) => ({ ...e, appearanceIds: [...e.appearanceIds], speakerIds: [...e.speakerIds] }));
  const topics = seedTopics.map((t) => ({ ...t }));
  const chapters = includeDemo ? mergeById(realChapters, demoChapters) : realChapters;
  const mediaSources = includeDemo ? mergeById(realMediaSources, demoMediaSources) : realMediaSources;
  const clips = includeDemo ? seedClips : [];
  const transcripts = includeDemo ? seedTranscripts : [];
  const insightBriefs = includeDemo ? seedInsightBriefs : [];
  const insights = includeDemo ? seedInsights : [];
  const standoutMoments: StandoutMoment[] = clips
    .filter((clip) => clip.clipType !== "demo")
    .map((clip) => ({
      id: `moment-${clip.id}`,
      appearanceId: clip.appearanceId,
      title: clip.title,
      description: clip.description || "An editorially selected moment from the full conversation.",
      startTime: clip.startTime,
      speakerIds: [...clip.speakerIds],
      topicIds: [...clip.topicIds],
      kind: clip.clipType === "demo" ? "highlight" : clip.clipType,
      popularityScore: clip.popularityScore,
    }));

  const byId = <T extends { id: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.id, r]));

  const appearanceById = byId(appearances);
  const speakerById = byId(speakers);
  const companyById = byId(companies);
  const eventById = byId(events);
  const topicById = byId(topics);

  /* Attach clips / chapters / transcripts / briefs to appearances */
  for (const clip of clips) {
    appearanceById.get(clip.appearanceId)?.clipIds.push(clip.id);
  }
  for (const chapter of chapters) {
    appearanceById.get(chapter.appearanceId)?.chapterIds.push(chapter.id);
  }
  for (const transcript of transcripts) {
    const a = appearanceById.get(transcript.appearanceId);
    if (a) a.transcriptId = transcript.id;
  }
  for (const brief of insightBriefs) {
    const a = appearanceById.get(brief.appearanceId);
    if (a) a.premiumInsightBriefId = brief.id;
  }

  /* Derive reverse links from appearances */
  const push = (arr: string[], id: string) => {
    if (!arr.includes(id)) arr.push(id);
  };
  for (const a of appearances) {
    const isUpcoming =
      a.status === "upcoming" || a.status === "rescheduled" || a.status === "live";
    for (const sid of a.speakerIds) {
      const s = speakerById.get(sid);
      if (!s) continue;
      push(s.appearanceIds, a.id);
      if (isUpcoming) push(s.upcomingAppearanceIds, a.id);
    }
    for (const cid of a.companyIds) {
      const c = companyById.get(cid);
      if (!c) continue;
      push(c.appearanceIds, a.id);
      if (a.appearanceType === "product-launch") push(c.productLaunchIds, a.id);
    }
    if (a.eventId) {
      const e = eventById.get(a.eventId);
      if (e) {
        push(e.appearanceIds, a.id);
        for (const sid of a.speakerIds) push(e.speakerIds, sid);
      }
    }
    for (const tid of a.topicIds) {
      const t = topicById.get(tid);
      if (!t) continue;
      push(t.appearanceIds, a.id);
      for (const sid of a.speakerIds) push(t.speakerIds, sid);
      for (const cid of a.companyIds) push(t.companyIds, cid);
    }
  }

  /* Company ↔ speaker links from speaker affiliations */
  for (const s of speakers) {
    for (const cid of s.companyIds) {
      const c = companyById.get(cid);
      if (c) push(c.speakerIds, s.id);
    }
    /* Fill role-history company names */
    for (const r of s.roleHistory) {
      if (!r.companyName && r.companyId) {
        r.companyName = companyById.get(r.companyId)?.name ?? "";
      }
    }
  }

  /* Make related-appearance links symmetric */
  for (const a of appearances) {
    for (const rid of a.relatedAppearanceIds) {
      const other = appearanceById.get(rid);
      if (other && other.id !== a.id) push(other.relatedAppearanceIds, a.id);
    }
  }
  for (const a of appearances) {
    a.relatedAppearanceIds = a.relatedAppearanceIds.filter((rid) => rid !== a.id);
  }

  return {
    topics,
    companies,
    speakers,
    events,
    appearances,
    mediaSources,
    chapters,
    clips,
    standoutMoments,
    transcripts,
    insightBriefs,
    insights,
    users: includeDemo ? seedUsers : seedUsers.map((user) => ({
      ...user,
      followedSpeakerIds: user.followedSpeakerIds.filter((id) => speakerById.has(id)),
      followedCompanyIds: user.followedCompanyIds.filter((id) => companyById.has(id)),
      savedAppearanceIds: [],
      savedClipIds: [],
      collectionIds: [],
    })),
    collections: includeDemo ? seedCollections : [],
    reminders: seedReminders.filter((reminder) =>
      (!reminder.appearanceId || appearanceById.has(reminder.appearanceId)) &&
      (!reminder.eventId || eventById.has(reminder.eventId))
    ),
    notifications: includeDemo ? seedNotifications : [],
    viewingProgress: includeDemo ? seedViewingProgress : {},
    plans: seedPlans,
    ingestionCandidates: seedIngestionCandidates,
  };
}

/** Validate the assembled seed against the zod schemas.
    Throws with a readable message in dev if seed data drifts. */
function validate(db: SeedDb): SeedDb {
  const check = <T>(rows: T[], schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, label: string) => {
    for (const row of rows) {
      const res = schema.safeParse(row);
      if (!res.success) {
        console.error(`[seed] invalid ${label}:`, row, res.error);
        throw new Error(`Seed validation failed for ${label}`);
      }
    }
  };
  check(db.topics, topicSchema, "topic");
  check(db.companies, companySchema, "company");
  check(db.speakers, speakerSchema, "speaker");
  check(db.events, eventSchema, "event");
  check(db.appearances, appearanceSchema, "appearance");
  check(db.mediaSources, mediaSourceSchema, "mediaSource");
  check(db.clips, clipSchema, "clip");
  check(db.transcripts, transcriptSchema, "transcript");
  check(db.insightBriefs, insightBriefSchema, "insightBrief");
  check(db.insights, insightSchema, "insight");
  check(db.users, userSchema, "user");
  check(db.ingestionCandidates, ingestionCandidateSchema, "ingestionCandidate");
  return db;
}

let cached: SeedDb | null = null;
let cachedDemo: SeedDb | null = null;

export function getSeedDb(): SeedDb {
  if (!cached) cached = validate(assemble(false));
  return cached;
}

/** Local UI database: real directory records plus explicitly fictional demo media. */
export function getDemoDb(): SeedDb {
  if (!cachedDemo) cachedDemo = validate(assemble(true));
  return cachedDemo;
}
