import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../backfill/appearances-manifest.json", import.meta.url);
const snapshotUrl = new URL("../backfill/resolution-snapshot.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
if (manifest.length !== 40) throw new Error(`Expected 40 manifest entries; received ${manifest.length}`);
if (new Set(manifest.map((item) => item.appearanceSlug)).size !== 40) throw new Error("Duplicate manifest slug");

const price = { textInput: 0.25, videoInput: 0.25, audioInput: 0.50, output: 1.50 };
const outputTokens = 4_096;
const round = (value) => Math.ceil(value * 1_000_000_000) / 1_000_000_000;
const lineItems = manifest.map((item) => {
  const measured = snapshot.items.find((row) => row.appearanceSlug === item.appearanceSlug);
  const route = measured?.route ?? (item.transcriptHint ? "pasted-transcript" : "youtube-video");
  const assumedDurationSeconds = measured?.executionDurationSeconds ?? item.durationSeconds ?? 5_400;
  const assumedTranscriptTokens = 40_000;
  const projectedUsd = route === "pasted-transcript"
    ? assumedTranscriptTokens / 1_000_000 * price.textInput + outputTokens / 1_000_000 * price.output
    : assumedDurationSeconds * 66 / 1_000_000 * price.videoInput + assumedDurationSeconds * 32 / 1_000_000 * price.audioInput + outputTokens / 1_000_000 * price.output;
  return {
    appearanceSlug: item.appearanceSlug,
    status: measured?.status ?? "planned",
    route,
    durationSeconds: item.durationSeconds,
    conservativeDurationSeconds: assumedDurationSeconds,
    projectedUsd: round(projectedUsd),
    paidRetryEligible: measured?.status === "blocked" && /Gemini rejected/i.test(measured?.blockReason ?? ""),
    recoveryAttemptsRemaining: measured?.status === "blocked" && /Gemini rejected/i.test(measured?.blockReason ?? "")
      ? Math.max(0, 3 - Number(measured?.recoveryAttempts ?? 0))
      : 0,
  };
});
const geminiProjectedUsd = round(lineItems.reduce((sum, item) => sum + item.projectedUsd, 0));
const retryProjectionUsd = round(lineItems.filter((item) => item.paidRetryEligible).reduce((sum, item) => sum + item.projectedUsd * item.recoveryAttemptsRemaining, 0));
const geminiActualUsd = Number(snapshot.budgets.gemini.actualUsd);
const completionProjectionUsd = round(geminiActualUsd + retryProjectionUsd);
const result = {
  dryRun: true,
  generatedAt: new Date().toISOString(),
  items: manifest.length,
  transcriptCandidates: lineItems.filter((item) => item.route === "pasted-transcript").length,
  youtubeCandidates: lineItems.filter((item) => item.route === "youtube-video").length,
  youtubeSearchCallsMaximum: manifest.length,
  youtubeValidationCallsMaximum: manifest.length,
  xVideoPilotsMaximum: 2,
  geminiProjectedUsd,
  preResolutionWorstCaseWithinCap: geminiProjectedUsd <= 5,
  verifiedSnapshotCounts: snapshot.counts,
  geminiActualUsd,
  retryProjectionUsd,
  completionProjectionUsd,
  geminiHardCapUsd: 5,
  xaiHardCapUsd: 5,
  zeroCostProviders: ["youtube", "parallel", "tavily", "resend", "supabase", "cloudflare"],
  externalCallsMade: 0,
  withinApprovedCaps: completionProjectionUsd <= 5,
  lineItems,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.withinApprovedCaps) process.exitCode = 2;
