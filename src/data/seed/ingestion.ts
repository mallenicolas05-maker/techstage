import type {
  IngestionCandidate,
  IngestionLogEntry,
  IngestionStage,
  IngestionStatus,
  StageState,
} from "@/domain/types";

/* Ingestion queue seed — demonstrates every pipeline status the
   admin workflow needs to handle. Stage lists are generated from
   the canonical pipeline order with a cursor. */

export const PIPELINE_ORDER: IngestionStage[] = [
  "discover-source",
  "create-candidate",
  "normalize-metadata",
  "detect-duplicates",
  "match-entities",
  "verify-source",
  "acquire-transcript",
  "segment-transcript",
  "identify-speakers",
  "identify-chapters",
  "identify-highlights",
  "generate-summary",
  "insight-applicability",
  "generate-insights",
  "attach-evidence",
  "link-related",
  "review-queue",
  "publish",
  "recheck-source",
];

export const STAGE_LABELS: Record<IngestionStage, string> = {
  "discover-source": "Discover source",
  "create-candidate": "Create candidate",
  "normalize-metadata": "Normalize metadata",
  "detect-duplicates": "Detect duplicates",
  "match-entities": "Match speakers / companies / events",
  "verify-source": "Verify source",
  "acquire-transcript": "Acquire transcript",
  "segment-transcript": "Segment transcript",
  "identify-speakers": "Identify speakers",
  "identify-chapters": "Identify chapters",
  "identify-highlights": "Identify highlights",
  "generate-summary": "Generate summary",
  "insight-applicability": "Insight applicability",
  "generate-insights": "Generate insights",
  "attach-evidence": "Attach evidence",
  "link-related": "Link related",
  "review-queue": "Review queue",
  publish: "Publish",
  "recheck-source": "Recheck source",
};

/** Build a stage list: everything before the cursor is done, the
    cursor stage gets the given status, everything after is pending. */
const stagesUpTo = (
  cursor: IngestionStage,
  cursorStatus: StageState["status"],
  opts?: { error?: string; retryCount?: number; review?: boolean }
): StageState[] => {
  const idx = PIPELINE_ORDER.indexOf(cursor);
  return PIPELINE_ORDER.map((stage, i) => ({
    stage,
    status: i < idx ? "done" : i === idx ? cursorStatus : "pending",
    startedAt: i <= idx ? "2026-07-05T10:00:00Z" : null,
    completedAt: i < idx ? "2026-07-05T10:20:00Z" : null,
    retryCount: i === idx ? (opts?.retryCount ?? 0) : 0,
    requiresHumanReview: i === idx ? (opts?.review ?? false) : stage === "review-queue",
    error: i === idx ? (opts?.error ?? null) : null,
  }));
};

const log = (
  stage: IngestionStage,
  level: IngestionLogEntry["level"],
  message: string,
  at = "2026-07-05T10:00:00Z"
): IngestionLogEntry => ({ at, stage, level, message });

interface CandidateSeed {
  id: string;
  sourceKind: IngestionCandidate["sourceKind"];
  sourceUrl: string;
  rawTitle: string;
  detectedSpeakerNames: string[];
  matchedSpeakerIds?: string[];
  matchedEventId?: string | null;
  matchedCompanyIds?: string[];
  duplicateOf?: string | null;
  status: IngestionStatus;
  cursor: IngestionStage;
  cursorStatus: StageState["status"];
  logs: IngestionLogEntry[];
  resultingAppearanceId?: string | null;
  submittedBy?: string | null;
  error?: string;
  retryCount?: number;
  review?: boolean;
}

