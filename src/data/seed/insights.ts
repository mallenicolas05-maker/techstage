import type { Insight, InsightBrief, InsightEvidence, EvidenceKind } from "@/domain/types";
import { ENRICHMENT_CONFIG } from "@/domain/insightCategories";

/* Precomputed premium insights. Generated once at (mock) ingestion
   time and stored — never regenerated per viewer.
   Demonstrates: applicable-only categories, evidence with timestamps,
   confidence thresholds (one stored insight sits below the display
   threshold), a brief with NO applicable insights, and briefs in
   queued / generating / needs-review states. */

const ev = (
  transcriptSegmentId: string | null,
  timestamp: number,
  quote: string,
  kind: EvidenceKind,
  confidence = 0.9
): InsightEvidence => ({ transcriptSegmentId, timestamp, quote, confidence, kind });

interface InsightSeed {
  id: string;
  briefId: string;
  category: Insight["category"];
  confidence: number;
  headline: string;
  summary: string;
  evidence: InsightEvidence[];
  relatedSpeakerIds?: string[];
  relatedCompanyIds?: string[];
  relatedTopicIds?: string[];
  relatedAppearanceIds?: string[];
  sortOrder?: number;
}

const ins = (s: InsightSeed): Insight => ({
  id: s.id,
  insightBriefId: s.briefId,
  category: s.category,
  isApplicable: true,
  confidence: s.confidence,
  headline: s.headline,
  summary: s.summary,
  evidence: s.evidence,
  relatedSpeakerIds: s.relatedSpeakerIds ?? [],
  relatedCompanyIds: s.relatedCompanyIds ?? [],
  relatedTopicIds: s.relatedTopicIds ?? [],
  relatedAppearanceIds: s.relatedAppearanceIds ?? [],
  visibility: "premium",
  sortOrder: s.sortOrder ?? 0,
});

