import { corsHeaders, errorResponse, json, runtime } from "../_shared/runtime.ts";
import { analyzeTranscriptWithOpenAI, analyzeWithGemini } from "../_shared/provider-clients.ts";
import { ANALYSIS_SCHEMA, analysisPrompt } from "../_shared/prompts.ts";
import { enforceRateLimit, requireAdmin, serviceRequest } from "../_shared/supabase.ts";

type Route = "pasted-transcript" | "youtube-video" | "x-video";
type RequestBody = { candidateId: string; route: Route; transcript?: string; durationSeconds?: number; approvedMaximumUsd: number; dryRun?: boolean };

const PRICE = {
  openAITextInput: 0.05,
  openAIOutput: 0.40,
  videoInput: 0.25,
  audioInput: 0.50,
  geminiOutput: 1.50,
};

const estimate = (body: RequestBody) => {
  const outputTokens = 4_096;
  const inputTokens = body.route === "pasted-transcript"
    ? Math.ceil((body.transcript ?? "").trim().split(/\s+/).length / 0.75) + 1_500
    : Math.max(0, body.durationSeconds ?? 0) * 98;
  const usd = body.route === "pasted-transcript"
    ? inputTokens / 1_000_000 * PRICE.openAITextInput + outputTokens / 1_000_000 * PRICE.openAIOutput
    : Math.max(0, body.durationSeconds ?? 0) * 66 / 1_000_000 * PRICE.videoInput
      + Math.max(0, body.durationSeconds ?? 0) * 32 / 1_000_000 * PRICE.audioInput
      + outputTokens / 1_000_000 * PRICE.geminiOutput;
  return { inputTokens, outputTokens, usd };
};

const boundedStrings = (value: unknown, maximum: number, length: number): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, maximum).map((item) => item.slice(0, length)) : [];

const boundedMoments = (value: unknown, maximum: number) => Array.isArray(value) ? value.slice(0, maximum).map((item) => {
  const moment = item && typeof item === "object" ? item as Record<string, unknown> : {};
  const start = Number.isFinite(Number(moment.startSeconds)) ? Math.max(0, Number(moment.startSeconds)) : null;
  const end = Number.isFinite(Number(moment.endSeconds)) ? Math.max(0, Number(moment.endSeconds)) : null;
  return {
    title: typeof moment.title === "string" ? moment.title.slice(0, 180) : "Untitled moment",
    summary: typeof moment.summary === "string" ? moment.summary.slice(0, 600) : "",
    startSeconds: start,
    endSeconds: start != null && end != null && end > start ? end : null,
    kind: ["highlight", "quote", "demo", "qa", "announcement"].includes(String(moment.kind)) ? moment.kind : "highlight",
  };
}) : [];

