import { describe, expect, it } from "vitest";
import { assertBudget, defaultMonthlyBudget, estimateTranscriptAnalysis, estimateYouTubeVideoAnalysis } from "@/backend/costs";

describe("cost controls", () => {
  it("estimates concise transcript analysis without retaining content", () => {
    const estimate = estimateTranscriptAnalysis("[00:01] " + "technology panel discussion ".repeat(1_000));
    expect(estimate.route).toBe("pasted-transcript");
    expect(estimate.model).toBe("gpt-5-nano");
    expect(estimate.timestampsAvailable).toBe(true);
    expect(estimate.estimatedUsd).toBeLessThan(0.01);
  });

  it("prices a low-resolution hour-long video below the manual approval ceiling", () => {
    const estimate = estimateYouTubeVideoAnalysis(3_600, "low");
    expect(estimate.approvalRequired).toBe(true);
    expect(estimate.timestampsAvailable).toBe(true);
    expect(estimate.estimatedUsd).not.toBeNull();
  });

  it("blocks the first Grok operation that would cross the $5 cap", () => {
    const budget = { ...defaultMonthlyBudget("grok-x", "2026-08-01T00:00:00Z"), usedUsd: 4.95 };
    expect(() => assertBudget(budget, { usd: 0.06 })).toThrow(/budget blocked/i);
  });
});
