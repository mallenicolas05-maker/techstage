import {
  corsHeaders,
  errorResponse,
  json,
  runtime,
} from "../_shared/runtime.ts";
import {
  createSignedStorageUrl,
  enforceRateLimit,
  insertAudit,
  serviceRequest,
  setupAdmin,
} from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  try {
    const admin = await setupAdmin();
    await enforceRateLimit(`setup-admin:${admin.id}`, 120, 60);
    if (request.method === "GET") {
      const responses = await Promise.all([
        serviceRequest(
          "discovery_runs?select=*&order=created_at.desc&limit=25",
        ),
        serviceRequest("jobs?select=*&order=created_at.desc&limit=50"),
        serviceRequest("cost_budgets?select=*&order=provider"),
        serviceRequest(
          "provider_usage?select=*&order=created_at.desc&limit=500",
        ),
        serviceRequest("source_registry?select=*&order=priority,name"),
        serviceRequest(
          "ingestion_candidates?select=id,title,source_url,status,current_stage,blocker_code,blocker_reason,requested_action,retry_count,last_attempt_at,next_eligible_attempt_at,resulting_appearance_id,updated_at&status=eq.needs-review&order=updated_at.desc&limit=100",
        ),
        serviceRequest(
          "entity_candidates?select=*&order=prominence_score.desc,name.asc&limit=1000",
        ),
        serviceRequest(
          "discovery_targets?select=*&order=created_at.desc&limit=1000",
        ),
        serviceRequest(
          "assets?select=id,entity_type,entity_slug,status,provider,source_url,created_at&status=in.(candidate,processing)&order=created_at.desc&limit=100",
        ),
        serviceRequest(
          "appearances?select=id,slug,title,published_at,public_ready_at,canonical_media:media_sources!appearances_canonical_source_fk(source_url,embed_url,channel_name,thumbnail_url,duration_seconds)&status=eq.published&public_ready_at=not.is.null&order=public_ready_at.desc&limit=100",
        ),
        serviceRequest(
          "companies?select=id,slug,name,description,prominence_score,status,created_at,image_asset:assets!companies_logo_fk(id,asset_variants(variant,format,storage_path))&status=eq.published&order=prominence_score.desc,name.asc&limit=500",
        ),
        serviceRequest(
          "speakers?select=id,slug,name,headline,biography,prominence_score,status,created_at,image_asset:assets!speakers_headshot_fk(id,asset_variants(variant,format,storage_path))&status=eq.published&order=prominence_score.desc,name.asc&limit=500",
        ),
        serviceRequest(
          "events?select=id,slug,name,description,prominence_score,status,created_at,image_asset:assets!events_image_fk(id,asset_variants(variant,format,storage_path))&status=eq.published&order=prominence_score.desc,name.asc&limit=500",
        ),
        serviceRequest(
          "ingestion_candidates?select=id,title,source_url,status,blocker_code,blocker_reason,requested_action,resulting_appearance_id,updated_at&status=eq.archived&order=updated_at.desc&limit=100",
        ),
        serviceRequest(
          "appearances?select=id,slug,canonical_media:media_sources!appearances_canonical_source_fk(source_url,thumbnail_url,channel_name)&public_ready_at=is.null&limit=200",
        ),
        serviceRequest(
          "backfill_campaigns?select=*&id=eq.entity-backfill-v1&limit=1",
        ),
        serviceRequest(
          "backfill_daily_usage?select=*&campaign_id=eq.entity-backfill-v1&order=usage_date.desc&limit=14",
        ),
        serviceRequest(
          "youtube_search_daily_usage?select=*&order=quota_date.desc&limit=14",
        ),
        serviceRequest(
          "companies?select=id,slug,name,status,created_at&status=eq.archived&order=created_at.desc&limit=500",
        ),
        serviceRequest(
          "speakers?select=id,slug,name,status,created_at&status=eq.archived&order=created_at.desc&limit=500",
        ),
        serviceRequest(
          "events?select=id,slug,name,status,created_at&status=eq.archived&order=created_at.desc&limit=500",
        ),
      ]);
      const values = await Promise.all(
        responses.map((response) => response.json()),
      );
      const verifiedEntities = {
        company: await signEntityImages(values[10]),
        speaker: await signEntityImages(values[11]),
        event: await signEntityImages(values[12]),
      };
      const hiddenById = new Map(
        (values[14] as Array<Record<string, unknown>>).map((row) => [
          row.id,
          row,
        ]),
      );
      const blockersWithMedia = (
        values[5] as Array<Record<string, unknown>>
      ).map((row) => ({
        ...row,
        appearance: hiddenById.get(row.resulting_appearance_id) ?? null,
      }));
      const truthfulUsage = normalizeRuntimeUsage(values[3], values[1]);
      return json(
        {
          dryRun: runtime.dryRun,
          runs: values[0],
          jobs: values[1],
          budgets: values[2],
          usage: truthfulUsage.rows,
          costDays: truthfulUsage.costDays,
          sources: values[4],
          blockers: blockersWithMedia,
          entityCandidates: values[6],
          discoveryTargets: values[7],
          pendingAssets: values[8],
          publishedAppearances: values[9],
          verifiedEntities,
          archivedItems: [
            ...values[13],
            ...values[6].filter(
              (row: Record<string, unknown>) => row.status === "archived",
            ),
            ...(values[18] as Array<Record<string, unknown>>).map((row) => ({
              ...row,
              archived_entity_type: "company",
            })),
            ...(values[19] as Array<Record<string, unknown>>).map((row) => ({
              ...row,
              archived_entity_type: "speaker",
            })),
            ...(values[20] as Array<Record<string, unknown>>).map((row) => ({
              ...row,
              archived_entity_type: "event",
            })),
          ],
          backfillCampaign:
            (values[15] as Array<Record<string, unknown>>)[0] ?? null,
          backfillDailyUsage: values[16],
          youtubeSearchUsage: values[17],
        },
        200,
        cors,
      );
    }
    const body = (await request.json()) as {
      action?: string;
      entityId?: string;
      detail?: string;
      candidates?: Array<Record<string, unknown>>;
      spec?: Record<string, unknown>;
    };
    const allowed = new Set([
      "refresh",
      "approve-rights",
      "approve-analysis",
      "retry-job",
      "archive-candidate",
      "restore-candidate",
      "archive-active-entity",
      "restore-active-entity",
      "schedule-entity-image-revision",
      "cancel-entity-image-revision",
      "publish",
      "submit-candidates",
      "estimate-backfill",
      "submit-replacement-url",
      "approve-activate-entity",
      "reject-entity-candidate",
    ]);
    if (!body.action || !allowed.has(body.action))
      return json({ error: "invalid_action" }, 400, cors);
    if (body.action === "estimate-backfill") {
      const spec = body.spec ?? {};
      return json(
        {
          dryRun: true,
          candidates: Number(spec.maximumCandidates ?? 0),
          quotaUnits: 0,
          maximumUsd: Number(spec.maximumUsd ?? 0),
          message:
            "Estimate endpoint is wired; use the local estimator until the source registry is populated.",
        },
        200,
        cors,
      );
    }
    if (body.action === "submit-candidates") {
      const candidates = Array.isArray(body.candidates)
        ? body.candidates.slice(0, 100)
        : [];
      if (!candidates.length)
        return json({ error: "missing_candidates" }, 400, cors);
      const records = candidates
        .map((candidate) => ({
          source_url: String(candidate.sourceUrl ?? ""),
          source_provider: String(candidate.sourceLabel ?? "manual"),
          source_fingerprint: String(candidate.canonicalFingerprint ?? ""),
          title: String(candidate.title ?? "").slice(0, 500),
          context_summary: String(candidate.context ?? "").slice(0, 2_000),
          current_stage: "discover-source",
          status: "discovered",
          submitted_by: admin.id,
        }))
        .filter((record) => {
          try {
            return (
              new URL(record.source_url).protocol === "https:" &&
              Boolean(record.source_fingerprint && record.title)
            );
          } catch {
            return false;
          }
        });
      if (!records.length)
        return json({ error: "invalid_candidates" }, 400, cors);
      const response = await serviceRequest(
        "ingestion_candidates?on_conflict=source_fingerprint",
        {
          method: "POST",
          headers: {
            prefer: "resolution=ignore-duplicates,return=representation",
          },
          body: JSON.stringify(records),
        },
      );
      if (!response.ok)
        throw new Error(`Candidate intake failed: ${response.status}`);
      const inserted = await response.json();
      await insertAudit(
        admin.id,
        "admin.submit-candidates",
        "ingestion-candidate",
        null,
        `${Array.isArray(inserted) ? inserted.length : 0} structured candidates accepted.`,
      );
      return json(
        { accepted: Array.isArray(inserted) ? inserted.length : 0 },
        202,
        cors,
      );
    }
    if (body.action === "submit-replacement-url") {
      if (!body.entityId || !body.detail)
        return json({ error: "missing_replacement" }, 400, cors);
      let supplied: {
        url?: string;
        title?: string;
        speakers?: string[];
        transcriptUrl?: string;
      } = { url: body.detail };
      try {
        supplied = JSON.parse(body.detail) as typeof supplied;
      } catch {
        /* legacy URL-only request */
      }
      const url = new URL(String(supplied.url ?? body.detail));
      if (
        url.protocol !== "https:" ||
        !/(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(url.hostname)
      )
        return json({ error: "official_youtube_url_required" }, 400, cors);
      const update = await serviceRequest(
        `ingestion_candidates?id=eq.${body.entityId}&status=eq.needs-review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            canonical_media_url: url.toString(),
            canonical_provider: "youtube",
            title: supplied.title?.slice(0, 500) || undefined,
            context_summary: supplied.speakers?.length
              ? `Relevant speakers: ${supplied.speakers.join(", ")}`.slice(
                  0,
                  2000,
                )
              : undefined,
            status: "queued",
            current_stage: "resolve-canonical-media",
            blocker_code: null,
            blocker_reason: null,
            requested_action: null,
            next_eligible_attempt_at: new Date().toISOString(),
            retry_count: 0,
          }),
        },
      );
      if (!update.ok) throw new Error("Unable to queue the replacement URL");
      await insertAudit(
        admin.id,
        "admin.submit-replacement-url",
        "ingestion-candidate",
        body.entityId,
        "Official YouTube replacement URL queued for verification.",
      );
      return json({ accepted: true, dryRun: false }, 202, cors);
    }
    if (
      body.action === "archive-candidate" ||
      body.action === "restore-candidate"
    ) {
      if (!body.entityId)
        return json({ error: "missing_candidate" }, 400, cors);
      const status =
        body.action === "archive-candidate" ? "archived" : "needs-review";
      const response = await serviceRequest(
        `ingestion_candidates?id=eq.${body.entityId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!response.ok) {
        const entityResponse = await serviceRequest(
          `entity_candidates?id=eq.${body.entityId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status,
              updated_at: new Date().toISOString(),
            }),
          },
        );
        if (!entityResponse.ok) throw new Error("Unable to update the archive");
      }
      await insertAudit(
        admin.id,
        `admin.${body.action}`,
        "candidate",
        body.entityId,
        status === "archived"
          ? "Moved to archive."
          : "Restored to review queue.",
      );
      return json({ accepted: true, status }, 202, cors);
    }
    if (
      body.action === "archive-active-entity" ||
      body.action === "restore-active-entity"
    ) {
      if (
        !body.entityId ||
        !["company", "speaker", "event"].includes(String(body.detail))
      )
        return json({ error: "missing_active_entity" }, 400, cors);
      const type = String(body.detail);
      const table =
        type === "company"
          ? "companies"
          : type === "speaker"
            ? "speakers"
            : "events";
      const status =
        body.action === "archive-active-entity" ? "archived" : "published";
      const updated = await serviceRequest(`${table}?id=eq.${body.entityId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!updated.ok) throw new Error("Unable to update the entity archive");
      if (status === "archived")
        await serviceRequest(
          `discovery_targets?entity_id=eq.${body.entityId}`,
          { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
        );
      else
        await serviceRequest(
          `discovery_targets?entity_id=eq.${body.entityId}&status=eq.archived`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: "queued",
              next_attempt_at: new Date().toISOString(),
            }),
          },
        );
      await insertAudit(
        admin.id,
        `admin.${body.action}`,
        type,
        body.entityId,
        status === "archived"
          ? "Published entity archived; discovery paused."
          : "Published entity restored; discovery resumed.",
      );
      return json({ accepted: true, status }, 202, cors);
    }
    if (
      body.action === "schedule-entity-image-revision" ||
      body.action === "cancel-entity-image-revision"
    ) {
      if (!body.entityId) return json({ error: "missing_revision" }, 400, cors);
      if (body.action === "cancel-entity-image-revision") {
        await serviceRequest(
          `entity_image_revisions?id=eq.${body.entityId}&status=in.(uploaded,ready,scheduled)`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return json({ accepted: true, status: "cancelled" }, 202, cors);
      }
      const tomorrowChicago = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const update = await serviceRequest(
        `entity_image_revisions?id=eq.${body.entityId}&status=eq.ready`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "scheduled",
            scheduled_for: tomorrowChicago.toISOString(),
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!update.ok) throw new Error("Image revision is not ready");
      return json({ accepted: true, status: "scheduled" }, 202, cors);
    }
    if (body.action === "approve-activate-entity") {
      if (!body.entityId)
        return json({ error: "missing_entity_candidate" }, 400, cors);
      const candidateResponse = await serviceRequest(
        `entity_candidates?select=*&id=eq.${body.entityId}&limit=1`,
      );
      const [candidate] = (await candidateResponse.json()) as Array<
        Record<string, unknown>
      >;
      if (!candidate || candidate.image_status !== "verified")
        return json({ error: "verified_image_required" }, 409, cors);
      const type = String(candidate.entity_type);
      const factualDescription = await resolveCandidateDescription(candidate, type);
      if (factualDescription.length < 20)
        return json({ error: "verified_profile_evidence_required" }, 409, cors);
      const table =
        type === "company"
          ? "companies"
          : type === "speaker"
            ? "speakers"
            : "events";
      const imageColumn =
        type === "company"
          ? "logo_asset_id"
          : type === "speaker"
            ? "headshot_asset_id"
            : "image_asset_id";
      const entity =
        type === "speaker"
          ? {
              slug: candidate.stable_slug,
              name: candidate.name,
              biography: factualDescription,
              headline: factualDescription.slice(0, 140),
              prominence_score: Number(candidate.prominence_score ?? 0),
              status: "published",
              [imageColumn]: candidate.image_asset_id,
            }
          : {
              slug: candidate.stable_slug,
              name: candidate.name,
              description: factualDescription,
              prominence_score: Number(candidate.prominence_score ?? 0),
              status: "published",
              [imageColumn]: candidate.image_asset_id,
            };
      const upsert = await serviceRequest(`${table}?on_conflict=slug`, {
        method: "POST",
        headers: {
          prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(entity),
      });
      if (!upsert.ok) throw new Error("Entity activation failed");
      const [activated] = (await upsert.json()) as Array<{ id: string }>;
      await serviceRequest(`entity_candidates?id=eq.${body.entityId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "activated",
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
          discovery_target_status: "queued",
        }),
      });
      const targetResponse = await serviceRequest(
        "discovery_targets?on_conflict=entity_type,stable_slug,target_kind",
        {
          method: "POST",
          headers: {
            prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify({
            entity_candidate_id: body.entityId,
            entity_type: type,
            entity_id: activated?.id ?? null,
            stable_slug: candidate.stable_slug,
            target_kind:
              type === "speaker" ? "speaker-match" : "youtube-channel",
            status: "queued",
            next_attempt_at: new Date().toISOString(),
            last_error: null,
          }),
        },
      );
      if (!targetResponse.ok)
        throw new Error("Discovery target activation failed");
      const [target] = (await targetResponse.json()) as Array<{ id: string }>;
      if (!target?.id)
        throw new Error("Discovery target activation returned no target");
      const discoveryJobIdempotency = `entity-target:${target.id}:activation`;
      const jobResponse = await serviceRequest(
        "jobs?on_conflict=idempotency_key",
        {
          method: "POST",
          headers: {
            prefer: "resolution=ignore-duplicates,return=representation",
          },
          body: JSON.stringify({
            kind: "entity-target-discovery",
            stage: "entity-target-discovery",
            status: "queued",
            payload: {
              targetId: target.id,
              variantIndex: 0,
              pageToken: null,
              foundAny: false,
            },
            idempotency_key: discoveryJobIdempotency,
            max_attempts: 10,
          }),
        },
      );
      const jobs = jobResponse.ok
        ? ((await jobResponse.json()) as Array<{ id: string }>)
        : [];
      await serviceRequest("rpc/invoke_job_runner", {
        method: "POST",
        body: "{}",
      });
      await insertAudit(
        admin.id,
        "admin.approve-activate-entity",
        type,
        activated?.id ?? null,
        "Entity activated with verified image and discovery target queued.",
      );
      return json(
        {
          accepted: true,
          dryRun: false,
          entityId: activated?.id ?? null,
          targetId: target.id,
          jobId: jobs[0]?.id ?? null,
          discoveryStatus: "queued",
        },
        202,
        cors,
      );
    }
    if (body.action === "reject-entity-candidate") {
      if (!body.entityId)
        return json({ error: "missing_entity_candidate" }, 400, cors);
      await serviceRequest(`entity_candidates?id=eq.${body.entityId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        }),
      });
      await insertAudit(
        admin.id,
        "admin.reject-entity-candidate",
        "entity-candidate",
        body.entityId,
        "Candidate rejected by Admin.",
      );
      return json({ accepted: true, dryRun: false }, 202, cors);
    }
    await insertAudit(
      admin.id,
      `admin.${body.action}`,
      "admin-action",
      body.entityId ?? null,
      (body.detail ?? "Admin action accepted.").slice(0, 500),
    );
    return json({ accepted: true, dryRun: runtime.dryRun }, 202, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...cors },
    });
  }
});