function validateArtifact(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Structured analysis response is not an object");
  const record = value as Record<string, unknown>;
  if (typeof record.summary !== "string" || record.summary.length < 1 || record.summary.length > 4_000) throw new Error("Invalid analysis summary");
  const allowedTypes = new Set(["panel", "interview", "product-launch", "technical-talk", "podcast", "livestream"]);
  if (typeof record.appearanceType !== "string" || !allowedTypes.has(record.appearanceType)) throw new Error("Invalid appearance type");
  const confidence = Number(record.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("Invalid confidence");
  return {
    summary: record.summary,
    appearanceType: record.appearanceType,
    speakerNames: boundedStrings(record.speakerNames, 40, 180),
    companyNames: boundedStrings(record.companyNames, 40, 180),
    eventName: typeof record.eventName === "string" ? record.eventName.slice(0, 240) : null,
    topics: boundedStrings(record.topics, 30, 100),
    chapters: boundedMoments(record.chapters, 24),
    highlights: boundedMoments(record.highlights, 8),
    evidence: Array.isArray(record.evidence) ? record.evidence.slice(0, 40).map((item) => {
      const evidence = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const kind = ["direct-statement", "summary", "cautious-inference", "model-interpretation"].includes(String(evidence.kind)) ? String(evidence.kind) : "summary";
      const evidenceConfidence = Math.min(1, Math.max(0, Number(evidence.confidence) || 0));
      const timestampSeconds = Number.isFinite(Number(evidence.timestampSeconds)) ? Math.max(0, Number(evidence.timestampSeconds)) : null;
      return { timestampSeconds, excerpt: typeof evidence.excerpt === "string" ? evidence.excerpt.replace(/\s+/g, " ").trim().slice(0, 280) : "", confidence: evidenceConfidence, kind };
    }) : [],
    confidence,
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  let transcript = "";
  let rawResponse: unknown = null;
  let reservationId: string | null = null;
  let reconciled = false;
  try {
    const admin = await requireAdmin(request);
    await enforceRateLimit(`analysis:${admin.id}`, 30, 60);
    const body = await request.json() as RequestBody;
    if (!body.candidateId) return json({ error: "invalid_request" }, 400, cors);
    const candidateResponse = await serviceRequest(`ingestion_candidates?select=canonical_media_url,resulting_appearance_id,appearance_slug&id=eq.${body.candidateId}&limit=1`);
    const candidateRows = await candidateResponse.json() as Array<{ canonical_media_url: string | null; resulting_appearance_id: string | null; appearance_slug: string | null }>;
    const candidate = candidateRows[0];
    if (!candidate?.canonical_media_url || !candidate.canonical_media_url.startsWith("https://")) return json({ error: "canonical_source_required" }, 412, cors);
    const sourceUrl = candidate.canonical_media_url;
    if (body.route === "x-video") return json({ error: "pilot_required", message: "X video analysis remains blocked until a measured pilot establishes cost." }, 412, cors);
    transcript = body.route === "pasted-transcript" ? body.transcript ?? "" : "";
    if (body.route === "pasted-transcript" && (transcript.length < 40 || transcript.length > 1_500_000)) return json({ error: "invalid_transcript" }, 400, cors);
    const cost = estimate(body);
    if (!Number.isFinite(body.approvedMaximumUsd) || cost.usd > body.approvedMaximumUsd) return json({ error: "approval_ceiling", estimate: cost }, 412, cors);
    if (body.dryRun !== false || runtime.dryRun || !runtime.externalEnabled) return json({ dryRun: true, estimate: cost, sourceUrl, message: "Analysis preflight completed without a provider call." }, 202, cors);
    const provider = body.route === "pasted-transcript" ? "openai-transcript-analysis" : "gemini-youtube-video";
    const providerGroup = body.route === "pasted-transcript" ? "openai-backfill" : "gemini-backfill";
    const model = body.route === "pasted-transcript" ? "gpt-5-nano" : "gemini-3.1-flash-lite";
    const promptVersion = body.route === "pasted-transcript" ? "analysis-v3-transcript-openai" : "analysis-v2-youtube";
    const promptCheck = await serviceRequest(`prompt_versions?select=id&id=eq.${promptVersion}&active=eq.true&limit=1`);
    const activePrompts = await promptCheck.json();
    if (!Array.isArray(activePrompts) || activePrompts.length !== 1) throw new Error("The requested prompt version has not passed activation review");
    const budget = await serviceRequest("rpc/reserve_provider_budget_v2", { method: "POST", body: JSON.stringify({ requested_provider: provider, requested_group: providerGroup, reservation_key: `manual:${body.candidateId}:${crypto.randomUUID()}`, maximum_usd: cost.usd, requested_requests: 1, requested_credits: 0 }) });
    if (!budget.ok) throw new Error("Provider budget rejected analysis");
    const reservation = await budget.json() as { id: string };
    reservationId = reservation.id;
    const prompt = analysisPrompt(body.route);
    rawResponse = body.route === "pasted-transcript"
      ? await analyzeTranscriptWithOpenAI(prompt, transcript, ANALYSIS_SCHEMA)
      : await analyzeWithGemini("gemini-3.1-flash-lite", [{ role: "user", parts: [{ text: prompt }, { fileData: { fileUri: sourceUrl } }] }], ANALYSIS_SCHEMA);
    const responseRecord = rawResponse as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = body.route === "pasted-transcript"
      ? responseRecord.output_text ?? responseRecord.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text
      : responseRecord.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
    if (!text) throw new Error(`${body.route === "pasted-transcript" ? "OpenAI" : "Gemini"} returned no structured result`);
    const artifact = validateArtifact(JSON.parse(text));
    const usage = body.route === "pasted-transcript" ? responseRecord.usage ?? {} : responseRecord.usageMetadata ?? {};
    const inputTokens = body.route === "pasted-transcript"
      ? Number("input_tokens" in usage ? usage.input_tokens ?? cost.inputTokens : cost.inputTokens)
      : Number("promptTokenCount" in usage ? usage.promptTokenCount ?? cost.inputTokens : cost.inputTokens);
    const outputTokens = body.route === "pasted-transcript"
      ? Number("output_tokens" in usage ? usage.output_tokens ?? cost.outputTokens : cost.outputTokens)
      : Number("candidatesTokenCount" in usage ? usage.candidatesTokenCount ?? cost.outputTokens : cost.outputTokens);
    const actualUsd = body.route === "pasted-transcript"
      ? inputTokens / 1_000_000 * PRICE.openAITextInput + outputTokens / 1_000_000 * PRICE.openAIOutput
      : cost.usd;
    await serviceRequest("rpc/reconcile_provider_budget", { method: "POST", body: JSON.stringify({ reservation_uuid: reservation.id, charged_usd: actualUsd }) });
    reconciled = true;
    const inserted = await serviceRequest("analysis_artifacts", { method: "POST", body: JSON.stringify({
      candidate_id: body.candidateId, appearance_id: candidate.resulting_appearance_id, route: body.route, model, prompt_version: promptVersion,
      summary: artifact.summary, appearance_type: artifact.appearanceType, speaker_names: artifact.speakerNames,
      company_names: artifact.companyNames, event_name: artifact.eventName, topics: artifact.topics,
      chapters: artifact.chapters, highlights: artifact.highlights, evidence: artifact.evidence, confidence: artifact.confidence,
      raw_input_retained: false, raw_response_retained: false, generated_at: new Date().toISOString(),
    }) });
    if (!inserted.ok) throw new Error(`Artifact persistence failed: ${inserted.status}`);
    await serviceRequest("provider_usage", { method: "POST", body: JSON.stringify({ provider, period: new Date().toISOString().slice(0, 7), operation: body.route, request_count: 1, input_tokens: inputTokens, output_tokens: outputTokens, estimated_usd: cost.usd, actual_usd: actualUsd, candidate_id: body.candidateId, model, connector: "api", provenance: "runtime", cost_basis: "derived-from-provider-usage" }) });
    return json({ artifact: await inserted.json(), materialization: { chapters: artifact.chapters, highlights: artifact.highlights, evidence: artifact.evidence } }, 201, cors);
  } catch (error) {
    if (reservationId && !reconciled) await serviceRequest("rpc/release_provider_budget", { method: "POST", body: JSON.stringify({ reservation_uuid: reservationId }) });
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  } finally {
    transcript = "";
    rawResponse = null;
  }
});
