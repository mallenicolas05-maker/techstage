import { corsHeaders, errorResponse, json } from "../_shared/runtime.ts";
import { insertAudit, serviceRequest, setupAdmin, uploadStorageObject } from "../_shared/supabase.ts";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  try {
    const admin = await setupAdmin();
    const form = await request.formData();
    const candidateId = String(form.get("candidateId") ?? "");
    const entityId = String(form.get("entityId") ?? "");
    const entityType = String(form.get("entityType") ?? "");
    const file = form.get("file");
    if ((!/^[a-f0-9-]{36}$/i.test(candidateId) && (!/^[a-f0-9-]{36}$/i.test(entityId) || !["company", "speaker", "event"].includes(entityType))) || !(file instanceof File)) return json({ error: "invalid_upload" }, 400, cors);
    if (!allowed.has(file.type) || file.size <= 0 || file.size > 6_000_000) return json({ error: "invalid_image" }, 400, cors);
    let candidate: { id: string; entity_type: string; stable_slug: string; status: string } | undefined;
    if (candidateId) {
      const candidateResponse = await serviceRequest(`entity_candidates?select=id,entity_type,stable_slug,status&id=eq.${candidateId}&limit=1`);
      [candidate] = await candidateResponse.json() as Array<{ id: string; entity_type: string; stable_slug: string; status: string }>;
      if (!candidate || ["activated", "rejected", "archived"].includes(candidate.status)) return json({ error: "candidate_not_uploadable" }, 409, cors);
    }
    const bytes = await file.arrayBuffer();
    const dimensions = readImageDimensions(new Uint8Array(bytes), file.type);
    if (!dimensions || dimensions.width < 64 || dimensions.height < 64 || dimensions.width > 12000 || dimensions.height > 12000) return json({ error: "invalid_dimensions" }, 400, cors);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    if (entityId) {
      const table = entityType === "company" ? "companies" : entityType === "speaker" ? "speakers" : "events";
      const entities = await serviceRequest(`${table}?select=id,slug,name,status&id=eq.${entityId}&status=eq.published&limit=1`);
      const [entity] = await entities.json() as Array<{ id: string; slug: string; name: string }>;
      if (!entity) return json({ error: "entity_not_editable" }, 409, cors);
      const path = `revision/${entityType}/${entity.slug}/${crypto.randomUUID()}.${extension}`;
      await uploadStorageObject("entity-candidate-uploads", path, bytes, file.type);
      const deliveryPath = `entity/${entityType}/${entity.slug}/revision-${checksum.slice(0, 12)}.${extension}`;
      await uploadStorageObject("entity-assets", deliveryPath, bytes, file.type);
      const assets = await serviceRequest("assets", { method: "POST", body: JSON.stringify({ entity_type: entityType, entity_id: entityId, entity_slug: entity.slug, provider: "official", source_url: `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/authenticated/entity-candidate-uploads/${path}`, license_label: "Admin supplied", storage_path: deliveryPath, source_storage_path: path, checksum_sha256: checksum, attribution_text: "TechStage editorial upload", alt_text: `${entity.name} image`, status: "approved", approved_at: new Date().toISOString() }) });
      const [asset] = await assets.json() as Array<{ id: string }>;
      if (!asset?.id) throw new Error("Unable to prepare image revision");
      await serviceRequest("asset_variants?on_conflict=storage_path", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ asset_id: asset.id, variant: "admin-original", format: extension, content_type: file.type, width: dimensions.width, height: dimensions.height, byte_size: bytes.byteLength, checksum_sha256: checksum, storage_path: deliveryPath }) });
      const revisions = await serviceRequest("entity_image_revisions", { method: "POST", body: JSON.stringify({ entity_type: entityType, entity_id: entityId, storage_path: path, checksum, mime_type: file.type, asset_id: asset.id, requested_by: admin.id, status: "ready" }) });
      const [revision] = await revisions.json() as Array<{ id: string }>;
      await insertAudit(admin.id, "admin.stage-entity-image-revision", entityType, entityId, "Image revision is ready for the next daily intake.");
      return json({ accepted: true, revisionId: revision?.id ?? null, readyForActivation: true, dimensions }, 201, cors);
    }
    if (!candidate) return json({ error: "invalid_upload" }, 400, cors);
    const path = `pending/${candidate.entity_type}/${candidate.stable_slug}/${crypto.randomUUID()}.${extension}`;
    await uploadStorageObject("entity-candidate-uploads", path, bytes, file.type);
    const update = await serviceRequest(`entity_candidates?id=eq.${candidateId}`, { method: "PATCH", body: JSON.stringify({ pending_upload_path: path, pending_upload_checksum: checksum, image_status: "pending", status: "needs-image" }) });
    if (!update.ok) throw new Error("Unable to record the pending upload");
    await serviceRequest("jobs?on_conflict=idempotency_key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ kind: "entity-image-prepare", stage: "entity-image-prepare", status: "queued", payload: { candidateId }, idempotency_key: `entity-image:${candidateId}:${checksum}`, max_attempts: 3 }) });
    await serviceRequest("rpc/invoke_job_runner", { method: "POST", body: "{}" });
    await insertAudit(admin.id, "admin.upload-entity-image", "entity-candidate", candidateId, `Private ${file.type} upload staged for asset review (${file.size} bytes).`);
    return json({ accepted: true, path, checksum, dimensions, queuedForPreparation: true }, 201, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});

function readImageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png" && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (mime === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) { if (bytes[offset] !== 0xff) { offset += 1; continue; } const marker = bytes[offset + 1]; const length = view.getUint16(offset + 2); if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }; if (length < 2) break; offset += 2 + length; }
  }
  if (mime === "image/webp" && bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8X") return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (kind === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (kind === "VP8L") { const bits = view.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}
