import { corsHeaders, errorResponse, json } from "../_shared/runtime.ts";
import { listYouTubeVideoDetails } from "../_shared/provider-clients.ts";
import { deleteStorageObject, enforceRateLimit, serviceRequest, setupAdmin, uploadStorageObject } from "../_shared/supabase.ts";

const youtubeId = (value: string) => {
  try {
    const url = new URL(value);
    if (["youtu.be"].includes(url.hostname)) return url.pathname.slice(1).match(/^[\w-]{11}$/)?.[0] ?? null;
    if (url.hostname.endsWith("youtube.com")) return (url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1] ?? null)?.match(/^[\w-]{11}$/)?.[0] ?? null;
  } catch { /* handled below */ }
  return null;
};

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    const user = await setupAdmin();
    await enforceRateLimit(`manual-intake:${user.id}`, 30, 60);
    const body = await request.json() as { url?: unknown; title?: unknown; speakers?: unknown; transcript?: unknown; transcriptUrl?: unknown; referenceBrief?: unknown };
    const submittedUrl = typeof body.url === "string" ? body.url.trim() : "";
    const suppliedTitle = typeof body.title === "string" ? body.title.trim().slice(0, 500) : "";
    const speakerNames = Array.isArray(body.speakers)
      ? body.speakers.filter((value): value is string => typeof value === "string").map((value) => value.trim().slice(0, 200)).filter(Boolean).slice(0, 20)
      : [];
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const transcriptUrl = typeof body.transcriptUrl === "string" ? body.transcriptUrl.trim() : "";
    const referenceBrief = typeof body.referenceBrief === "string" ? body.referenceBrief.trim().slice(0, 50_000) : "";
    if (!/^https:\/\//i.test(submittedUrl)) return json({ error: "A public HTTPS URL is required." }, 400, cors);
    if (transcriptUrl && !/^https:\/\//i.test(transcriptUrl)) return json({ error: "Transcript URL must use HTTPS." }, 400, cors);
    if (transcript && (transcript.length < 40 || transcript.length > 1_500_000)) return json({ error: "A transcript must be between 40 and 1,500,000 characters." }, 400, cors);
    const videoId = youtubeId(submittedUrl);
    let canonicalUrl = submittedUrl; let provider = "manual"; let candidateId: string | null = null; let status = "needs-review";
    if (videoId) {
      const details = await listYouTubeVideoDetails([videoId], "automation") as { items?: Array<Record<string, any>> };
      const video = details.items?.[0];
      if (!video || video.status?.privacyStatus !== "public") return json({ error: "That YouTube video is unavailable or private." }, 400, cors);
      canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`; provider = "youtube";
      const existing = await serviceRequest(`ingestion_candidates?select=id&source_fingerprint=eq.youtube:${videoId}&limit=1`);
      const matches = existing.ok ? await existing.json() as Array<{ id: string }> : [];
      if (matches[0]) { candidateId = matches[0].id; status = "duplicate"; }
      else {
        const inserted = await serviceRequest("ingestion_candidates", { method: "POST", body: JSON.stringify({
          source_url: canonicalUrl, source_provider: "youtube", source_fingerprint: `youtube:${videoId}`,
          title: suppliedTitle || String(video.snippet?.title ?? "Manual YouTube submission").slice(0, 300), submitted_by: user.id,
          context_summary: speakerNames.length ? `Speakers: ${speakerNames.join(", ")}`.slice(0, 2000) : "Manual YouTube submission awaiting source verification.", status: "discovered", current_stage: "discover-source",
        }) });
        const rows = inserted.ok ? await inserted.json() as Array<{ id: string }> : [];
        candidateId = rows[0]?.id ?? null; status = candidateId ? "queued" : "needs-review";
      }
    }
    const transcriptPath = transcript ? `manual/${user.id}/${crypto.randomUUID()}.txt` : null;
    if (transcriptPath) await uploadStorageObject("manual-transcripts", transcriptPath, new TextEncoder().encode(transcript).buffer as ArrayBuffer, "text/plain; charset=utf-8");
    let submission: Response;
    try {
      submission = await serviceRequest("manual_submissions", { method: "POST", body: JSON.stringify({
        submitted_by: user.id, submitted_url: submittedUrl, canonical_url: canonicalUrl, provider,
        external_id: videoId, title: suppliedTitle || null, speaker_names: speakerNames,
        note: referenceBrief ? "Reference brief supplied; it requires source verification before use." : null,
        reference_brief: referenceBrief || null, status, candidate_id: status === "queued" ? candidateId : null,
        duplicate_of_candidate_id: status === "duplicate" ? candidateId : null,
        transcript_storage_path: transcriptPath, transcript_url: transcriptUrl || null, transcript_status: transcriptPath || transcriptUrl ? "received" : "none",
        transcript_purge_after: transcriptPath ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
      }) });
    } catch (error) {
      if (transcriptPath) await deleteStorageObject("manual-transcripts", [transcriptPath]);
      throw error;
    }
    if (!submission.ok) {
      if (transcriptPath) await deleteStorageObject("manual-transcripts", [transcriptPath]);
      throw new Error(`Manual submission could not be saved: ${submission.status}`);
    }
    return json({ ...(await submission.json() as Array<Record<string, unknown>>)[0], candidateId }, 201, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});
