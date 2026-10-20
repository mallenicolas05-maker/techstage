import type { Event } from "@/domain/types";

/* 10 fictional events. speakerIds / appearanceIds derived at seed-boot.
   "Today" in demo data terms is 2026-07-10. */

const NOW = "2026-07-01T00:00:00Z";

interface EventSeed {
  id: string;
  slug: string;
  title: string;
  organizer: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: string;
  isOnline?: boolean;
  livestreamUrl?: string | null;
  verification?: Event["verificationStatus"];
}

const ev = (e: EventSeed): Event => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  organizer: e.organizer,
  description: e.description,
  startDate: e.startDate,
  endDate: e.endDate,
  timezone: e.timezone,
  location: e.location,
  isOnline: e.isOnline ?? false,
  eventUrl: "#",
  livestreamUrl: e.livestreamUrl ?? null,
  imageUrl: null,
  imageAttribution: null,
  speakerIds: [],
  appearanceIds: [],
  verificationStatus: e.verification ?? "verified",
  createdAt: NOW,
  updatedAt: NOW,
});

export const seedEvents: Event[] = [
  ev({
    id: "e-substrate-summit", slug: "substrate-summit-2026", title: "Substrate Summit 2026",
    organizer: "Substrate Media",
    description: "The flagship conference on AI infrastructure: chips, serving stacks, data systems, and the capital that funds them. Three days of panels and technical sessions in San Francisco.",
    startDate: "2026-06-02", endDate: "2026-06-04", timezone: "America/Los_Angeles",
    location: "San Francisco, CA",
  }),
  ev({
    id: "e-compute-power", slug: "compute-power-symposium-2026", title: "Compute & Power Symposium",
    organizer: "GridForward",
    description: "Where the compute industry meets the energy industry. Keynotes on siting, grid interconnects, and the power economics of the AI buildout.",
    startDate: "2026-05-12", endDate: "2026-05-13", timezone: "America/Chicago",
    location: "Austin, TX",
  }),
  ev({
    id: "e-agentcon", slug: "agentcon-2026", title: "AgentCon 2026",
    organizer: "AgentCon Foundation",
    description: "The practitioner conference for agentic systems: orchestration, evaluation, memory, and deployment stories from teams running agents in production.",
    startDate: "2026-04-14", endDate: "2026-04-16", timezone: "America/New_York",
    location: "New York, NY",
  }),
  ev({
    id: "e-frontier-robotics", slug: "frontier-robotics-forum-2026", title: "Frontier Robotics Forum",
    organizer: "Frontier Forum",
    description: "Research and deployment of learned robotics: manipulation, locomotion, sim-to-real, and the economics of embodied AI.",
    startDate: "2026-03-10", endDate: "2026-03-11", timezone: "America/New_York",
    location: "Boston, MA",
  }),
  ev({
    id: "e-open-models", slug: "open-models-assembly-2026", title: "Open Models Assembly",
    organizer: "Open Weights Alliance",
    description: "The annual gathering of the open-model ecosystem: licenses, community weights, evals, and sustainability of open labs.",
    startDate: "2026-05-27", endDate: "2026-05-28", timezone: "Europe/Berlin",
    location: "Berlin, Germany", isOnline: true,
    livestreamUrl: null,
  }),
  ev({
    id: "e-substrate-pod", slug: "the-substrate-podcast", title: "The Substrate (podcast)",
    organizer: "Elliot Shore",
    description: "Long-form interviews where infrastructure leaders walk through their real numbers. Published weekly; recorded remotely.",
    startDate: "2026-01-08", endDate: "2026-12-17", timezone: "America/Los_Angeles",
    location: "Online", isOnline: true,
  }),
  ev({
    id: "e-overstory-lectures", slug: "overstory-lecture-series", title: "Overstory Lecture Series",
    organizer: "Overstory Institute",
    description: "A public university-style lecture series on frontier-model capabilities, safety, and robotics. Free to attend; recordings published within a week.",
    startDate: "2026-02-04", endDate: "2026-11-18", timezone: "America/Los_Angeles",
    location: "Palo Alto, CA", isOnline: true,
    livestreamUrl: null,
  }),
  ev({
    id: "e-ascent", slug: "ascent-2026", title: "Ascent 2026",
    organizer: "Ascent Events",
    description: "The fall stage for consumer and enterprise technology: keynotes, launches, and investor conversations across four themed stages.",
    startDate: "2026-09-15", endDate: "2026-09-17", timezone: "America/Los_Angeles",
    location: "San Francisco, CA",
  }),
  ev({
    id: "e-energytech", slug: "energytech-world-2026", title: "EnergyTech World",
    organizer: "EnergyTech Media",
    description: "Generation, storage, and the new industrial load: how energy technology is being rebuilt around compute demand.",
    startDate: "2026-08-18", endDate: "2026-08-20", timezone: "America/Chicago",
    location: "Houston, TX",
  }),
  ev({
    id: "e-devtools-live", slug: "devtools-live-2026", title: "DevTools Live",
    organizer: "Driftline & friends",
    description: "A one-day online event on agent-native developer tooling: live demos, panels, and launch announcements.",
    startDate: "2026-07-18", endDate: "2026-07-18", timezone: "America/Los_Angeles",
    location: "Online", isOnline: true,
    livestreamUrl: null,
    verification: "unverified",
  }),
];
