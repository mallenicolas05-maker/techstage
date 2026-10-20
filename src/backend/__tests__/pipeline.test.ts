import { describe, expect, it } from "vitest";
import { analyzeEphemeralInput, assertValidJobTransition, createPipelineJobs } from "@/backend/pipeline";
import { MockAnalysisProvider } from "@/backend/providers/mock";

const context = { dryRun: true, idempotencyKey: "test", maximumUsd: 0 };

describe("production pipeline", () => {
  it("creates the complete ordered job chain", () => {
    const jobs = createPipelineJobs("candidate-1", "2026-01-01T00:00:00Z");
    expect(jobs).toHaveLength(18);
    expect(jobs[0].status).toBe("queued");
    expect(jobs.slice(1).every((job) => job.status === "blocked")).toBe(true);
  });

  it("rejects invalid state jumps", () => {
    expect(() => assertValidJobTransition("queued", "complete")).toThrow(/invalid pipeline/i);
  });

  it("returns only validated artifacts and strips X timestamps", async () => {
    const provider = new MockAnalysisProvider({
      id: "artifact-x", candidateId: "candidate-x", route: "x-video", model: "mock", promptVersion: "v1",
      summary: "Summary", appearanceType: "panel", speakerNames: [], companyNames: [], eventName: null, topics: [],
      chapters: [], highlights: [{ title: "Moment", summary: "Detail", startSeconds: 10, endSeconds: 20, kind: "highlight" }],
      evidence: [], confidence: 0.9, generatedAt: "2026-01-01T00:00:00Z", rawInputRetained: false, rawResponseRetained: false,
    });
    const artifact = await analyzeEphemeralInput({ route: "x-video", candidateId: "candidate-x", sourceUrl: "https://x.com/a/status/1" }, provider, context);
    expect(artifact.highlights[0].startSeconds).toBeNull();
    expect(artifact.rawInputRetained).toBe(false);
  });

  it("fails closed on malformed structured output", async () => {
    const provider = new MockAnalysisProvider({ summary: "bad" } as never);
    await expect(analyzeEphemeralInput({ route: "pasted-transcript", candidateId: "c", sourceUrl: "https://youtube.com/watch?v=1", transcript: "long transcript ".repeat(10) }, provider, context)).rejects.toThrow();
  });
});

