# TechStage live catalog, recovery, and noon expansion handoff

## Completed deployment state

- Supabase project: `techstage-dev` (`zckeerbajtwpqcvqpwru`).
- Public readiness is now a database-enforced gate, not a frontend convention.
- 23 appearances are `published` and public-ready. Each has an approved privacy-enhanced YouTube embed, canonical media source, analysis artifact, chapters, highlights, and entity relationships.
- 5 link-only appearances were retained with their existing work but moved to Admin review. They are not publicly readable.
- The Admin recovery queue contains 17 records: the 5 link-only records plus 12 existing incomplete candidates.
- Existing image assets remain intact: 75 assets and 122 delivery variants.
- Newsletter delivery remains disabled. No Resend send operation was created.
- A daily noon local Codex task now runs in **dry-run-only** mode using GPT-5.6 Luna with Light reasoning. It does not stage candidates or call paid/external providers.

## Why the public player previously showed a placeholder

The browser DTO was replacing the stored `embed_url` with the source URL, and the appearance page intentionally rendered a simulated player. The corrected path maps `media_sources.embed_url` directly and renders an actual `youtube-nocookie.com` iframe for approved live records. Local mock players remain simulated.

## Public-readiness rule

An appearance can be public only when all of the following are true:

1. It is published and marked `embed-allowed`.
2. Its canonical source is a public, embeddable official YouTube source with a validated `youtube-nocookie.com/embed/...` URL.
3. It has a structured analysis artifact, at least one chapter, and at least one highlight.
4. Speaker, company, and topic relationships resolve.

Changes to source metadata, analysis, chapters, highlights, or those relationships recompute readiness automatically. This prevents incomplete panels from becoming visible through either RLS or `catalog-api`.

## Admin recovery workflow

The live Admin path uses Supabase email magic-link authentication. The signed-in address must appear in the server-only `ADMIN_EMAILS` secret. The bootstrap function then creates/promotes only that profile to `admin`.

Admin can read live blockers, costs, jobs, staged entities, discovery targets, and pending assets. A blocker may accept a verified official YouTube replacement URL; it is queued for validation rather than embedded directly.

Entity candidate uploads accept only JPEG, PNG, or WebP up to 6 MB. Originals are stored under the private `entity-candidate-uploads` bucket with a checksum. They require further asset-pipeline validation and an explicit approval before activation; no upload is public by itself.

## Noon dry-run routine

Schedule: daily at noon local Codex time. It expects the Mac to be powered on, the desktop app running, and this project available.

- Target ceiling: 400 each of companies, speakers, and event organizations.
- Per dry run: at most 50 strong unique proposals per type.
- No web research by default; at most five lightweight ambiguity checks.
- No Gemini, xAI, Parallel, Tavily, Resend, or provider API calls.
- Output: `reports/noon-expansion/latest-dry-run.json` and a short run summary.
- It must be explicitly changed from dry-run to staging only after the owner reviews a proposal.

## Validation performed

- TypeScript typecheck passed.
- Live database readback confirmed 23 public-ready appearances, 5 held for Admin, and 17 `needs-review` candidates.
- The storage inventory remained at 75 assets / 122 variants.
- Supabase security advisor caught two newly introduced trigger helpers; direct execution was revoked from anon/authenticated, with service-role-only execution retained.

## Remaining controlled activation steps

1. Put the project’s public URL and publishable key in the local frontend environment and set `VITE_DATA_MODE=supabase`; this only enables the hybrid real-first catalog locally and does not deploy the public site.
2. Sign in once at `/admin` with the allowlisted email to bootstrap Admin access.
3. Inspect the first noon dry-run report. Approve a staged-run mode only if the proposed entities are good.
4. For each blocked appearance, provide a verified official YouTube URL or leave it blocked; never use a transcript-only or non-embeddable record publicly.
5. For entity candidate imagery, complete asset-pipeline processing and explicitly approve before activation.

## Deliberately out of scope

- Public-site deployment, custom domain, newsletter sending, paid Supabase, backup/R2, and changes to unrelated public UI.
