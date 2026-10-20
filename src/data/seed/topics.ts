import type { Topic } from "@/domain/types";

/* 15 topics. speakerIds / appearanceIds / companyIds are derived
   at seed-boot in ./index.ts from appearance links — do not author
   them here. */

const t = (
  id: string,
  slug: string,
  name: string,
  description: string,
  trendingScore: number,
  relatedTopicIds: string[] = [],
  parentTopicId: string | null = null
): Topic => ({
  id,
  slug,
  name,
  description,
  imageUrl: null,
  imageAttribution: null,
  parentTopicId,
  relatedTopicIds,
  speakerIds: [],
  appearanceIds: [],
  companyIds: [],
  trendingScore,
});

export const seedTopics: Topic[] = [
  t("t-ai-agents", "ai-agents", "AI agents", "Autonomous and semi-autonomous software systems that plan, act, and use tools on a user's behalf.", 96, ["t-inference", "t-devtools"]),
  t("t-inference", "inference", "Inference", "Serving models efficiently: latency, batching, quantization, and the economics of tokens.", 91, ["t-chips", "t-ai-agents"]),
  t("t-chips", "chips", "Chips", "Semiconductors, accelerators, packaging, and the supply chains underneath the AI buildout.", 88, ["t-inference", "t-energy"]),
  t("t-open-source-models", "open-source-models", "Open-source models", "Open-weight models, licenses, and the community infrastructure around them.", 84, ["t-ai-safety", "t-inference"]),
  t("t-robotics", "robotics", "Robotics", "Manipulation, locomotion, and the deployment of learned policies in physical machines.", 82, ["t-multimodal-ai", "t-defense-tech"]),
  t("t-energy", "energy", "Energy", "Power generation, grid constraints, and the energy demands of compute.", 79, ["t-chips"]),
  t("t-multimodal-ai", "multimodal-ai", "Multimodal AI", "Models that perceive and generate across text, vision, audio, and action.", 77, ["t-robotics", "t-ai-agents"]),
  t("t-venture-capital", "venture-capital", "Venture capital", "How capital forms around technology cycles — fund strategy, valuations, and exits.", 71, ["t-ai-agents"]),
  t("t-devtools", "developer-tools", "Developer tools", "The editors, runtimes, and platforms developers build with — increasingly agent-native.", 74, ["t-ai-agents", "t-data-infrastructure"]),
  t("t-ai-safety", "ai-safety", "AI safety", "Alignment, evaluations, interpretability, and deployment safeguards.", 69, ["t-open-source-models"]),
  t("t-data-infrastructure", "data-infrastructure", "Data infrastructure", "Storage, pipelines, and retrieval systems feeding modern AI workloads.", 66, ["t-devtools", "t-inference"]),
  t("t-defense-tech", "defense-technology", "Defense technology", "Dual-use autonomy, sensing, and the industrial base debate.", 63, ["t-robotics"]),
  t("t-biotech", "biotechnology", "Biotechnology", "Computation meeting biology: protein design, diagnostics, and lab automation.", 58, ["t-multimodal-ai"]),
  t("t-quantum", "quantum", "Quantum computing", "Error correction, logical qubits, and the realistic timeline debate.", 47, ["t-chips"]),
  t("t-av", "autonomous-vehicles", "Autonomous vehicles", "Self-driving stacks, simulation, and the path to driverless economics.", 55, ["t-robotics", "t-multimodal-ai"]),
];
