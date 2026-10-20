import {
  seedCompanies,
  seedEvents,
  seedSpeakers,
} from "./realCatalog";

export const realSpeakerIds = new Set(seedSpeakers.map((row) => row.id));
export const realCompanyIds = new Set(seedCompanies.map((row) => row.id));
export const realEventIds = new Set(seedEvents.map((row) => row.id));

