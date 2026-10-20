import { getDemoDb as getSeedDb } from "@/data/seed";
import type { Appearance, AppearanceType } from "@/domain/types";

/* Synchronous display-name lookups for card rendering.
   Backed by the same seed database as the repositories; in
   production these become denormalized fields on API responses. */

const db = getSeedDb();

const speakerMap = new Map(db.speakers.map((s) => [s.id, s]));
const companyMap = new Map(db.companies.map((c) => [c.id, c]));
const eventMap = new Map(db.events.map((e) => [e.id, e]));
const topicMap = new Map(db.topics.map((t) => [t.id, t]));
const appearanceMap = new Map(db.appearances.map((a) => [a.id, a]));

export const speakerName = (id: string) => speakerMap.get(id)?.name ?? "Unknown speaker";
export const speakerSlug = (id: string) => speakerMap.get(id)?.slug ?? id;
export const speakerHeadline = (id: string) => speakerMap.get(id)?.headline ?? "";
export const companyName = (id: string) => companyMap.get(id)?.name ?? "Unknown company";
export const companySlug = (id: string) => companyMap.get(id)?.slug ?? id;
export const eventTitle = (id: string) => eventMap.get(id)?.title ?? "Independent";
export const eventSlug = (id: string) => eventMap.get(id)?.slug ?? id;
export const topicName = (id: string) => topicMap.get(id)?.name ?? id;
export const topicSlug = (id: string) => topicMap.get(id)?.slug ?? id;
export const appearanceTitle = (id: string) => appearanceMap.get(id)?.title ?? id;
export const appearanceSlug = (id: string) => appearanceMap.get(id)?.slug ?? id;
export const getAppearanceSync = (id: string): Appearance | undefined => appearanceMap.get(id);

export const speakerNames = (ids: string[], max = 2): string => {
  const names = ids.map(speakerName);
  if (names.length <= max) return names.join(" · ");
  return `${names.slice(0, max).join(" · ")} +${names.length - max}`;
};

export const appearanceSpeakerNames = (
  appearance: Pick<Appearance, "speakerIds" | "speakerLabels">,
  max = 2,
): string => {
  const labels = (appearance.speakerLabels ?? [])
    .map((name) => name.trim())
    .filter((name) => name && !/^unknown speaker$/i.test(name));
  const fallback = appearance.speakerIds
    .map(speakerName)
    .filter((name) => !/^unknown speaker$/i.test(name));
  const names = [...new Set(labels.length ? labels : fallback)];
  if (names.length <= max) return names.join(" · ");
  return `${names.slice(0, max).join(" · ")} +${names.length - max}`;
};

export const APPEARANCE_TYPE_LABELS: Record<AppearanceType, string> = {
  panel: "Panel",
  interview: "Interview",
  "product-launch": "Product launch",
  "technical-talk": "Tech talk",
  podcast: "Podcast",
  livestream: "Livestream",
};

export const APPEARANCE_TYPE_DESCRIPTIONS: Record<AppearanceType, string> = {
  panel: "Several speakers in one audience-led conversation.",
  interview: "A focused one-to-one conversation.",
  podcast: "An audio-first long-form conversation.",
  "technical-talk": "A prepared talk, keynote, lecture, or focused session.",
  "product-launch": "A public product reveal or release briefing.",
  livestream: "A live online broadcast or replay.",
};
