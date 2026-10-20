import type { Transcript, TranscriptSegment } from "@/domain/types";

/* 10 completed transcripts with diarized segments, plus one
   mid-pipeline ("transcribing") to demonstrate processing states.
   fullText is derived from segments. */

type SegTuple = [start: number, end: number, speakerId: string | null, text: string];

const tr = (
  id: string,
  appearanceId: string,
  sourceType: Transcript["sourceType"],
  segs: SegTuple[],
  opts?: Partial<Pick<Transcript, "processingStatus" | "confidence" | "speakerDiarization" | "reviewedAt">>
): Transcript => {
  const segments: TranscriptSegment[] = segs.map(([startTime, endTime, speakerId, text], i) => ({
    id: `${id}-s${i + 1}`,
    startTime,
    endTime,
    speakerId,
    text,
    confidence: 0.9,
  }));
  return {
    id,
    appearanceId,
    sourceType,
    language: "en",
    fullText: segments.map((s) => s.text).join(" "),
    segments,
    speakerDiarization: opts?.speakerDiarization ?? true,
    confidence: opts?.confidence ?? 0.92,
    processingStatus: opts?.processingStatus ?? "complete",
    generatedAt: "2026-07-01T00:00:00Z",
    reviewedAt: opts?.reviewedAt ?? "2026-07-02T00:00:00Z",
  };
};

