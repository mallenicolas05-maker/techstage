import { sanitizeEvidenceExcerpt } from "@/backend/parsers";
import type { AnalysisProvider, EphemeralAnalysisInput, ProviderContext } from "@/backend/providers/contracts";
import type { AnalysisArtifact, PipelineJob, ProductionPipelineStage } from "@/domain/operations";
import { PRODUCTION_PIPELINE_ORDER } from "@/domain/operations";
import { analysisArtifactSchema } from "@/domain/operationsValidation";

const TERMINAL_JOB_STATES = new Set<PipelineJob["status"]>(["complete", "blocked"]);

export function createPipelineJobs(candidateId: string, now = new Date().toISOString()): PipelineJob[] {
  return PRODUCTION_PIPELINE_ORDER.map((stage, index) => ({
    id: `job-${candidateId}-${index + 1}`,
    candidateId,
    stage,
    status: index === 0 ? "queued" : "blocked",
    attempts: 0,
    maxAttempts: 3,
    availableAt: now,
    lockedAt: null,
    completedAt: null,
    failureCode: null,
    message: index === 0 ? "Ready for local dry-run evaluation." : "Waiting for the previous stage.",
  }));
}

export function assertValidJobTransition(from: PipelineJob["status"], to: PipelineJob["status"]): void {
  const allowed: Record<PipelineJob["status"], PipelineJob["status"][]> = {
    queued: ["running", "blocked"],
    running: ["complete", "failed", "awaiting-review", "blocked"],
    "awaiting-review": ["queued", "blocked"],
    blocked: ["queued"],
    failed: ["queued", "blocked"],
    complete: [],
  };
  if (!allowed[from].includes(to)) throw new Error(`Invalid pipeline job transition: ${from} -> ${to}`);
}

export function nextProductionStage(stage: ProductionPipelineStage): ProductionPipelineStage | null {
  const index = PRODUCTION_PIPELINE_ORDER.indexOf(stage);
  return PRODUCTION_PIPELINE_ORDER[index + 1] ?? null;
}

/**
 * Runs analysis without introducing a transcript repository or a raw-response cache.
 * The only returned value is the validated, bounded artifact safe for persistence.
 */
export async function analyzeEphemeralInput(
  originalInput: EphemeralAnalysisInput,
  provider: AnalysisProvider,
  context: ProviderContext
): Promise<AnalysisArtifact> {
  if (!provider.routes.includes(originalInput.route)) {
    throw new Error(`${provider.id} does not support ${originalInput.route}`);
  }

  let transientTranscript = originalInput.route === "pasted-transcript" ? originalInput.transcript : "";
  const input: EphemeralAnalysisInput = originalInput.route === "pasted-transcript"
    ? { ...originalInput, transcript: transientTranscript }
    : originalInput;

  try {
    const parsed = analysisArtifactSchema.parse(await provider.analyze(input, context));
    const artifact: AnalysisArtifact = {
      ...parsed,
      evidence: parsed.evidence.map((item) => ({
        ...item,
        excerpt: sanitizeEvidenceExcerpt(item.excerpt),
      })),
      chapters: parsed.route === "x-video"
        ? parsed.chapters.map((item) => ({ ...item, startSeconds: null, endSeconds: null }))
        : parsed.chapters,
      highlights: parsed.route === "x-video"
        ? parsed.highlights.map((item) => ({ ...item, startSeconds: null, endSeconds: null }))
        : parsed.highlights,
      rawInputRetained: false,
      rawResponseRetained: false,
    };
    return artifact;
  } finally {
    // Deliberately release the only locally retained transcript reference after the request.
    transientTranscript = "";
  }
}

export function canRunJob(job: PipelineJob): boolean {
  return !TERMINAL_JOB_STATES.has(job.status) && job.attempts < job.maxAttempts;
}