export const seedInsights: Insight[] = [
  /* ——— b-01 · a-01 The Real Cost of a Token ——— */
  ins({
    id: "i-01-1", briefId: "b-01", category: "bottlenecks", confidence: 0.93, sortOrder: 1,
    headline: "Memory bandwidth and power named as the binding constraints — not compute",
    summary: "All three operators independently identify delivered bandwidth and megawatts as the constraints they plan around. Menon quantifies the divergence: ~9× arithmetic growth vs ~3× bandwidth growth over four accelerator generations.",
    evidence: [
      ev("t-01-s4", 812, "We price tokens like FLOPs are scarce. They aren't. The scarce things are memory bandwidth and megawatts.", "direct-statement"),
      ev("t-01-s6", 1500, "Every serving contract we sign now starts with a power question, not a chip question.", "direct-statement"),
    ],
    relatedTopicIds: ["t-inference", "t-chips", "t-energy"],
  }),
  ins({
    id: "i-01-2", briefId: "b-01", category: "builder-implications", confidence: 0.88, sortOrder: 2,
    headline: "Budget retrieval for an agent-dominated request mix",
    summary: "Fischer's 30% retrieval share is contested for chat but accepted for agent workloads. Teams budgeting retrieval at chat-era ratios are described as likely to miss 'by an integer multiple'.",
    evidence: [
      ev("t-01-s7", 1980, "Retrieval is thirty percent of your token bill and nobody budgets for it.", "direct-statement"),
      ev("t-01-s9", 2900, "If you budget retrieval at chat-era ratios you will miss by an integer multiple.", "direct-statement"),
    ],
    relatedTopicIds: ["t-data-infrastructure"],
    relatedCompanyIds: ["c-halcyon"],
  }),
  ins({
    id: "i-01-3", briefId: "b-01", category: "investment-lens", confidence: 0.74, sortOrder: 3,
    headline: "Lattice signals a deliberate margin-compression strategy in serving",
    summary: "Chen declines to state serving margin but confirms it thins 'every quarter — on purpose', framing price transparency as a share-gaining strategy. A cautious read: sustained pricing pressure across the serving layer. This is a summary of stage remarks, not investment advice.",
    evidence: [
      ev("t-01-s11", 3390, "It's thinner than people assume, and it gets thinner every quarter — on purpose.", "cautious-inference"),
    ],
    relatedCompanyIds: ["c-lattice"],
  }),
  ins({
    id: "i-01-4", briefId: "b-01", category: "related-signals", confidence: 0.81, sortOrder: 4,
    headline: "Consistent with power-first framing in three other talks this quarter",
    summary: "The power-as-denominator framing recurs in Chen's own keynote, Solheim's interconnect-queue fireside, and the packaging panel — suggesting an industry narrative consolidating around energy constraints.",
    evidence: [
      ev("t-01-s6", 1500, "Where is the substation, what's the interconnect timeline, who else is in the queue.", "summary"),
    ],
    relatedAppearanceIds: ["a-02", "a-04", "a-17"],
  }),

  /* ——— b-02 · a-02 Charting the Next Compute Decade ——— */
  ins({
    id: "i-02-1", briefId: "b-02", category: "bottlenecks", confidence: 0.95, sortOrder: 1,
    headline: "Packaging, interconnect, power — in that order",
    summary: "Chen states Lattice's quarterly bottleneck analysis ranks packaging capacity first, then interconnect, then power delivery, and says the next part trades core area for interconnect 'beachfront'.",
    evidence: [
      ev("t-02-s3", 420, "Packaging capacity, interconnect, and power delivery — in that order.", "direct-statement"),
      ev("t-02-s4", 655, "The roadmap bends at the package, not the transistor.", "direct-statement"),
    ],
    relatedTopicIds: ["t-chips"],
    relatedCompanyIds: ["c-quarry"],
  }),
  ins({
    id: "i-02-2", briefId: "b-02", category: "product-timing", confidence: 0.9, sortOrder: 2,
    headline: "Quarterly public serving-cost disclosures begin this quarter",
    summary: "A concrete, dated commitment: Lattice will publish serving costs with methodology every quarter, starting immediately. Watch for the first disclosure and competitor responses.",
    evidence: [
      ev("t-02-s8", 1860, "We will publish our serving costs every quarter, starting this one — methodology included.", "direct-statement"),
    ],
    relatedCompanyIds: ["c-lattice"],
  }),
  ins({
    id: "i-02-3", briefId: "b-02", category: "career-signals", confidence: 0.72, sortOrder: 3,
    headline: "Chip companies hiring grid engineers flagged as a seriousness signal",
    summary: "Chen explicitly tells the audience to watch grid-engineering hires at chip companies. For candidates, power-systems expertise is being pulled into semiconductor roadmaps.",
    evidence: [
      ev("t-02-s7", 1620, "This is why you see chip companies hiring grid engineers. Watch that hiring pattern — it tells you who is serious.", "direct-statement"),
    ],
    relatedTopicIds: ["t-energy", "t-chips"],
  }),
  ins({
    id: "i-02-4", briefId: "b-02", category: "emerging-narratives", confidence: 0.78, sortOrder: 4,
    headline: "'Energy as the unit of account' is hardening into a roadmap principle",
    summary: "The keynote treats power co-design as a precondition of tape-out rather than a deployment detail — a framing shift from even a year ago, echoed on the token-cost panel.",
    evidence: [
      ev("t-02-s6", 1320, "We now co-design deployments with generation partners before we tape out.", "summary"),
    ],
    relatedAppearanceIds: ["a-01", "a-04"],
  }),

  /* ——— b-03 · a-03 Trellis Loom GA ——— */
  ins({
    id: "i-03-1", briefId: "b-03", category: "product-timing", confidence: 0.94, sortOrder: 1,
    headline: "GA now in three regions; Europe in August",
    summary: "Concrete availability: general availability at announcement in three regions with a stated August window for Europe, plus an SLA with published numbers.",
    evidence: [
      ev("t-03-s9", 2460, "Loom is generally available today in three regions; Europe follows in August.", "direct-statement"),
    ],
    relatedCompanyIds: ["c-trellis"],
  }),
  ins({
    id: "i-03-2", briefId: "b-03", category: "builder-implications", confidence: 0.89, sortOrder: 2,
    headline: "Durable, checkpointed agent state is the architectural bet",
    summary: "Every step checkpointed, runs resumable across nodes and across days, approvals modeled as durable waits. Teams building agent infrastructure in-house now have a public benchmark for reliability semantics.",
    evidence: [
      ev("t-03-s4", 578, "Every step is checkpointed. State is durable. A run that dies resumes exactly where it stopped.", "direct-statement"),
      ev("t-03-s7", 1710, "A human can hold, edit, or reject any step... and the agent waits — durably.", "direct-statement"),
    ],
    relatedTopicIds: ["t-ai-agents"],
    relatedAppearanceIds: ["a-09"],
  }),
  ins({
    id: "i-03-3", briefId: "b-03", category: "competitive-intelligence", confidence: 0.76, sortOrder: 3,
    headline: "Per-step billing positions against seat-based agent platforms",
    summary: "The pricing model ('an idle agent costs you nothing') reads as direct positioning against seat licenses and reserved-capacity pricing. Interpretation: expect pricing-model pressure on incumbent agent platforms.",
    evidence: [
      ev("t-03-s8", 2100, "Loom bills per step, so an idle agent costs you nothing. No seats, no reserved capacity.", "model-interpretation"),
    ],
    relatedTopicIds: ["t-devtools"],
  }),
  ins({
    id: "i-03-4", briefId: "b-03", category: "related-signals", confidence: 0.85, sortOrder: 4,
    headline: "The launch completes an arc visible in two earlier appearances",
    summary: "Okafor described the failure taxonomy at AgentCon and the checkpointing sketch on The Substrate months earlier. Reading the three together shows the product thesis forming in public.",
    evidence: [
      ev("t-03-s3", 520, "Reliability is the product. The model is an ingredient.", "summary"),
    ],
    relatedAppearanceIds: ["a-09", "a-15"],
  }),

  /* ——— b-04 · a-04 Powering the Buildout ——— */
  ins({
    id: "i-04-1", briefId: "b-04", category: "bottlenecks", confidence: 0.92, sortOrder: 1,
    headline: "Interconnect queues, not physics or chips, set the timeline",
    summary: "Solheim puts a number on it — up to seven years to connect a gigawatt in some markets — and describes queue avoidance as the entire siting strategy.",
    evidence: [
      ev("t-04-s2", 300, "The interconnect queue is the timeline. Not the reactor physics, not the chip supply.", "direct-statement"),
      ev("t-04-s4", 980, "A month in an interconnect queue costs more than a year of turbine R&D.", "direct-statement"),
    ],
    relatedTopicIds: ["t-energy"],
  }),
  ins({
    id: "i-04-2", briefId: "b-04", category: "investment-lens", confidence: 0.7, sortOrder: 2,
    headline: "Behind-the-meter generation as the queue arbitrage",
    summary: "Co-located, firm power sold at known prices sidesteps the interconnect queue entirely. A cautious read: assets and companies that shorten time-to-power carry scarcity value this cycle. Stage commentary, not investment advice.",
    evidence: [
      ev("t-04-s3", 700, "Co-locate generation with the campus, skip the queue, sell firm power at a known price.", "cautious-inference"),
    ],
    relatedCompanyIds: ["c-helioform"],
  }),
  ins({
    id: "i-04-3", briefId: "b-04", category: "strategic-decisions", confidence: 0.83, sortOrder: 3,
    headline: "Power procurement framed as a core competency of compute companies",
    summary: "Direct advice to the audience: a compute roadmap without an energy chapter 'is fiction'. For infrastructure teams, this argues for in-house energy expertise rather than treating power as a facilities line item.",
    evidence: [
      ev("t-04-s7", 1800, "Power procurement is now a core competency of compute companies. If your roadmap doesn't have an energy chapter, it's fiction.", "direct-statement"),
    ],
  }),
  /* Stored below the display threshold (0.65) — demonstrates threshold filtering. */
  ins({
    id: "i-04-4", briefId: "b-04", category: "market-sentiment", confidence: 0.58, sortOrder: 4,
    headline: "Possible read-through to gas-turbine order books",
    summary: "Weak signal: the R&D comparison could imply near-term turbine demand, but the transcript does not support a directional claim. Stored below display threshold.",
    evidence: [
      ev("t-04-s4", 980, "A month in an interconnect queue costs more than a year of turbine R&D.", "model-interpretation", 0.5),
    ],
  }),

  /* ——— b-05 · a-05 Whose Weights (brief itself is in needs-review) ——— */
  ins({
    id: "i-05-1", briefId: "b-05", category: "open-source-implications", confidence: 0.91, sortOrder: 1,
    headline: "License debate declared settled; funding is the open question",
    summary: "Reyes calls permissive licensing 'won' and reframes the debate entirely around who funds nine-figure training runs — with philanthropic, sovereign, or hyperscaler capital as the candidates.",
    evidence: [
      ev("t-05-s2", 260, "Permissive licensing already won; the argument now is about who pays.", "direct-statement"),
      ev("t-05-s4", 1290, "There is no venture math for a two-billion-dollar training run with free weights.", "direct-statement"),
    ],
    relatedTopicIds: ["t-open-source-models"],
  }),
  ins({
    id: "i-05-2", briefId: "b-05", category: "research-relevance", confidence: 0.84, sortOrder: 2,
    headline: "The eval commons named as the open/closed cooperation surface",
    summary: "Tanaka identifies shared evaluations as functioning common infrastructure — 'a private benchmark is a broken benchmark' — with Mistbound committing negative results to the commons.",
    evidence: [
      ev("t-05-s5", 1680, "Evals are the one place open and closed labs actually cooperate.", "direct-statement"),
      ev("t-05-s6", 2100, "The commons only works if negative results go in.", "direct-statement"),
    ],
    relatedTopicIds: ["t-ai-safety"],
    relatedAppearanceIds: ["a-19"],
  }),
  ins({
    id: "i-05-3", briefId: "b-05", category: "emerging-narratives", confidence: 0.79, sortOrder: 3,
    headline: "The 'operating-system unbundling' analogy for open models",
    summary: "The panel converges on an unbundled future — open weights as publicly funded commons, venture returns migrating to serving, tooling, and applications — explicitly compared to the history of operating systems.",
    evidence: [
      ev("t-05-s7", 2520, "Open weights as public good... venture returns move up the stack to serving, tooling, and applications.", "summary"),
      ev("t-05-s8", 2900, "Which, note, is roughly what happened to operating systems.", "direct-statement"),
    ],
    relatedAppearanceIds: ["a-23"],
  }),

  /* ——— b-07 · a-07 Robots That Pay Rent ——— */
  ins({
    id: "i-07-1", briefId: "b-07", category: "builder-implications", confidence: 0.9, sortOrder: 1,
    headline: "Intervention rate is the business — 0.4/robot-hour, targeting 0.2",
    summary: "Raghavan makes intervention rate the single controlling metric ($11 fully loaded per intervention) and states the contract structure flips to outcome-based below 0.2 per robot-hour.",
    evidence: [
      ev("t-07-s3", 640, "Intervention rate is 0.4 per robot-hour; two years ago it was 4. That single number is the company.", "direct-statement"),
      ev("t-07-s7", 2400, "Below 0.2 per robot-hour, the contract structurally changes — you can sell outcomes instead of units.", "direct-statement"),
    ],
    relatedTopicIds: ["t-robotics"],
  }),
  ins({
    id: "i-07-2", briefId: "b-07", category: "career-signals", confidence: 0.87, sortOrder: 2,
    headline: "Hiring shifted from RL research to cross-stack systems debugging",
    summary: "Corvid interviews for end-to-end failure ownership across firmware, perception, and planning — with an explicit message that the shortage is systems debuggers, not learning researchers.",
    evidence: [
      ev("t-07-s8", 2860, "We interview for systems debugging, not RL papers.", "direct-statement"),
      ev("t-07-s9", 3035, "The shortage is in people who can own a whole failure, end to end.", "direct-statement"),
    ],
  }),
  ins({
    id: "i-07-3", briefId: "b-07", category: "bottlenecks", confidence: 0.82, sortOrder: 3,
    headline: "Novelty, not capability, is the deployment ceiling",
    summary: "Performance 'drops off a cliff' on new SKUs, packaging, and environment changes — the operational bottleneck is distribution shift in the environment, not policy quality on known tasks.",
    evidence: [
      ev("t-07-s4", 1210, "New SKU, new packaging, new tape on the box — performance drops off a cliff you can chart.", "direct-statement"),
      ev("t-07-s5", 1710, "Our robots fail at doors, tape, and Mondays.", "direct-statement"),
    ],
  }),
  ins({
    id: "i-07-4", briefId: "b-07", category: "product-timing", confidence: 0.68, sortOrder: 4,
    headline: "Atlas platform roadmap: self-diagnosis before higher payload",
    summary: "The next platform's headline capability is robots filing their own incident reports. No date given — a cautious signal that the Atlas launch is roadmap-real but unscheduled publicly. The August live demo may firm this up.",
    evidence: [
      ev("t-07-s10", 3600, "The real change is self-diagnosis — the robot files its own incident report before the customer notices.", "cautious-inference"),
    ],
    relatedAppearanceIds: ["a-39"],
  }),

  /* ——— b-08 · a-08 Where the Returns Are ——— */
  ins({
    id: "i-08-1", briefId: "b-08", category: "investment-lens", confidence: 0.88, sortOrder: 1,
    headline: "Ninefold exited thin wrappers and pre-revenue chips 18 months ago",
    summary: "Stated portfolio policy: no products whose moat is 'a prompt and a UI', no pre-revenue silicon. Capital rotates to businesses whose margins improve as the model layer improves. Fund commentary — not personalized financial advice.",
    evidence: [
      ev("t-08-s3", 900, "Eighteen months ago we stopped funding thin wrappers — anything whose moat is a prompt and a UI.", "direct-statement"),
      ev("t-08-s4", 1430, "Businesses that get cheaper to run every time the model layer improves.", "direct-statement"),
    ],
    relatedTopicIds: ["t-venture-capital"],
  }),
  ins({
    id: "i-08-2", briefId: "b-08", category: "market-sentiment", confidence: 0.8, sortOrder: 2,
    headline: "Entry prices, not company quality, framed as the quiet crisis",
    summary: "Kessler's ownership math: identical portfolios with ten points less ownership fail to return the fund. Sentiment reads cautious on valuations while constructive on the underlying companies.",
    evidence: [
      ev("t-08-s6", 2102, "Same portfolio, ten points less ownership, and the fund doesn't return.", "direct-statement"),
      ev("t-08-s5", 2040, "Infrastructure absorbs alpha.", "direct-statement"),
    ],
  }),
  ins({
    id: "i-08-3", briefId: "b-08", category: "emerging-narratives", confidence: 0.75, sortOrder: 3,
    headline: "The 'smaller fund, bigger reserves' counter-cycle thesis",
    summary: "Voss's hypothetical fund — half the size, twice the reserve ratio, built to buy into 'ugly rounds' — articulates a counter-cyclical structure other GPs have hinted at but not stated this plainly.",
    evidence: [
      ev("t-08-s7", 2700, "The fund I'd raise today is half the size and twice the reserve ratio.", "direct-statement"),
    ],
  }),

  /* ——— b-09 · a-09 Agents That Survive Monday Morning ——— */
  ins({
    id: "i-09-1", briefId: "b-09", category: "builder-implications", confidence: 0.89, sortOrder: 1,
    headline: "Agent state should behave like a database, not a chat session",
    summary: "From a 120-pilot survey: no pilot failed on model capability; all failures were state, credentials, and approvals. The prescription is durable, inspectable, resumable state.",
    evidence: [
      ev("t-09-s2", 320, "Not one pilot died because the model wasn't smart enough.", "direct-statement"),
      ev("t-09-s3", 660, "Agent state has to be durable and inspectable, like a database, not ephemeral, like a chat session.", "direct-statement"),
    ],
    relatedTopicIds: ["t-ai-agents"],
  }),
  ins({
    id: "i-09-2", briefId: "b-09", category: "product-timing", confidence: 0.71, sortOrder: 2,
    headline: "'Watch this space in early summer' — a dated pre-announcement",
    summary: "Okafor explicitly declines to announce but names an early-summer window while describing design-partner testing. (Resolved in hindsight by the June 24 Loom GA.)",
    evidence: [
      ev("t-09-s6", 1728, "We're testing these ideas with design partners now... watch this space in early summer.", "direct-statement"),
    ],
    relatedAppearanceIds: ["a-03"],
  }),
  ins({
    id: "i-09-3", briefId: "b-09", category: "related-signals", confidence: 0.83, sortOrder: 3,
    headline: "Billing-model philosophy repeated verbatim at launch",
    summary: "'Bill for the step, not the seat' appears here two months before the identical pricing model ships at the Loom GA — an example of stage philosophy predicting product decisions.",
    evidence: [
      ev("t-09-s5", 1680, "Bill for the step, not the seat. Incentives follow billing.", "direct-statement"),
    ],
    relatedAppearanceIds: ["a-03", "a-15"],
  }),

  /* ——— b-10 · a-10 Batching Is All You Need (only 2 applicable) ——— */
  ins({
    id: "i-10-1", briefId: "b-10", category: "research-relevance", confidence: 0.86, sortOrder: 1,
    headline: "Open, replicable serving harness across four accelerator generations",
    summary: "The benchmark harness is open source with all results replicable, including unfavorable ones — a rare public baseline for serving-stack research and for validating vendor claims.",
    evidence: [
      ev("t-10-s1", 0, "Harness is open source as of this morning.", "direct-statement"),
      ev("t-10-s5", 1540, "Everything replicates from the repo, including the ugly graphs we don't like.", "direct-statement"),
    ],
    relatedTopicIds: ["t-inference"],
  }),
  ins({
    id: "i-10-2", briefId: "b-10", category: "builder-implications", confidence: 0.84, sortOrder: 2,
    headline: "If your SLO cares about p99, size batches at 128",
    summary: "The contested claim: beyond batch 128, tail latency grows faster than throughput on all four parts tested. Serving teams with p99 SLOs should verify against the open harness before scaling batch size.",
    evidence: [
      ev("t-10-s4", 1350, "Past batch 128, tail latency grows faster than throughput on all four parts.", "direct-statement"),
    ],
  }),
];