export const seedTranscripts: Transcript[] = [
  /* a-01 — The Real Cost of a Token (panel) */
  tr("t-01", "a-01", "official-captions", [
    [0, 180, "s-elliot-shore", "Welcome back to the Substrate stage. Today we're doing something unusual: we're going to put real numbers on what a served token costs. Mira, Ravi, Lena — no adjectives allowed."],
    [180, 540, "s-mira-chen", "Happy to start. The mental model most people carry is that compute is the scarce input. It was, in 2023. It isn't anymore in the way people think."],
    [540, 812, "s-ravi-menon", "If you draw the roofline for a modern serving workload, you hit the memory bandwidth ceiling long before you saturate the arithmetic units. I'll draw it — someone hand me the tablet."],
    [812, 886, "s-mira-chen", "We price tokens like FLOPs are scarce. They aren't. The scarce things are memory bandwidth and megawatts, and our pricing models are still catching up to that."],
    [886, 1500, "s-ravi-menon", "Concretely: across the last four accelerator generations, arithmetic throughput grew about nine times. Delivered bandwidth grew a little over three. That gap is the whole story of serving economics right now."],
    [1500, 1980, "s-mira-chen", "Every serving contract we sign now starts with a power question, not a chip question. Where is the substation, what's the interconnect timeline, who else is in the queue."],
    [1980, 2340, "s-lena-fischer", "And I'd add — the panel keeps saying tokens like they appear from nowhere. Retrieval is thirty percent of your token bill and nobody budgets for it. Every agent request fans out into dozens of lookups before the model sees a prompt."],
    [2340, 2900, "s-ravi-menon", "Lena's number is high for simple chat and low for agents, which is exactly the problem — the mix is shifting toward agents."],
    [2900, 3060, "s-lena-fischer", "Right. Plan for the agent mix. If you budget retrieval at chat-era ratios you will miss by an integer multiple."],
    [3060, 3390, "s-elliot-shore", "Questions from the floor. Yes, in the back."],
    [3390, 3550, "s-mira-chen", "Am I going to state our serving margin on stage? No. What I'll say is: it's thinner than people assume, and it gets thinner every quarter — on purpose. We think price transparency wins this market."],
    [3550, 3720, "s-elliot-shore", "On that almost-answer, we're out of time. Thank you all."],
  ]),

  /* a-02 — Charting the Next Compute Decade (keynote) */
  tr("t-02", "a-02", "official-captions", [
    [0, 95, "s-mira-chen", "Good morning. One chart to start: the fully loaded cost of serving a token, every year from 2016 to 2026. Notice where the curve stops behaving."],
    [95, 420, "s-mira-chen", "The first decade of this curve was transistors. The next decade is not. Density still improves, but it is no longer where the money is."],
    [420, 655, "s-mira-chen", "Our bottleneck analysis is consistent every quarter: packaging capacity, interconnect, and power delivery — in that order."],
    [655, 723, "s-mira-chen", "The roadmap bends at the package, not the transistor. If you remember one sentence today, make it that one."],
    [723, 1320, "s-mira-chen", "Chiplet interconnect budgets are now the first constraint we design against. Our next part spends more area on beachfront than on cores, and that was the right call."],
    [1320, 1620, "s-mira-chen", "On power: two years is the new default for a substation; plan like it's three. We now co-design deployments with generation partners before we tape out."],
    [1620, 1860, "s-mira-chen", "This is why you see chip companies hiring grid engineers. Watch that hiring pattern — it tells you who is serious."],
    [1860, 2010, "s-mira-chen", "Last thing. Markets work better with information. We will publish our serving costs every quarter, starting this one — methodology included."],
    [2010, 2280, "s-mira-chen", "I expect competitors to call this a stunt right up until they match it. Thank you."],
  ], { speakerDiarization: false }),

  /* a-03 — Trellis Loom GA (launch) */
  tr("t-03", "a-03", "official-captions", [
    [0, 240, "s-dario-okafor", "Eighteen months ago we started asking customers a rude question: how many of your agent pilots survived contact with Monday morning? The honest answer was almost none."],
    [240, 520, "s-dario-okafor", "The failures were never exotic. Expired credentials. A changed API. A human who needed to approve step forty and was at lunch."],
    [520, 578, "s-dario-okafor", "Reliability is the product. The model is an ingredient. That's the whole thesis of what we're launching today."],
    [578, 1100, "s-dario-okafor", "Loom is a runtime for long-running agents. Every step is checkpointed. State is durable. A run that dies resumes exactly where it stopped — including a week later."],
    [1100, 1500, "s-marcus-oyelaran", "Let me show you rather than tell you. This is a live procurement agent, forty steps in. I'm going to kill the pod it's running on. Right now."],
    [1500, 1710, "s-marcus-oyelaran", "Gone. And — here — the run resumed from checkpoint thirty-nine on another node. The approval it was waiting on is still pending. Nothing lost."],
    [1710, 2100, "s-marcus-oyelaran", "Approval queues are first-class. A human can hold, edit, or reject any step, from Slack or from the console, and the agent waits — durably."],
    [2100, 2460, "s-dario-okafor", "Pricing. Loom bills per step, so an idle agent costs you nothing. No seats, no reserved capacity. Your bill is your throughput."],
    [2460, 2680, "s-dario-okafor", "Loom is generally available today in three regions; Europe follows in August. The reliability SLA is in the docs — it has numbers in it, which apparently makes it unusual."],
    [2680, 2820, "s-dario-okafor", "Thanks for building with us. The failure recovery demo is on the site — uncut."],
  ]),

  /* a-04 — Powering the Buildout (fireside) */
  tr("t-04", "a-04", "asr", [
    [0, 300, "s-ingrid-solheim", "I spent twelve years operating grid assets before fusion, so my view of the AI buildout is unromantic: it's load. Enormous, lumpy, impatient load."],
    [300, 700, "s-ingrid-solheim", "The interconnect queue is the timeline. Not the reactor physics, not the chip supply. In several markets you're looking at seven years to connect a gigawatt."],
    [700, 980, "s-ingrid-solheim", "That's why we go behind the meter. Co-locate generation with the campus, skip the queue, sell firm power at a known price."],
    [980, 1052, "s-ingrid-solheim", "A month in an interconnect queue costs more than a year of turbine R&D. That sentence is our entire siting strategy."],
    [1052, 1420, "s-ingrid-solheim", "We site generation where the compute wants to live, not where the grid is happy. It inverts fifty years of habit and it is the only version of the math that closes."],
    [1420, 1800, "s-ingrid-solheim", "On timelines: our first compact unit is producing on a customer campus now. Second and third are in construction. I won't give you a gigawatt date; I'll give you a unit count every quarter."],
    [1800, 2200, "s-ingrid-solheim", "The thing I want this audience to take seriously: power procurement is now a core competency of compute companies. If your roadmap doesn't have an energy chapter, it's fiction."],
    [2200, 2460, "s-ingrid-solheim", "Questions? And yes, I'll take the tokamak one first, there's always one."],
  ], { confidence: 0.86 }),

  /* a-05 — Whose Weights Are They Anyway? (panel) */
  tr("t-05", "a-05", "official-captions", [
    [0, 260, "s-nadia-petrova", "Let's set the table. Bramble-3 shipped with open weights, full data documentation, and a permissive license. Downloads passed a million in the first week. That's the state of play."],
    [260, 780, "s-tomas-reyes", "And the license debate is, frankly, over. Permissive licensing already won; the argument now is about who pays. Training runs are nine figures. Goodwill doesn't compound at that scale."],
    [780, 1290, "s-nadia-petrova", "What open weights actually enabled this year: three national deployments, an entire eval ecosystem, and fine-tunes in languages no closed lab will ever prioritize."],
    [1290, 1680, "s-hannah-kessler", "I'll be the villain. There is no venture math for a two-billion-dollar training run with free weights. There's philanthropic math, sovereign math, maybe hyperscaler math. Not venture math."],
    [1680, 2100, "s-yuki-tanaka", "Where I'll push back on the doom: evals are the one place open and closed labs actually cooperate. The eval commons is real infrastructure, and it's open by necessity — a private benchmark is a broken benchmark."],
    [2100, 2520, "s-tomas-reyes", "Agreed, and it's why we publish failures too. The commons only works if negative results go in."],
    [2520, 2900, "s-hannah-kessler", "So the resolution is unbundling: open weights as public good, funded by states and hyperscalers; venture returns move up the stack to serving, tooling, and applications."],
    [2900, 3300, "s-yuki-tanaka", "Which, note, is roughly what happened to operating systems. We've seen this movie."],
  ]),

  /* a-06 — Contact-Rich Manipulation (lecture — deliberately few premium-worthy claims) */
  tr("t-06", "a-06", "official-captions", [
    [0, 400, "s-claire-dubois", "This lecture is a survey, and surveys should start with definitions. By contact-rich manipulation I mean tasks where the contact dynamics dominate the control problem — insertion, cable routing, bin picking with entanglement."],
    [400, 900, "s-claire-dubois", "We'll review eleven benchmark families. For each: what it measures, what it correlates with, and whether that correlation survives contact with a real production cell."],
    [900, 1600, "s-claire-dubois", "The pattern you'll see repeatedly: benchmarks reward peak success rate, deployments care about tail behavior. A 95 percent policy that fails unpredictably is worth less than an 88 percent policy that fails legibly."],
    [1600, 2300, "s-claire-dubois", "On simulation: the transfer literature is healthier than five years ago, but selective reporting remains the field's biggest problem. Negative transfer results are almost never published."],
    [2300, 2980, "s-claire-dubois", "Methodologically, insist on: video of consecutive unedited trials, intervention counts, and the reset story. If a demo hides its resets, the resets are the story."],
    [2980, 3200, "s-claire-dubois", "Here is the checklist I promised, and I encourage you to apply it to every robotics demo you see this year — including ours."],
    [3200, 3480, "s-claire-dubois", "Next week: tactile sensing, and why the skin is not solved. Thank you."],
  ], { speakerDiarization: false }),

  /* a-07 — Robots That Pay Rent (interview) */
  tr("t-07", "a-07", "official-captions", [
    [0, 340, "s-elliot-shore", "Priya Raghavan, CEO of Corvid Robotics. You said you'd bring fleet numbers. Everyone says that."],
    [340, 640, "s-priya-raghavan", "I brought the dashboard. Screen-share on. This is the live fleet: 2,140 Fieldhand units across 31 customer sites."],
    [640, 1210, "s-priya-raghavan", "Intervention rate is 0.4 per robot-hour; two years ago it was 4. That single number is the company. Everything we do either moves it or doesn't matter."],
    [1210, 1710, "s-priya-raghavan", "Cycle times we're proud of. What we're not proud of: novelty. New SKU, new packaging, new tape on the box — performance drops off a cliff you can chart."],
    [1710, 1765, "s-priya-raghavan", "Honestly? Our robots fail at doors, tape, and Mondays. Doors because facilities modify them, tape because vision hates specularity, and Mondays because humans rearrange everything over the weekend."],
    [1765, 2400, "s-elliot-shore", "Walk me through the economics of an intervention."],
    [2400, 2860, "s-priya-raghavan", "Every intervention costs us about eleven dollars fully loaded and, more importantly, costs the customer trust. Below 0.2 per robot-hour, the contract structurally changes — you can sell outcomes instead of units."],
    [2860, 3035, "s-priya-raghavan", "We interview for systems debugging, not RL papers. Give me someone who can read a stack trace across firmware, perception, and planning. The learning stack is the easy part to hire for now."],
    [3035, 3600, "s-priya-raghavan", "That's also a message to grad students: the shortage is in people who can own a whole failure, end to end."],
    [3600, 4200, "s-priya-raghavan", "Roadmap: the Atlas platform. Higher payload, but the real change is self-diagnosis — the robot files its own incident report before the customer notices."],
    [4200, 4440, "s-elliot-shore", "Priya Raghavan, thank you. The dashboard screenshot is in the show notes, with permission."],
  ]),

  /* a-08 — Where the Returns Are (investor conversation) */
  tr("t-08", "a-08", "official-captions", [
    [0, 380, "s-elliot-shore", "Eleanor Voss and Hannah Kessler of Ninefold. The thesis on the table: venture returns in a cycle where infrastructure eats the capital."],
    [380, 900, "s-eleanor-voss", "Start with the uncomfortable arithmetic. The capex going into compute this cycle is sovereign-scale. Venture funds are rounding errors against it. You cannot own the bottom of this stack, so stop pretending."],
    [900, 1430, "s-eleanor-voss", "Eighteen months ago we stopped funding thin wrappers — anything whose moat is a prompt and a UI. We also stopped funding pre-revenue chips. Both decisions cost us social capital and made us money."],
    [1430, 2040, "s-hannah-kessler", "Where we lean in: businesses that get cheaper to run every time the model layer improves. Tooling, evals, vertical agents with proprietary workflow data. The model tide lifts their margins, not their costs."],
    [2040, 2102, "s-eleanor-voss", "Infrastructure absorbs alpha. The returns that used to live in the application layer are being taxed by the compute bill on the way up."],
    [2102, 2700, "s-hannah-kessler", "Ownership math matters more than picking right now. Same portfolio, ten points less ownership, and the fund doesn't return. That's the quiet crisis — entry prices, not company quality."],
    [2700, 3230, "s-eleanor-voss", "The fund I'd raise today is half the size and twice the reserve ratio. Concentrated, boring, and structured to buy more of what works at the ugly round, because there will be ugly rounds."],
    [3230, 3700, "s-hannah-kessler", "And to founders listening: raise for the workload you can bill for this year, not the one in the deck. The market has stopped paying for the deck."],
    [3700, 4080, "s-elliot-shore", "Usual disclaimer that none of this is investment advice — and both of you nodded harder at that than at anything else in the hour."],
  ]),

  /* a-09 — Agents That Survive Monday Morning (fireside) */
  tr("t-09", "a-09", "official-captions", [
    [0, 320, "s-dario-okafor", "Let me start with the graveyard. We surveyed 120 enterprise agent pilots. Seventy-one never reached production. The causes are so boring you'll be angry."],
    [320, 660, "s-dario-okafor", "Credential expiry. Schema drift. A required human approval with no queue to live in. Not one pilot died because the model wasn't smart enough."],
    [660, 1210, "s-dario-okafor", "So the design conclusion we kept arriving at: agent state has to be durable and inspectable, like a database, not ephemeral, like a chat session."],
    [1210, 1680, "s-dario-okafor", "Checkpoint every step. Make resumption a first-class operation. Let a run pause for a human for three days without holding a connection open. None of this is glamorous. All of it is the product."],
    [1680, 1728, "s-dario-okafor", "Bill for the step, not the seat. Incentives follow billing — if you charge for seats, you build dashboards; if you charge for steps, you build reliability."],
    [1728, 2280, "s-dario-okafor", "We're testing these ideas with design partners now. I'm not announcing anything today — but watch this space in early summer."],
    [2280, 2640, "s-dario-okafor", "Questions. Yes — the eval one first, I saw the hand go up during the graveyard slide."],
  ]),

  /* a-10 — Batching Is All You Need (technical) */
  tr("t-10", "a-10", "official-captions", [
    [0, 300, "s-ravi-menon", "No vision statements in this talk, only measurements. Setup: same serving workload, four accelerator generations, identical batching policy, harness is open source as of this morning."],
    [300, 860, "s-ravi-menon", "Result one: continuous batching closes 60 to 80 percent of the gap between naive serving and the theoretical roofline, on every generation tested."],
    [860, 1350, "s-ravi-menon", "Result two: paged attention's win is memory fragmentation, not speed. Fragmentation under mixed sequence lengths drops from 31 percent to under 4."],
    [1350, 1540, "s-ravi-menon", "Result three, the one people will argue about: past batch 128, tail latency grows faster than throughput on all four parts. If your SLO cares about p99, your roofline lives at 128, not at what marketing says."],
    [1540, 1780, "s-ravi-menon", "Everything replicates from the repo, including the ugly graphs we don't like. Pull requests welcome — especially ones proving me wrong on the p99 claim."],
    [1780, 1920, "s-ravi-menon", "That's the talk. Numbers slide is a QR code, because I want you to have the numbers, not photos of me."],
  ], { speakerDiarization: false }),

  /* a-11 — processing state (partial ASR) */
  tr("t-11", "a-11", "asr", [
    [0, 340, "s-viktor-hessel", "Thank you. I want to talk about production capacity as a strategic variable — not autonomy in the abstract, but the industrial base that has to build it."],
    [340, 720, "s-viktor-hessel", "[transcription in progress]"],
  ], { processingStatus: "transcribing", confidence: 0.55, reviewedAt: null, speakerDiarization: false }),
];
