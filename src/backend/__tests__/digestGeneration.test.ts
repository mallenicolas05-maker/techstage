import { describe, expect, it } from "vitest";
import { deterministicDigestDryRun, quoteAppearsVerbatim, validateDigestIssue } from "@/backend/digestGeneration";
import { sampleDigest } from "@/data/digests";

describe("Stage Notes generation gates", () => {
  it("matches quotations after whitespace normalization only", () => {
    expect(quoteAppearsVerbatim("Agents complete work", "Agents\n  complete   work in the background.")).toBe(true);
    expect(quoteAppearsVerbatim("Agents replace every app", "Agents complete work in the background.")).toBe(false);
  });

  it("produces a deterministic dry-run issue that passes local gates", () => {
    const result = deterministicDigestDryRun();
    expect(result.issue.status).toBe("needs_review");
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it("blocks production approval while imagery is missing", () => {
    const imageGate = validateDigestIssue(sampleDigest).find((gate) => gate.gate === "images");
    expect(imageGate?.passed).toBe(false);
  });

  it("blocks hype language and changed heading order", () => {
    const issue = {
      ...sampleDigest,
      deck: "A game-changing report.",
      panels: sampleDigest.panels.map((panel, index) => index ? panel : { ...panel, sections: [...panel.sections].reverse() }),
    };
    const gates = validateDigestIssue(issue, { allowImagePlaceholders: true });
    expect(gates.find((gate) => gate.gate === "banned-phrases")?.passed).toBe(false);
    expect(gates.find((gate) => gate.gate === "heading-order")?.passed).toBe(false);
  });
});

