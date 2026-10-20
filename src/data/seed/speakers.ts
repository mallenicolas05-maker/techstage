import type { Speaker, VerificationStatus } from "@/domain/types";

/* 25 fictional demonstration speakers.
   appearanceIds / upcomingAppearanceIds are derived at seed-boot. */

const NOW = "2026-07-01T00:00:00Z";

interface SpeakerSeed {
  id: string;
  slug: string;
  name: string;
  headline: string;
  biography: string;
  companyIds: string[];
  topicIds: string[];
  prominence: number;
  aliases?: string[];
  verification?: VerificationStatus;
  roleHistory?: Speaker["roleHistory"];
}

const sp = (s: SpeakerSeed): Speaker => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  aliases: s.aliases ?? [],
  headline: s.headline,
  biography: s.biography,
  avatarUrl: null,
  imageAttribution: null,
  companyIds: s.companyIds,
  roleHistory:
    s.roleHistory ??
    (s.companyIds.length
      ? [
          {
            title: s.headline.split(",")[0] ?? s.headline,
            companyId: s.companyIds[0],
            companyName: "",
            from: "2022-01-01",
            to: null,
          },
        ]
      : []),
  topicIds: s.topicIds,
  socialLinks: [],
  websiteUrl: null,
  prominenceScore: s.prominence,
  verificationStatus: s.verification ?? "verified",
  upcomingAppearanceIds: [],
  appearanceIds: [],
  createdAt: NOW,
  updatedAt: NOW,
});

