import type { Id, IsoDate } from "@/domain/types";

export type DigestStatus =
  | "pending"
  | "generating"
  | "needs_review"
  | "approved"
  | "sending"
  | "sent"
  | "failed";

export type DigestTriggerReason = "panel_threshold" | "freshness_backstop" | "manual";

export interface DigestSource {
  label: string;
  url: string;
}

export interface DigestSpeakerRef {
  id: Id;
  slug: string;
  name: string;
  company: string;
}

export interface DigestSection {
  label: "What was said" | "What it means" | "Where it lands" | "Why it matters to you";
  paragraphs: string[];
  useCases?: string[];
}

export interface DigestPanel {
  id: Id;
  appearanceId: Id;
  appearanceSlug: string;
  title: string;
  event: string;
  occurredAt: IsoDate;
  durationMinutes: number | null;
  speakers: DigestSpeakerRef[];
  imageUrl: string | null;
  imageAlt: string;
  imageCredit: string;
  rightsNote: string;
  sections: DigestSection[];
  source: DigestSource;
  useCaseTopicIds: Id[];
}

export interface DigestIssue {
  id: Id;
  issueNumber: number;
  slug: string;
  status: DigestStatus;
  triggerReason: DigestTriggerReason;
  publishedAt: IsoDate;
  scheduledAt: IsoDate;
  title: string;
  deck: string;
  bigPicture: string;
  readingMinutes: number;
  promptVersion: string;
  templateVersion: string;
  costUsd: number;
  panels: DigestPanel[];
  throughLine: string[];
  agreements: string[];
  tensions: string[];
  watchNext: Array<{ label: string; href: string }>;
}

export interface DigestQueueSnapshot {
  threshold: number;
  maxAgeDays: number;
  pendingPanelIds: Id[];
  oldestPendingAt: IsoDate | null;
  approvalRequired: boolean;
  killSwitchEnabled: boolean;
}
