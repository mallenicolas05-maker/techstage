import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../../assets/assets-manifest.json";

describe("image backfill manifest", () => {
  it("contains the complete zero-cost real entity catalog", () => {
    expect(manifest.budgetUsd).toBe(0);
    expect(manifest.entries).toHaveLength(75);
    expect(Object.fromEntries(["company", "speaker", "event", "topic"].map((type) => [type, manifest.entries.filter((entry) => entry.entityType === type).length]))).toEqual({
      company: 19, speaker: 28, event: 13, topic: 15,
    });
    expect(new Set(manifest.entries.map((entry) => `${entry.entityType}:${entry.entitySlug}`)).size).toBe(75);
  });

  it("permits only approved free providers and HTTPS provenance", () => {
    const freeProviders = new Set(["official", "wikimedia", "pexels", "pixabay"]);
    for (const entry of manifest.entries) {
      expect(freeProviders.has(entry.provider)).toBe(true);
      expect(entry.providerPriority.every((provider) => freeProviders.has(provider))).toBe(true);
      expect(entry.sourcePageUrl.startsWith("https://")).toBe(true);
      expect(entry.licenseUrl.startsWith("https://")).toBe(true);
      expect(entry.sourceUrl === null || /^https:\/\//.test(String(entry.sourceUrl))).toBe(true);
      expect(entry.searchQuery.length).toBeGreaterThan(2);
    }
  });

  it("defines private masters, approved variants, and transactional linking", () => {
    const migration = readFileSync("supabase/migrations/202607140003_asset_pipeline.sql", "utf8");
    expect(migration).toContain("entity-asset-sources");
    expect(migration).toContain("create table if not exists public.asset_variants");
    expect(migration).toContain("finalize_asset_import");
    expect(migration).toContain("events_image_fk");
  });
});