export const seedSpeakers: Speaker[] = [
  sp({
    id: "s-mira-chen", slug: "mira-chen", name: "Mira Chen",
    headline: "CEO, Lattice Compute",
    biography: "Mira Chen co-founded Lattice Compute in 2021 after a decade leading accelerator design teams. She argues the industry underprices inference and overprices training, and has become the most-quoted voice on compute economics.",
    companyIds: ["c-lattice"], topicIds: ["t-chips", "t-inference", "t-energy"], prominence: 97,
    aliases: ["Mira C. Chen"],
    roleHistory: [
      { title: "CEO & Co-founder", companyId: "c-lattice", companyName: "Lattice Compute", from: "2021-03-01", to: null },
      { title: "VP Silicon", companyId: "c-quarry", companyName: "Quarry Semiconductor", from: "2016-05-01", to: "2021-02-01" },
    ],
  }),
  sp({
    id: "s-dario-okafor", slug: "dario-okafor", name: "Dario Okafor",
    headline: "Founder & CEO, Trellis AI",
    biography: "Dario Okafor founded Trellis AI to make long-running agents dependable enough for enterprise work. Previously he built workflow infrastructure used by half the Fortune 500.",
    companyIds: ["c-trellis"], topicIds: ["t-ai-agents", "t-devtools"], prominence: 93,
  }),
  sp({
    id: "s-ingrid-solheim", slug: "ingrid-solheim", name: "Ingrid Solheim",
    headline: "CEO, Helioform",
    biography: "Ingrid Solheim leads Helioform's push to site compact fusion next to data centers. A former grid operator, she frames AI's bottleneck as an energy problem first.",
    companyIds: ["c-helioform"], topicIds: ["t-energy", "t-chips"], prominence: 89,
  }),
  sp({
    id: "s-tomas-reyes", slug: "tomas-reyes", name: "Tomás Reyes",
    headline: "Chief Scientist, Mistbound Labs",
    biography: "Tomás Reyes directs research at Mistbound Labs, the open-weight lab behind the Bramble family. He publishes everything, including the failures.",
    companyIds: ["c-mistbound"], topicIds: ["t-open-source-models", "t-inference", "t-ai-safety"], prominence: 88,
  }),
  sp({
    id: "s-priya-raghavan", slug: "priya-raghavan", name: "Priya Raghavan",
    headline: "CEO, Corvid Robotics",
    biography: "Priya Raghavan runs Corvid Robotics, shipping manipulation robots into warehouses. She is blunt about what learned policies can and cannot do yet.",
    companyIds: ["c-corvid"], topicIds: ["t-robotics", "t-multimodal-ai"], prominence: 86,
  }),
  sp({
    id: "s-eleanor-voss", slug: "eleanor-voss", name: "Eleanor Voss",
    headline: "General Partner, Ninefold Capital",
    biography: "Eleanor Voss invests at the intersection of compute, energy, and applied AI. Known for early positions in three of the current infrastructure leaders.",
    companyIds: ["c-ninefold"], topicIds: ["t-venture-capital", "t-energy", "t-ai-agents"], prominence: 85,
  }),
  sp({
    id: "s-sam-whitfield", slug: "sam-whitfield", name: "Sam Whitfield",
    headline: "CTO, Quarry Semiconductor",
    biography: "Sam Whitfield leads Quarry's chiplet interconnect roadmap and is a fixture of packaging deep-dives at industry conferences.",
    companyIds: ["c-quarry"], topicIds: ["t-chips", "t-quantum"], prominence: 78,
  }),
  sp({
    id: "s-yuki-tanaka", slug: "yuki-tanaka", name: "Yuki Tanaka",
    headline: "Head of Research, Overstory Institute",
    biography: "Yuki Tanaka studies evaluation methods for frontier models and leads Overstory's public lecture program on deployment safety.",
    companyIds: ["c-overstory"], topicIds: ["t-ai-safety", "t-open-source-models"], prominence: 81,
  }),
  sp({
    id: "s-ben-alcott", slug: "ben-alcott", name: "Ben Alcott",
    headline: "CEO, Driftline",
    biography: "Ben Alcott is building Driftline's agent-native developer platform. He previously ran developer experience at a major cloud.",
    companyIds: ["c-driftline"], topicIds: ["t-devtools", "t-ai-agents"], prominence: 80,
  }),
  sp({
    id: "s-amara-diallo", slug: "amara-diallo", name: "Amara Diallo",
    headline: "CEO, Parallax Bio",
    biography: "Amara Diallo pairs protein foundation models with automated labs at Parallax Bio. Trained as a structural biologist; talks like an engineer.",
    companyIds: ["c-parallax"], topicIds: ["t-biotech", "t-multimodal-ai"], prominence: 76,
  }),
  sp({
    id: "s-viktor-hessel", slug: "viktor-hessel", name: "Viktor Hessel",
    headline: "CEO, Meridian Defense Systems",
    biography: "Viktor Hessel leads Meridian's autonomy programs and is a frequent, careful voice in the dual-use debate.",
    companyIds: ["c-meridian"], topicIds: ["t-defense-tech", "t-robotics", "t-av"], prominence: 74,
  }),
  sp({
    id: "s-lena-fischer", slug: "lena-fischer", name: "Lena Fischer",
    headline: "CEO, Halcyon Data",
    biography: "Lena Fischer runs Halcyon Data, whose retrieval stack sits under several of the largest agent deployments.",
    companyIds: ["c-halcyon"], topicIds: ["t-data-infrastructure", "t-inference"], prominence: 75,
  }),
  sp({
    id: "s-marcus-oyelaran", slug: "marcus-oyelaran", name: "Marcus Oyelaran",
    headline: "VP Product, Trellis AI",
    biography: "Marcus Oyelaran owns the Loom product line at Trellis AI and demos it live, without a net, at every launch.",
    companyIds: ["c-trellis"], topicIds: ["t-ai-agents", "t-devtools"], prominence: 66,
  }),
  sp({
    id: "s-sofia-marchetti", slug: "sofia-marchetti", name: "Sofia Marchetti",
    headline: "Research Scientist, Overstory Institute",
    biography: "Sofia Marchetti works on multimodal grounding and is known for lucid conference talks that double as tutorials.",
    companyIds: ["c-overstory"], topicIds: ["t-multimodal-ai", "t-robotics"], prominence: 64,
  }),
  sp({
    id: "s-jaewon-park", slug: "jae-won-park", name: "Jae-won Park",
    headline: "Independent researcher & angel investor",
    biography: "Jae-won Park writes a widely read technical newsletter on inference economics and invests in seed-stage infrastructure.",
    companyIds: [], topicIds: ["t-inference", "t-venture-capital"], prominence: 61,
    verification: "unverified",
  }),
  sp({
    id: "s-hannah-kessler", slug: "hannah-kessler", name: "Hannah Kessler",
    headline: "Partner, Ninefold Capital",
    biography: "Hannah Kessler covers developer tools and open-source business models at Ninefold Capital.",
    companyIds: ["c-ninefold"], topicIds: ["t-venture-capital", "t-devtools", "t-open-source-models"], prominence: 68,
  }),
  sp({
    id: "s-ravi-menon", slug: "ravi-menon", name: "Ravi Menon",
    headline: "Distinguished Engineer, Lattice Compute",
    biography: "Ravi Menon leads the serving-stack team at Lattice Compute and speaks in benchmarks, not adjectives.",
    companyIds: ["c-lattice"], topicIds: ["t-inference", "t-chips"], prominence: 70,
  }),
  sp({
    id: "s-claire-dubois", slug: "claire-dubois", name: "Claire Dubois",
    headline: "Professor of Robotics, Overstory Institute affiliate",
    biography: "Claire Dubois researches contact-rich manipulation and teaches the most oversubscribed robotics course on the continent.",
    companyIds: ["c-overstory"], topicIds: ["t-robotics"], prominence: 63,
  }),
  sp({
    id: "s-owen-gallagher", slug: "owen-gallagher", name: "Owen Gallagher",
    headline: "Co-founder & CTO, Corvid Robotics",
    biography: "Owen Gallagher built Corvid's learned-policy stack and previously shipped perception systems for autonomous trucking.",
    companyIds: ["c-corvid"], topicIds: ["t-robotics", "t-av", "t-multimodal-ai"], prominence: 62,
  }),
  sp({
    id: "s-nadia-petrova", slug: "nadia-petrova", name: "Nadia Petrova",
    headline: "Head of Open Source, Mistbound Labs",
    biography: "Nadia Petrova stewards the Bramble ecosystem: licenses, community weights, and the eval commons.",
    companyIds: ["c-mistbound"], topicIds: ["t-open-source-models", "t-devtools"], prominence: 65,
  }),
  sp({
    id: "s-david-liang", slug: "david-liang", name: "David Liang",
    headline: "President, Quarry Semiconductor",
    biography: "David Liang runs Quarry's operations and speaks on capacity planning and the packaging supply chain.",
    companyIds: ["c-quarry"], topicIds: ["t-chips"], prominence: 60,
  }),
  sp({
    id: "s-fatima-alrashid", slug: "fatima-al-rashid", name: "Fatima Al-Rashid",
    headline: "VP Engineering, Halcyon Data",
    biography: "Fatima Al-Rashid leads Halcyon's query engine and has strong opinions about benchmarks that fit in a tweet.",
    companyIds: ["c-halcyon"], topicIds: ["t-data-infrastructure", "t-devtools"], prominence: 58,
  }),
  sp({
    id: "s-elliot-shore", slug: "elliot-shore", name: "Elliot Shore",
    headline: "Host, The Substrate podcast",
    biography: "Elliot Shore hosts The Substrate, the interview show where infrastructure leaders explain their actual numbers.",
    companyIds: [], topicIds: ["t-inference", "t-venture-capital", "t-ai-agents"], prominence: 72,
  }),
  sp({
    id: "s-grace-nakamura", slug: "grace-nakamura", name: "Grace Nakamura",
    headline: "Head of Product, Driftline",
    biography: "Grace Nakamura designs Driftline's agent evaluation workflows and previously shipped two beloved developer IDE features.",
    companyIds: ["c-driftline"], topicIds: ["t-devtools", "t-ai-agents"], prominence: 57,
  }),
  sp({
    id: "s-anton-berg", slug: "anton-berg", name: "Anton Berg",
    headline: "Research Scientist, Lattice Compute",
    biography: "Anton Berg explores post-CMOS directions at Lattice, including cryogenic control chips for quantum systems.",
    companyIds: ["c-lattice"], topicIds: ["t-quantum", "t-chips"], prominence: 52,
    verification: "unverified",
  }),
];
