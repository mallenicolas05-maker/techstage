import { describe, expect, it } from "vitest";
import { selectDigestTrigger } from "@/backend/digestWorkflow";

const panel = (id: string, publishedAt: string, transcript = true, rights = true) => ({ id, publishedAt, hasVerifiedTranscript: transcript, rightsClear: rights });

describe("Stage Notes trigger", () => {
  it("locks the four oldest eligible appearances at the threshold", () => {
    const rows = [1, 2, 3, 4, 5].map((value) => panel(`a-${value}`, `2026-07-0${value}T09:00:00Z`));
    const selection = selectDigestTrigger(rows, new Date("2026-07-06T09:00:00Z"));
    expect(selection?.reason).toBe("panel_threshold");
    expect(selection?.appearanceIds).toEqual(["a-1", "a-2", "a-3", "a-4"]);
  });

  it("keeps a short stack pending after seven days", () => {
    const selection = selectDigestTrigger([panel("a-1", "2026-07-01T09:00:00Z")], new Date("2026-07-08T09:00:01Z"));
    expect(selection).toBeNull();
  });

  it("excludes appearances without a verified transcript or clear rights", () => {
    const rows = [panel("a-1", "2026-07-01T09:00:00Z", false), panel("a-2", "2026-07-01T09:00:00Z", true, false)];
    expect(selectDigestTrigger(rows, new Date("2026-08-01T09:00:00Z"))).toBeNull();
  });
});
