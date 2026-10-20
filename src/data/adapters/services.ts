import type {
  AnalyticsAdapter,
  AuthAdapter,
  MediaAdapter,
  NotificationAdapter,
  SummaryAdapter,
  SubscriptionAdapter,
  TranscriptAdapter,
} from "@/data/repositories/contracts";
import type { BriefRecord, MediaSource, User } from "@/domain/types";
import { getDemoDb as getSeedDb } from "@/data/seed";
import { AI_BRIEF_PROMPT_VERSION, assembleBriefRecord } from "@/data/aiBrief";
import { briefRecordSchema } from "@/domain/validation";

/* Local implementations of the provider-neutral service contracts.
   Every one of these is a MOCK — see CODEX_HANDOFF.md §6 for what
   replaces each in production. */

/** MOCK auth — resolves demo seed users. Production: Supabase Auth. */
class LocalAuthAdapter implements AuthAdapter {
  async getSessionUser(userId: string | null): Promise<User | null> {
    if (!userId) return null;
    return getSeedDb().users.find((u) => u.id === userId) ?? null;
  }
}

/** MOCK subscription — mirrors the seed user's tier. Production: Stripe entitlements. */
class LocalSubscriptionAdapter implements SubscriptionAdapter {
  async getEntitledTier(userId: string): Promise<"free" | "pro"> {
    return getSeedDb().users.find((u) => u.id === userId)?.subscriptionTier ?? "free";
  }
}

/** MOCK media resolution — honors seed rights flags; never rehosts. */
class LocalMediaAdapter implements MediaAdapter {
  async resolveEmbed(source: MediaSource) {
    if (!source.embedAllowed || !source.embedUrl) {
      return {
        embedUrl: null,
        reason:
          source.rightsStatus === "restricted"
            ? "Embedding restricted by the rights holder — watch at the original source."
            : "No permitted embed for this source — link out to the original.",
      };
    }
    try {
      const url = new URL(source.embedUrl);
      const isApprovedYouTube =
        url.protocol === "https:" &&
        url.hostname === "www.youtube-nocookie.com" &&
        /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname);
      if (!isApprovedYouTube) {
        return { embedUrl: null, reason: "This recording has not passed the approved embed check." };
      }
      return { embedUrl: url.toString(), reason: null };
    } catch {
      return { embedUrl: null, reason: "This recording has an invalid embed URL." };
    }
  }
}

/** MOCK transcription request — production queues an ASR job. */
class LocalTranscriptAdapter implements TranscriptAdapter {
  async requestTranscription(_appearanceId: string) {
    return { queued: false };
  }
}

class LocalSummaryAdapter implements SummaryAdapter {
  async getBrief(appearanceId: string): Promise<BriefRecord | null> {
    const key = `techstage.brief.${appearanceId}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = briefRecordSchema.safeParse(JSON.parse(cached));
        if (parsed.success && parsed.data.promptVersion === AI_BRIEF_PROMPT_VERSION) return parsed.data;
      } catch {
        localStorage.removeItem(key);
      }
    }
    const db = getSeedDb();
    const appearance = db.appearances.find((row) => row.id === appearanceId);
    if (!appearance) return null;
    const transcript = db.transcripts.find((row) => row.appearanceId === appearanceId) ?? null;
    const sourceBrief = db.insightBriefs.find((row) => row.appearanceId === appearanceId);
    const insights = sourceBrief ? db.insights.filter((row) => row.insightBriefId === sourceBrief.id) : [];
    return this.saveBrief(assembleBriefRecord(appearance, transcript, insights));
  }

  async saveBrief(record: BriefRecord): Promise<BriefRecord> {
    localStorage.setItem(`techstage.brief.${record.appearanceId}`, JSON.stringify(record));
    return record;
  }
}

/** MOCK reminder delivery — production schedules email/push. */
class LocalNotificationAdapter implements NotificationAdapter {
  async scheduleReminder(_reminder: {
    appearanceId: string | null;
    eventId: string | null;
    at: string;
  }) {
    return { scheduled: true };
  }
}

/** MOCK analytics — console-only in dev. Production: product analytics provider. */
class LocalAnalyticsAdapter implements AnalyticsAdapter {
  track(event: string, props?: Record<string, string | number | boolean>) {
    if (import.meta.env.DEV) console.debug(`[analytics] ${event}`, props ?? {});
  }
}

export const authAdapter: AuthAdapter = new LocalAuthAdapter();
export const subscriptionAdapter: SubscriptionAdapter = new LocalSubscriptionAdapter();
export const mediaAdapter: MediaAdapter = new LocalMediaAdapter();
export const transcriptAdapter: TranscriptAdapter = new LocalTranscriptAdapter();
export const summaryAdapter: SummaryAdapter = new LocalSummaryAdapter();
export const notificationAdapter: NotificationAdapter = new LocalNotificationAdapter();
export const analyticsAdapter: AnalyticsAdapter = new LocalAnalyticsAdapter();
