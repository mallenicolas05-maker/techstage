import {
  seedAppearances,
  seedCompanies,
  seedEvents,
  seedMediaSources,
  seedSpeakers,
} from "../src/data/seed/realCatalog";
import { seedTopics } from "../src/data/seed/topics";

const sources = new Map(seedMediaSources.map((source) => [source.id, source]));
const companySlugs = new Map(seedCompanies.map((entity) => [entity.id, entity.slug]));
const speakerSlugs = new Map(seedSpeakers.map((entity) => [entity.id, entity.slug]));
const eventSlugs = new Map(seedEvents.map((entity) => [entity.id, entity.slug]));
const topicSlugs = new Map(seedTopics.map((entity) => [entity.id, entity.slug]));

const manifest = seedAppearances.map((appearance) => {
  const source = sources.get(appearance.primaryVideoId);
  if (!source) throw new Error(`Missing source for ${appearance.slug}`);
  return {
    appearanceSlug: appearance.slug,
    title: appearance.title,
    description: appearance.description,
    occurredAt: appearance.publishedAt,
    durationSeconds: appearance.durationSeconds,
    appearanceType: appearance.appearanceType,
    sourceUrl: source.sourceUrl,
    sourceProvider: source.provider,
    channelName: source.channelName,
    speakerSlugs: appearance.speakerIds.map((id) => speakerSlugs.get(id) ?? id),
    companySlugs: appearance.companyIds.map((id) => companySlugs.get(id) ?? id),
    eventSlug: appearance.eventId ? eventSlugs.get(appearance.eventId) ?? appearance.eventId : null,
    topicSlugs: appearance.topicIds.map((id) => topicSlugs.get(id) ?? id),
    transcriptHint: /transcript/i.test(appearance.description),
  };
});

if (manifest.length !== 40) throw new Error(`Expected 40 appearances, received ${manifest.length}`);
if (new Set(manifest.map((item) => item.appearanceSlug)).size !== 40) throw new Error("Duplicate appearance slug");

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
