import type { Company } from "@/domain/types";

/* 12 fictional demonstration companies. speakerIds / appearanceIds /
   productLaunchIds are derived at seed-boot in ./index.ts. */

const NOW = "2026-07-01T00:00:00Z";

const c = (
  id: string,
  slug: string,
  name: string,
  description: string,
  industryTags: string[],
  topicIds: string[]
): Company => ({
  id,
  slug,
  name,
  logoUrl: null,
  imageAttribution: null,
  description,
  websiteUrl: "#",
  industryTags,
  speakerIds: [],
  topicIds,
  appearanceIds: [],
  productLaunchIds: [],
  createdAt: NOW,
  updatedAt: NOW,
});

export const seedCompanies: Company[] = [
  c("c-lattice", "lattice-compute", "Lattice Compute", "Builds vertically integrated AI accelerators and the serving stack above them. Known for the Loomcore chip family.", ["semiconductors", "ai-infrastructure"], ["t-chips", "t-inference", "t-energy"]),
  c("c-trellis", "trellis-ai", "Trellis AI", "Agent platform company. Its Loom runtime orchestrates long-running agents for enterprises.", ["ai", "agents", "enterprise-software"], ["t-ai-agents", "t-devtools"]),
  c("c-helioform", "helioform", "Helioform", "Compact fusion developer targeting behind-the-meter power for data centers.", ["energy", "fusion"], ["t-energy", "t-chips"]),
  c("c-mistbound", "mistbound-labs", "Mistbound Labs", "Open-weight model lab. Publishes the Bramble model family under permissive licenses.", ["ai", "open-source"], ["t-open-source-models", "t-ai-safety", "t-inference"]),
  c("c-corvid", "corvid-robotics", "Corvid Robotics", "General-purpose manipulation robots for logistics. Maker of the Atlas-class Fieldhand platform.", ["robotics", "logistics"], ["t-robotics", "t-multimodal-ai"]),
  c("c-ninefold", "ninefold-capital", "Ninefold Capital", "Early-stage venture firm focused on compute, energy, and applied AI.", ["venture-capital"], ["t-venture-capital", "t-ai-agents", "t-energy"]),
  c("c-parallax", "parallax-bio", "Parallax Bio", "Protein-design platform pairing foundation models with automated wet labs.", ["biotech", "ai"], ["t-biotech", "t-multimodal-ai"]),
  c("c-quarry", "quarry-semiconductor", "Quarry Semiconductor", "Advanced packaging and chiplet interconnect for AI accelerators.", ["semiconductors"], ["t-chips", "t-quantum"]),
  c("c-driftline", "driftline", "Driftline", "Agent-native developer platform: editor, runtime, and evaluation suite.", ["developer-tools", "ai"], ["t-devtools", "t-ai-agents", "t-data-infrastructure"]),
  c("c-meridian", "meridian-defense", "Meridian Defense Systems", "Autonomy and sensing systems for allied defense programs.", ["defense", "robotics"], ["t-defense-tech", "t-robotics", "t-av"]),
  c("c-halcyon", "halcyon-data", "Halcyon Data", "Retrieval and storage infrastructure tuned for inference-time workloads.", ["data-infrastructure", "ai"], ["t-data-infrastructure", "t-inference"]),
  c("c-overstory", "overstory-institute", "Overstory Institute", "Independent research institute studying frontier-model capabilities and safety. Hosts a public lecture series.", ["research", "academia"], ["t-ai-safety", "t-multimodal-ai", "t-robotics"]),
];