async function resolveCandidateDescription(
  candidate: Record<string, unknown>,
  type: string,
): Promise<string> {
  const existing = String(candidate.factual_description ?? "").trim();
  if (existing.length >= 20) return existing.slice(0, 1000);
  const appearanceId = String(candidate.source_hint ?? "").match(
    /^appearance:([a-f0-9-]{36})$/i,
  )?.[1];
  if (!appearanceId) return "";
  const response = await serviceRequest(
    `appearances?select=title&id=eq.${appearanceId}&limit=1`,
  );
  if (!response.ok) return "";
  const [appearance] = (await response.json()) as Array<{ title?: string }>;
  if (!appearance?.title) return "";
  const name = String(candidate.name ?? "This entity");
  const role =
    type === "speaker"
      ? "a verified speaker featured"
      : type === "company"
        ? "a verified organization discussed"
        : "a verified event referenced";
  return `${name} is ${role} in TechStage's source-backed coverage of “${appearance.title}”.`;
}

async function signEntityImages(rows: unknown): Promise<unknown[]> {
  if (!Array.isArray(rows)) return [];
  return Promise.all(
    rows.map(async (row) => {
      if (!row || typeof row !== "object") return row;
      const record = row as Record<string, unknown>;
      const asset =
        record.image_asset && typeof record.image_asset === "object"
          ? (record.image_asset as Record<string, unknown>)
          : null;
      const variants =
        asset && Array.isArray(asset.asset_variants)
          ? (asset.asset_variants as Array<Record<string, unknown>>)
          : [];
      const variant =
        variants.find((item) => item.format === "webp") ?? variants[0];
      const path =
        typeof variant?.storage_path === "string" ? variant.storage_path : "";
      return {
        ...record,
        image_url: path
          ? await createSignedStorageUrl("entity-assets", path)
          : null,
      };
    }),
  );
}

function chicagoDay(value: unknown): string | null {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeRuntimeUsage(raw: unknown, jobs: unknown) {
  const jobNames = new Map(
    (Array.isArray(jobs) ? jobs : []).map((job: Record<string, unknown>) => [
      String(job.id),
      String(job.kind ?? "runtime job").replaceAll("-", " "),
    ]),
  );
  const rows = (Array.isArray(raw) ? raw : [])
    .filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
    )
    .filter(
      (row) => row.provenance === "runtime" && Number(row.actual_usd ?? 0) > 0,
    )
    .map((row) => ({
      ...row,
      chicago_day: chicagoDay(row.created_at),
      job_name: row.job_id ? (jobNames.get(String(row.job_id)) ?? null) : null,
    }));
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const day = String(row.chicago_day);
    grouped.set(day, [...(grouped.get(day) ?? []), row]);
  }
  const costDays = [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      date,
      total_usd: entries.reduce(
        (sum, row) => sum + Number(row.actual_usd ?? 0),
        0,
      ),
      entries,
    }));
  return { rows, costDays };
}
