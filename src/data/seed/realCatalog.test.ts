import { describe, expect, it } from "vitest";
import { getSeedDb } from "@/data/seed";

describe("real public catalog", () => {
  const db = getSeedDb();

  it("contains the reviewed real entity set", () => {
    expect(db.speakers).toHaveLength(28);
    expect(db.companies.length).toBeGreaterThanOrEqual(18);
    expect(db.events.length).toBeGreaterThanOrEqual(12);
    expect(db.appearances).toHaveLength(40);
    expect(db.speakers.some((speaker) => speaker.name === "Jensen Huang")).toBe(true);
    expect(db.companies.some((company) => company.name === "NVIDIA")).toBe(true);
  });

  it("never attaches fictional authored media to real people", () => {
    expect(db.transcripts).toEqual([]);
    expect(db.clips).toEqual([]);
    expect(db.insightBriefs).toEqual([]);
    expect(db.insights).toEqual([]);
    expect(db.appearances.every((appearance) => appearance.status === "processing" && appearance.transcriptId === null)).toBe(true);
  });

  it("uses only confirmed HTTPS canonical sources", () => {
    expect(db.mediaSources.length).toBe(db.appearances.length);
    expect(db.mediaSources.every((source) => source.sourceUrl.startsWith("https://") && !source.sourceUrl.includes("example.com"))).toBe(true);
  });
});
