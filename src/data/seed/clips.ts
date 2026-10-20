import type { Clip, ClipType, RightsStatus } from "@/domain/types";

/* 62 clips across the catalog. Each clip is a timestamped pointer
   into the original recording — never a rehosted download. */

const cl = (
  id: string,
  appearanceId: string,
  title: string,
  clipType: ClipType,
  startTime: number,
  durationSec: number,
  topicIds: string[],
  speakerIds: string[],
  popularityScore: number,
  rightsStatus: RightsStatus = "official-embed",
  description = ""
): Clip => ({
  id,
  appearanceId,
  title,
  description,
  startTime,
  endTime: startTime + durationSec,
  sourceUrl: `/a/${appearanceId}?t=${startTime}`,
  thumbnailUrl: null,
  topicIds,
  speakerIds,
  clipType,
  popularityScore,
  rightsStatus,
});

export const seedClips: Clip[] = [
  /* a-01 — The Real Cost of a Token */
  cl("cl-001", "a-01", "“We price tokens like FLOPs are scarce. They aren't.”", "quote", 812, 74, ["t-inference"], ["s-mira-chen"], 95),
  cl("cl-002", "a-01", "Menon's bandwidth roofline, drawn live", "highlight", 1120, 180, ["t-chips", "t-inference"], ["s-ravi-menon"], 82),
  cl("cl-003", "a-01", "Fischer: retrieval is 30% of your token bill", "highlight", 2410, 140, ["t-data-infrastructure"], ["s-lena-fischer"], 78),
  cl("cl-004", "a-01", "The margins question Chen almost didn't answer", "qa", 3390, 160, ["t-inference"], ["s-mira-chen", "s-elliot-shore"], 88),

  /* a-02 — Charting the Next Compute Decade */
  cl("cl-005", "a-02", "One chart: serving cost per token, 2016–2026", "highlight", 95, 130, ["t-inference"], ["s-mira-chen"], 90),
  cl("cl-006", "a-02", "“The roadmap bends at the package, not the transistor”", "quote", 655, 68, ["t-chips"], ["s-mira-chen"], 84),
  cl("cl-007", "a-02", "Lattice commits to public serving costs", "announcement", 1905, 150, ["t-inference"], ["s-mira-chen"], 87),

  /* a-03 — Trellis Loom GA */
  cl("cl-008", "a-03", "Loom launch: the 90-second summary", "announcement", 40, 92, ["t-ai-agents"], ["s-dario-okafor"], 93),
  cl("cl-009", "a-03", "Killing an agent run mid-flight — and resuming it", "demo", 1540, 210, ["t-ai-agents", "t-devtools"], ["s-marcus-oyelaran"], 91),
  cl("cl-010", "a-03", "Approval queues as a first-class primitive", "demo", 2130, 170, ["t-ai-agents"], ["s-marcus-oyelaran"], 76),
  cl("cl-011", "a-03", "Per-step pricing explained", "announcement", 2480, 130, ["t-ai-agents"], ["s-dario-okafor"], 71),
  cl("cl-012", "a-03", "“Reliability is the product. The model is an ingredient.”", "quote", 520, 58, ["t-ai-agents"], ["s-dario-okafor"], 89),

  /* a-04 — Powering the Buildout */
  cl("cl-013", "a-04", "“A month in the queue costs more than a year of R&D”", "quote", 980, 72, ["t-energy"], ["s-ingrid-solheim"], 85),
  cl("cl-014", "a-04", "Behind-the-meter fusion, explained in three minutes", "highlight", 1420, 185, ["t-energy"], ["s-ingrid-solheim"], 74),

  /* a-05 — Whose Weights Are They Anyway? */
  cl("cl-015", "a-05", "Reyes: “Permissive licensing already won”", "quote", 850, 66, ["t-open-source-models"], ["s-tomas-reyes"], 79),
  cl("cl-016", "a-05", "Petrova on what open weights actually enabled", "highlight", 1030, 190, ["t-open-source-models"], ["s-nadia-petrova"], 68),
  cl("cl-017", "a-05", "Tanaka: evals are the common ground", "highlight", 1790, 155, ["t-ai-safety"], ["s-yuki-tanaka"], 72),
  cl("cl-018", "a-05", "Who pays for the next training run?", "qa", 2600, 240, ["t-venture-capital", "t-open-source-models"], ["s-hannah-kessler", "s-tomas-reyes"], 81),

  /* a-06 — Contact-Rich Manipulation */
  cl("cl-019", "a-06", "A checklist for reading robotics demos critically", "highlight", 2980, 220, ["t-robotics"], ["s-claire-dubois"], 64, "link-only"),

  /* a-07 — Priya Raghavan: Robots That Pay Rent */
  cl("cl-020", "a-07", "Corvid's real intervention rates, on the record", "highlight", 640, 200, ["t-robotics"], ["s-priya-raghavan"], 86),
  cl("cl-021", "a-07", "“Our robots fail at doors, tape, and Mondays”", "quote", 1710, 55, ["t-robotics"], ["s-priya-raghavan"], 92),
  cl("cl-022", "a-07", "What Corvid interviews for (it isn't RL)", "highlight", 2860, 175, ["t-robotics"], ["s-priya-raghavan"], 75),

  /* a-08 — Where the Returns Are */
  cl("cl-023", "a-08", "The categories Ninefold stopped funding", "highlight", 1220, 210, ["t-venture-capital"], ["s-eleanor-voss"], 83),
  cl("cl-024", "a-08", "Voss: “Infrastructure absorbs alpha”", "quote", 2040, 62, ["t-venture-capital"], ["s-eleanor-voss"], 77),
  cl("cl-025", "a-08", "Kessler's ownership math for the compute cycle", "highlight", 2900, 195, ["t-venture-capital"], ["s-hannah-kessler"], 70),

  /* a-09 — Agents That Survive Monday Morning */
  cl("cl-026", "a-09", "The taxonomy of Monday-morning agent failures", "highlight", 180, 220, ["t-ai-agents"], ["s-dario-okafor"], 80),
  cl("cl-027", "a-09", "Durable state: the design that became Loom", "highlight", 760, 240, ["t-ai-agents"], ["s-dario-okafor"], 73),
  cl("cl-028", "a-09", "“Bill for the step, not the seat”", "quote", 1750, 48, ["t-ai-agents"], ["s-dario-okafor"], 69),

  /* a-10 — Batching Is All You Need */
  cl("cl-029", "a-10", "Four accelerator generations, one benchmark harness", "demo", 300, 260, ["t-inference", "t-chips"], ["s-ravi-menon"], 71),
  cl("cl-030", "a-10", "Where the roofline really is", "highlight", 1350, 190, ["t-inference"], ["s-ravi-menon"], 66),

  /* a-12 — Sim-to-Real Reality Check */
  cl("cl-031", "a-12", "Policy degradation numbers nobody else will share", "highlight", 900, 230, ["t-robotics"], ["s-owen-gallagher"], 74, "link-only"),
  cl("cl-032", "a-12", "Dubois vs. Gallagher on domain randomization", "qa", 1900, 260, ["t-robotics"], ["s-claire-dubois", "s-owen-gallagher"], 67, "link-only"),
  cl("cl-033", "a-12", "Marchetti: the sim gap is a perception gap", "highlight", 2500, 170, ["t-multimodal-ai"], ["s-sofia-marchetti"], 62, "link-only"),

  /* a-13 — Grounding Multimodal Models */
  cl("cl-034", "a-13", "Live probing: making a VLA model fail on purpose", "demo", 1150, 240, ["t-multimodal-ai"], ["s-sofia-marchetti"], 65),
  cl("cl-035", "a-13", "A taxonomy of grounding failures", "highlight", 420, 200, ["t-multimodal-ai"], ["s-sofia-marchetti"], 58),

  /* a-14 — Publishing the Failures */
  cl("cl-036", "a-14", "Anatomy of a failed training run", "highlight", 1300, 280, ["t-open-source-models"], ["s-tomas-reyes"], 76),
  cl("cl-037", "a-14", "“Transparency is our recruiting strategy”", "quote", 3010, 50, ["t-open-source-models"], ["s-tomas-reyes"], 72),

  /* a-15 — Before the Loom */
  cl("cl-038", "a-15", "The reliability problem, eight months before Loom", "highlight", 880, 210, ["t-ai-agents"], ["s-dario-okafor"], 63),
  cl("cl-039", "a-15", "Okafor's original checkpointing sketch", "highlight", 2200, 190, ["t-ai-agents"], ["s-dario-okafor"], 60),

  /* a-16 — Retrieval Under Load */
  cl("cl-040", "a-16", "Agent fleets as the new database client", "highlight", 420, 200, ["t-data-infrastructure"], ["s-fatima-alrashid"], 61),
  cl("cl-041", "a-16", "The cache-locality rule of thumb", "quote", 1510, 65, ["t-data-infrastructure"], ["s-fatima-alrashid"], 57),

  /* a-17 — The Packaging Crunch */
  cl("cl-042", "a-17", "Whitfield: the quiet bottleneck is the substrate", "highlight", 530, 190, ["t-chips"], ["s-sam-whitfield"], 69),
  cl("cl-043", "a-17", "How long does the crunch last? Three answers.", "qa", 2100, 280, ["t-chips"], ["s-sam-whitfield", "s-david-liang", "s-mira-chen"], 73),
  cl("cl-044", "a-17", "Chen on buying capacity years ahead", "highlight", 1500, 160, ["t-chips"], ["s-mira-chen"], 66),

  /* a-18 — The Editor Is Dead */
  cl("cl-045", "a-18", "Review-first programming, demoed live", "demo", 900, 260, ["t-devtools"], ["s-ben-alcott"], 78),
  cl("cl-046", "a-18", "“The unit of programming is the eval now”", "quote", 2020, 52, ["t-devtools", "t-ai-agents"], ["s-ben-alcott"], 82),

  /* a-19 — Evals Are the Product */
  cl("cl-047", "a-19", "Case study: the eval that failed silently", "highlight", 1600, 270, ["t-ai-safety"], ["s-yuki-tanaka"], 64, "link-only"),
  cl("cl-048", "a-19", "Building evals that predict deployment", "highlight", 700, 220, ["t-ai-safety"], ["s-yuki-tanaka"], 59, "link-only"),

  /* a-21 — The Token Margin, Live (unverified source) */
  cl("cl-049", "a-21", "Park's margin model, challenged line by line", "highlight", 1100, 300, ["t-inference"], ["s-jaewon-park"], 55, "pending-review"),

  /* a-22 — Storage for the Agentic Era */
  cl("cl-050", "a-22", "What agent memory demands from storage", "highlight", 640, 210, ["t-data-infrastructure"], ["s-lena-fischer"], 60),
  cl("cl-051", "a-22", "Cheap snapshots or it didn't happen", "quote", 1820, 58, ["t-data-infrastructure"], ["s-fatima-alrashid"], 56),

  /* a-23 — Bramble-3 Release */
  cl("cl-052", "a-23", "Bramble-3 in five minutes", "announcement", 60, 300, ["t-open-source-models"], ["s-tomas-reyes"], 88),
  cl("cl-053", "a-23", "Full training-data documentation — why and how", "highlight", 1240, 230, ["t-open-source-models"], ["s-nadia-petrova"], 75),
  cl("cl-054", "a-23", "Bramble-3 eval results walkthrough", "demo", 2100, 260, ["t-open-source-models", "t-inference"], ["s-tomas-reyes"], 70),

  /* a-25 — Cryo-Control */
  cl("cl-055", "a-25", "The control-electronics bottleneck in one diagram", "highlight", 950, 200, ["t-quantum"], ["s-anton-berg"], 48, "link-only"),

  /* a-26 — Fieldhand at Scale */
  cl("cl-056", "a-26", "Quarterly reliability numbers, published", "announcement", 1420, 150, ["t-robotics"], ["s-priya-raghavan"], 68),
  cl("cl-057", "a-26", "Intervention economics: the whole model", "highlight", 800, 240, ["t-robotics"], ["s-priya-raghavan"], 65),

  /* a-27 — Designing for Agents */
  cl("cl-058", "a-27", "When your user is sometimes an agent", "highlight", 780, 220, ["t-devtools"], ["s-grace-nakamura"], 58),
  cl("cl-059", "a-27", "Reversibility as a design principle", "highlight", 2300, 180, ["t-devtools"], ["s-grace-nakamura"], 54),

  /* a-28 — Dual-Use, Straight Answers */
  cl("cl-060", "a-28", "“Here is what we refuse to build”", "quote", 1500, 90, ["t-defense-tech"], ["s-viktor-hessel"], 71, "link-only"),
  cl("cl-061", "a-28", "Export controls, answered without hedging", "qa", 2100, 230, ["t-defense-tech"], ["s-viktor-hessel"], 63, "link-only"),

  /* a-29 — Seed Stage in the Compute Cycle */
  cl("cl-062", "a-29", "Park brings receipts on seed dilution", "highlight", 1350, 240, ["t-venture-capital"], ["s-jaewon-park"], 62),
];