const cand = (c: CandidateSeed): IngestionCandidate => ({
  id: c.id,
  sourceKind: c.sourceKind,
  sourceUrl: c.sourceUrl,
  rawTitle: c.rawTitle,
  detectedSpeakerNames: c.detectedSpeakerNames,
  matchedSpeakerIds: c.matchedSpeakerIds ?? [],
  matchedEventId: c.matchedEventId ?? null,
  matchedCompanyIds: c.matchedCompanyIds ?? [],
  duplicateOfAppearanceId: c.duplicateOf ?? null,
  status: c.status,
  currentStage: c.cursor,
  stages: stagesUpTo(c.cursor, c.cursorStatus, {
    error: c.error,
    retryCount: c.retryCount,
    review: c.review,
  }),
  logs: c.logs,
  resultingAppearanceId: c.resultingAppearanceId ?? null,
  submittedBy: c.submittedBy ?? null,
  createdAt: "2026-07-04T09:00:00Z",
  updatedAt: "2026-07-08T09:00:00Z",
});

export const seedIngestionCandidates: IngestionCandidate[] = [
  cand({
    id: "ing-01",
    sourceKind: "youtube-api",
    sourceUrl: "#",
    rawTitle: "FULL PANEL: The Future of AI Chips | Ascent Preview Show",
    detectedSpeakerNames: ["Mira Chen", "Sam Whitfield"],
    matchedSpeakerIds: ["s-mira-chen", "s-sam-whitfield"],
    status: "discovered",
    cursor: "create-candidate",
    cursorStatus: "pending",
    logs: [
      log("discover-source", "info", "Discovered via channel poll: Ascent Events (uploads playlist)."),
    ],
  }),
  cand({
    id: "ing-02",
    sourceKind: "conference-site",
    sourceUrl: "#",
    rawTitle: "EnergyTech World agenda update — 3 new sessions detected",
    detectedSpeakerNames: ["Ingrid Solheim", "unknown panelist"],
    matchedSpeakerIds: ["s-ingrid-solheim"],
    matchedEventId: "e-energytech",
    status: "queued",
    cursor: "normalize-metadata",
    cursorStatus: "pending",
    logs: [
      log("discover-source", "info", "Agenda diff detected on scheduled crawl."),
      log("create-candidate", "info", "Candidate created from agenda row 14."),
    ],
  }),
  cand({
    id: "ing-03",
    sourceKind: "youtube-api",
    sourceUrl: "#",
    rawTitle: "Keynote: Autonomy & the Industrial Base — Frontier Robotics Forum",
    detectedSpeakerNames: ["Viktor Hessel"],
    matchedSpeakerIds: ["s-viktor-hessel"],
    matchedEventId: "e-frontier-robotics",
    matchedCompanyIds: ["c-meridian"],
    status: "processing",
    cursor: "segment-transcript",
    cursorStatus: "running",
    resultingAppearanceId: "a-11",
    logs: [
      log("acquire-transcript", "info", "No official captions; queued ASR job."),
      log("segment-transcript", "info", "ASR at 41% — est. 22 min remaining.", "2026-07-08T08:40:00Z"),
    ],
  }),
  cand({
    id: "ing-04",
    sourceKind: "manual-submission",
    sourceUrl: "#",
    rawTitle: "Jae-won Park margin model talk (audience recording?)",
    detectedSpeakerNames: ["Jae-won Park"],
    matchedSpeakerIds: ["s-jaewon-park"],
    status: "needs-review",
    cursor: "verify-source",
    cursorStatus: "awaiting-review",
    review: true,
    submittedBy: "community",
    logs: [
      log("verify-source", "warn", "Uploader is not the rights holder. Rights status set to pending-review."),
      log("verify-source", "warn", "Audio fingerprint matches a-21 at 0.71 similarity — possible duplicate, below auto-merge threshold."),
    ],
  }),
  cand({
    id: "ing-05",
    sourceKind: "podcast-feed",
    sourceUrl: "#",
    rawTitle: "The Substrate #58 — D. Okafor returns",
    detectedSpeakerNames: ["Dario Okafor", "Elliot Shore"],
    matchedSpeakerIds: ["s-dario-okafor", "s-elliot-shore"],
    matchedEventId: "e-substrate-pod",
    duplicateOf: "a-15",
    status: "rejected",
    cursor: "detect-duplicates",
    cursorStatus: "done",
    logs: [
      log("detect-duplicates", "info", "Exact duplicate of a-15 (feed re-published with new GUID). Auto-rejected."),
    ],
  }),
  cand({
    id: "ing-06",
    sourceKind: "university-calendar",
    sourceUrl: "#",
    rawTitle: "Overstory Lecture: Deployment Evals — A Field Guide (Tanaka)",
    detectedSpeakerNames: ["Yuki Tanaka"],
    matchedSpeakerIds: ["s-yuki-tanaka"],
    matchedEventId: "e-overstory-lectures",
    matchedCompanyIds: ["c-overstory"],
    status: "published",
    cursor: "recheck-source",
    cursorStatus: "pending",
    resultingAppearanceId: "a-36",
    logs: [
      log("publish", "info", "Published as upcoming appearance a-36."),
      log("recheck-source", "info", "Next recheck scheduled for 2026-07-15."),
    ],
  }),
  cand({
    id: "ing-07",
    sourceKind: "livestream-announcement",
    sourceUrl: "#",
    rawTitle: "Corvid Robotics — Fieldhand Atlas live demo announcement",
    detectedSpeakerNames: ["Priya Raghavan", "Owen Gallagher"],
    matchedSpeakerIds: ["s-priya-raghavan", "s-owen-gallagher"],
    matchedCompanyIds: ["c-corvid"],
    status: "approved",
    cursor: "publish",
    cursorStatus: "pending",
    resultingAppearanceId: "a-39",
    logs: [
      log("review-queue", "info", "Approved by editor; scheduled to publish with reminder support."),
    ],
  }),
  cand({
    id: "ing-08",
    sourceKind: "rss",
    sourceUrl: "#",
    rawTitle: "Compute & Power Symposium — Liang session upload",
    detectedSpeakerNames: ["David Liang"],
    matchedSpeakerIds: ["s-david-liang"],
    matchedEventId: "e-compute-power",
    status: "failed",
    cursor: "acquire-transcript",
    cursorStatus: "failed",
    error: "Source returned 410 Gone on 3 consecutive attempts.",
    retryCount: 3,
    logs: [
      log("acquire-transcript", "error", "Fetch failed (410 Gone). Retry 1/3.", "2026-07-06T02:00:00Z"),
      log("acquire-transcript", "error", "Fetch failed (410 Gone). Retry 2/3.", "2026-07-06T06:00:00Z"),
      log("acquire-transcript", "error", "Fetch failed (410 Gone). Retry 3/3 — giving up. Organizer confirms session was not recorded.", "2026-07-06T10:00:00Z"),
    ],
  }),
  cand({
    id: "ing-09",
    sourceKind: "social-announcement",
    sourceUrl: "#",
    rawTitle: "Lattice post: 'Mira joins The Substrate live next week'",
    detectedSpeakerNames: ["Mira Chen", "Elliot Shore"],
    matchedSpeakerIds: ["s-mira-chen", "s-elliot-shore"],
    matchedEventId: "e-substrate-pod",
    status: "needs-review",
    cursor: "match-entities",
    cursorStatus: "awaiting-review",
    review: true,
    logs: [
      log("match-entities", "warn", "Date parsed as 'next week' — ambiguous. Needs human confirmation against a-40."),
    ],
  }),
  cand({
    id: "ing-10",
    sourceKind: "uploaded-transcript",
    sourceUrl: "#",
    rawTitle: "Proteins as Programs — attendee transcript upload",
    detectedSpeakerNames: ["Amara Diallo"],
    matchedSpeakerIds: ["s-amara-diallo"],
    matchedEventId: "e-substrate-summit",
    status: "archived",
    cursor: "verify-source",
    cursorStatus: "skipped",
    submittedBy: "attendee",
    logs: [
      log("verify-source", "info", "Archived: official recording expected from organizer; attendee transcript retained for diff QA."),
    ],
  }),
];
