export const PRODUCTION_SCHEDULES = [
  { id: "youtube-websub-renewal", cadence: "daily", localTime: "03:00", paid: false, enabledByDefault: false, description: "Renew expiring YouTube WebSub leases." },
  { id: "youtube-daily-reconciliation", cadence: "daily", localTime: "04:00", paid: false, enabledByDefault: false, description: "Check each upload playlist from its stored cursor." },
  { id: "pipeline-retries-cleanup", cadence: "daily", localTime: "04:30", paid: false, enabledByDefault: false, description: "Claim due retries and purge expired temporary records." },
  { id: "weekly-upcoming-and-gaps", cadence: "weekly", localTime: "Sunday 04:00", paid: true, enabledByDefault: false, description: "Scan the next 30 days, narrow event URLs, Tavily gaps, and Grok X safety groups." },
  { id: "quarterly-source-assets", cadence: "quarterly", localTime: "first Sunday 05:00", paid: false, enabledByDefault: false, description: "Review stale sources, entity assets, and vidIQ research reminder." },
  { id: "daily-encrypted-backup", cadence: "daily", localTime: "02:00", paid: false, enabledByDefault: false, description: "Export an encrypted database backup to R2." },
  { id: "monthly-restore-drill", cadence: "monthly", localTime: "first Monday 02:00", paid: false, enabledByDefault: false, description: "Restore the latest backup into an isolated database and verify row counts." },
] as const;

export const BACKFILL_DEFAULTS = {
  dateFrom: "2026-01-01T00:00:00.000Z",
  batchSize: 25,
  maximumCandidates: 5_000,
  maximumUsd: 10,
  dryRun: true,
} as const;