/* ——— Briefs ——— */

const brief = (
  id: string,
  appearanceId: string,
  status: InsightBrief["status"],
  overallConfidence: number,
  reviewed = true
): InsightBrief => ({
  id,
  appearanceId,
  status,
  modelVersion: ENRICHMENT_CONFIG.modelVersion,
  generatedAt: status === "queued" ? null : "2026-07-01T00:00:00Z",
  reviewedAt: reviewed && status === "published" ? "2026-07-02T00:00:00Z" : null,
  overallConfidence,
  insightIds: seedInsights.filter((i) => i.insightBriefId === id).map((i) => i.id),
});

export const seedInsightBriefs: InsightBrief[] = [
  brief("b-01", "a-01", "published", 0.87),
  brief("b-02", "a-02", "published", 0.86),
  brief("b-03", "a-03", "published", 0.88),
  brief("b-04", "a-04", "published", 0.79),
  /* Awaiting editorial approval — approve it in /admin to publish. */
  brief("b-05", "a-05", "needs-review", 0.85, false),
  /* Evaluated, nothing met the bar — no insights fabricated. */
  brief("b-06", "a-06", "no-applicable-insights", 0.31),
  brief("b-07", "a-07", "published", 0.84),
  brief("b-08", "a-08", "published", 0.82),
  brief("b-09", "a-09", "published", 0.83),
  brief("b-10", "a-10", "published", 0.85),
  /* Waiting on the a-11 transcript. */
  brief("b-11", "a-11", "queued", 0),
  brief("b-14", "a-14", "generating", 0),
];
