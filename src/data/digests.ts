import type { DigestIssue, DigestQueueSnapshot } from "@/domain/digest";

export const DIGEST_PANEL_THRESHOLD = 4;
export const DIGEST_MAX_AGE_DAYS = 7;

/**
 * Source-grounded editorial sample using official 2026 event pages.
 * It intentionally contains no attributed quotation or synthetic transcript.
 */
export const sampleDigest: DigestIssue = {
  id: "digest-001",
  issueNumber: 1,
  slug: "001",
  status: "sent",
  triggerReason: "panel_threshold",
  publishedAt: "2026-07-14T13:00:00Z",
  scheduledAt: "2026-07-14T13:00:00Z",
  title: "The stack is becoming the strategy",
  deck: "Four flagship stages pointed to the same shift: AI advantage now depends on the whole system around the model.",
  bigPicture:
    "The summer's largest developer stages moved past model spectacle and into operating systems. NVIDIA framed AI as a five-layer industrial buildout. Google pushed agents into everyday products. Microsoft centered context, control, and heterogeneous infrastructure. Apple brought intelligence closer to personal data and on-device workflows. The common thread is orchestration: capability matters, but dependable delivery now differentiates the platforms.",
  readingMinutes: 9,
  promptVersion: "digest-prompt-v1",
  templateVersion: "stage-notes-v1",
  costUsd: 0.18,
  panels: [
    {
      id: "digest-panel-gtc26",
      appearanceId: "a-gtc-2026-keynote",
      appearanceSlug: "nvidia-gtc-2026-keynote",
      title: "GTC 2026 Keynote",
      event: "NVIDIA GTC 2026",
      occurredAt: "2026-03-16T18:00:00Z",
      durationMinutes: null,
      speakers: [{ id: "s-jensen-huang", slug: "jensen-huang", name: "Jensen Huang", company: "NVIDIA" }],
      imageUrl: null,
      imageAlt: "Editorial placeholder for the NVIDIA GTC 2026 keynote",
      imageCredit: "Official source linked below · image pending editorial approval",
      rightsNote: "Official NVIDIA source · recording remains with its rights holder",
      sections: [
        {
          label: "What was said",
          paragraphs: [
            "NVIDIA presented AI as essential infrastructure spanning energy, chips, infrastructure, models, and applications. The keynote connected accelerated computing with AI factories, agentic systems, open models, and physical AI rather than treating any one layer as the product.",
          ],
        },
        {
          label: "What it means",
          paragraphs: [
            "The competitive unit is widening. Teams choosing a model are also choosing an inference stack, networking assumptions, power envelope, deployment tools, and an ecosystem of partners. Roadmaps that optimize only benchmark performance risk missing the cost and coordination constraints around it.",
          ],
        },
        {
          label: "Where it lands",
          useCases: ["AI factory planning", "Inference capacity", "Physical AI", "Robotics simulation"],
          paragraphs: [
            "The near-term impact lands in infrastructure planning and robotics. Buyers need workload-level capacity models; builders need software that can move between simulation, training, serving, and real-world operation without losing observability.",
          ],
        },
        {
          label: "Why it matters to you",
          paragraphs: [
            "Every product decision now inherits infrastructure consequences. Leaders should ask which layer owns the bottleneck, which dependencies are portable, and whether usage economics remain defensible when demand moves from experiments to persistent agents.",
          ],
        },
      ],
      source: { label: "NVIDIA GTC 2026 keynote", url: "https://www.nvidia.com/gtc/session-catalog/sessions/gtc26-s81595/" },
      useCaseTopicIds: ["t-chips", "t-inference", "t-robotics", "t-energy"],
    },
    {
      id: "digest-panel-io26",
      appearanceId: "a-google-io-2026-keynote",
      appearanceSlug: "google-io-2026-agentic-gemini-era",
      title: "Welcome to the agentic Gemini era",
      event: "Google I/O 2026",
      occurredAt: "2026-05-19T17:00:00Z",
      durationMinutes: null,
      speakers: [{ id: "s-sundar-pichai", slug: "sundar-pichai", name: "Sundar Pichai", company: "Google" }],
      imageUrl: null,
      imageAlt: "Editorial placeholder for the Google I/O 2026 opening keynote",
      imageCredit: "Official Google transcript linked below · image pending editorial approval",
      rightsNote: "Official Google source · edited transcript available at source",
      sections: [
        {
          label: "What was said",
          paragraphs: [
            "Google described an agentic Gemini era built across custom silicon, models, developer platforms, and products used at global scale. Its opening remarks emphasized practical value, lower-cost Flash models, and agents that move from answering questions to completing work.",
          ],
        },
        {
          label: "What it means",
          paragraphs: [
            "Distribution and efficiency are becoming model features. Google's advantage is not only model quality; it is the feedback loop created by deploying models across Search, Workspace, Android, Cloud, and developer APIs while optimizing the infrastructure underneath them.",
          ],
        },
        {
          label: "Where it lands",
          useCases: ["Background agents", "Conversational search", "Developer workflows", "Multimodal creation"],
          paragraphs: [
            "Product teams can expect agents to become ambient rather than destination-based. The implementation work shifts toward permissions, continuity, and deciding when an agent should act without demanding another prompt.",
          ],
        },
        {
          label: "Why it matters to you",
          paragraphs: [
            "The durable question is no longer whether to add AI. It is where proprietary context enters the loop, what the agent may do, and how cost scales when usage becomes continuous instead of occasional.",
          ],
        },
      ],
      source: { label: "Google I/O 2026 opening keynote transcript", url: "https://blog.google/innovation-and-ai/sundar-pichai-io-2026/" },
      useCaseTopicIds: ["t-ai-agents", "t-multimodal-ai", "t-devtools", "t-inference"],
    },
    {
      id: "digest-panel-build26",
      appearanceId: "a-microsoft-build-2026-keynote",
      appearanceSlug: "microsoft-build-2026-keynote",
      title: "Microsoft Build 2026 Keynote",
      event: "Microsoft Build 2026",
      occurredAt: "2026-06-02T16:00:00Z",
      durationMinutes: null,
      speakers: [{ id: "s-satya-nadella", slug: "satya-nadella", name: "Satya Nadella", company: "Microsoft" }],
      imageUrl: null,
      imageAlt: "Editorial placeholder for the Microsoft Build 2026 keynote",
      imageCredit: "Official Microsoft source linked below · image pending editorial approval",
      rightsNote: "Official Microsoft source · recording remains with its rights holder",
      sections: [
        {
          label: "What was said",
          paragraphs: [
            "Microsoft organized its Build announcements around context-rich agents, a heterogeneous full stack, and scientific computing. The keynote connected enterprise knowledge layers with agent governance, local and cloud execution, developer tools, new models, and quantum research.",
          ],
        },
        {
          label: "What it means",
          paragraphs: [
            "Microsoft is treating context and control as infrastructure. The strategy assumes enterprises will use many models and many execution environments, so the defensible layer becomes the system that grounds, governs, observes, and deploys them.",
          ],
        },
        {
          label: "Where it lands",
          useCases: ["Enterprise grounding", "Agent governance", "Local inference", "Scientific workflows"],
          paragraphs: [
            "The strongest near-term fit is work that already crosses organizational systems: research, software delivery, meeting preparation, security review, and knowledge-heavy operations. Those workflows benefit from context but also expose the permission boundaries that prototypes avoid.",
          ],
        },
        {
          label: "Why it matters to you",
          paragraphs: [
            "Teams should evaluate agent platforms by their controls and evidence trails, not only by demos. The winning system may be the one that makes model choice replaceable while keeping organizational context durable.",
          ],
        },
      ],
      source: { label: "Microsoft Build 2026 official coverage", url: "https://news.microsoft.com/build-2026/" },
      useCaseTopicIds: ["t-ai-agents", "t-devtools", "t-data-infrastructure", "t-quantum"],
    },
    {
      id: "digest-panel-wwdc26",
      appearanceId: "a-apple-wwdc-2026-keynote",
      appearanceSlug: "apple-wwdc-2026-keynote",
      title: "WWDC26 Keynote",
      event: "Apple WWDC 2026",
      occurredAt: "2026-06-08T17:00:00Z",
      durationMinutes: 76,
      speakers: [{ id: "s-tim-cook", slug: "tim-cook", name: "Tim Cook", company: "Apple" }],
      imageUrl: null,
      imageAlt: "Editorial placeholder for the Apple WWDC26 keynote",
      imageCredit: "Official Apple Developer video linked below · image pending editorial approval",
      rightsNote: "Official Apple Developer source · recording remains with Apple",
      sections: [
        {
          label: "What was said",
          paragraphs: [
            "Apple's keynote introduced its next software generation around platform improvements, trust and safety, and a new Apple Intelligence and Siri architecture. The developer program extended that direction into app actions, on-device and private-cloud models, evaluations, and agentic development tools.",
          ],
        },
        {
          label: "What it means",
          paragraphs: [
            "Apple is making personal context a platform capability while keeping privacy architecture central to the pitch. That creates a different agent model: one integrated with the operating system, user data, and app actions rather than delivered primarily through a standalone chat surface.",
          ],
        },
        {
          label: "Where it lands",
          useCases: ["Personal assistants", "App actions", "On-device AI", "Private-cloud inference"],
          paragraphs: [
            "Developers gain new ways to expose app capabilities to intelligence embedded across the system. The practical work is semantic: defining safe actions, meaningful entities, clear permission prompts, and graceful behavior when a model cannot complete the task.",
          ],
        },
        {
          label: "Why it matters to you",
          paragraphs: [
            "Platform-native agents can change discovery and retention. Products that expose structured actions and trustworthy context may become more useful without being opened directly, while products that remain opaque risk losing their place in the workflow.",
          ],
        },
      ],
      source: { label: "Apple WWDC26 Keynote", url: "https://developer.apple.com/videos/play/wwdc2026/101/" },
      useCaseTopicIds: ["t-ai-agents", "t-ai-safety", "t-devtools", "t-multimodal-ai"],
    },
  ],
  throughLine: [
    "Across all four stages, the model moved down a layer. Each company used model capability as a starting point, then spent more time on the surrounding system: silicon and power at NVIDIA, distribution and efficiency at Google, context and governance at Microsoft, and personal integration and privacy at Apple.",
    "That convergence matters because it changes where product advantage can live. A thin interface over a model is easy to reproduce. A dependable loop connecting context, permission, action, infrastructure, and evaluation is much harder. The product surface may become quieter while the operating system behind it becomes more consequential.",
    "There is still a real tension. The platforms want agents to act more often, but users and enterprises need tighter control as those actions become consequential. The next cycle will reward teams that make autonomy inspectable rather than merely impressive.",
  ],
  agreements: [
    "Agents are becoming a primary application pattern, not an optional feature.",
    "Efficiency and infrastructure economics now shape product design.",
    "Context is valuable only when permissions and controls travel with it.",
  ],
  tensions: [
    "Cloud-scale orchestration versus private and on-device execution.",
    "Proactive assistance versus explicit user control.",
    "Vertical platform integration versus model and infrastructure choice.",
  ],
  watchNext: [
    { label: "Whether agent permissions converge around shared standards", href: "/topics/ai-agents" },
    { label: "How inference cost changes persistent agent design", href: "/topics/inference" },
    { label: "Which app actions become durable system contracts", href: "/topics/developer-tools" },
  ],
};

export const seedDigests: DigestIssue[] = [sampleDigest];

export const seedDigestQueue: DigestQueueSnapshot = {
  threshold: DIGEST_PANEL_THRESHOLD,
  maxAgeDays: DIGEST_MAX_AGE_DAYS,
  pendingPanelIds: ["a-pending-01", "a-pending-02", "a-pending-03"],
  oldestPendingAt: "2026-07-10T16:00:00Z",
  approvalRequired: true,
  killSwitchEnabled: false,
};

export function getDigestBySlug(slug: string): DigestIssue | null {
  return seedDigests.find((issue) => issue.slug === slug) ?? null;
}
