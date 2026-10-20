# TechStage images and UI pass — Fable summary for Codex

Date: 2026-07-17 (evening, Chicago). Work done by Fable at the owner's request. The owner asked for: bulk image loading for every entity awaiting an image, replacement of off-style published images, a set of small UI changes, and this handoff so Codex has full context.

## 1. Frontend changes (deployed to Cloudflare Pages production)

All changes are in the working tree on branch `codex/fable-codex-merge` (not committed). Built with `npm run build` and deployed with `wrangler pages deploy dist --project-name techstage --branch main`. Typecheck and all offline tests pass (45/45 at the time of deploy).

### Navigation — [src/components/shell/AppShell.tsx](src/components/shell/AppShell.tsx)
- Added **Companies** (`/companies`) and **Events** (`/events`) to the primary nav and the mobile menu, in the same style as the Speakers directory.
- Renamed the nav label **"Stage Notes" → "Stagenotes"** (one word, owner request). Routes are unchanged (`/stage-notes`).
- Nav gap tightened slightly (`gap-3.5 md:flex lg:gap-5`) so nine items fit on one line at `md`.

### New directory pages
- [src/pages/Companies.tsx](src/pages/Companies.tsx) — company directory: sort tabs (Most active / A–Z / Following), topic filter pills, dot-grid cards with circular logo, follow button. Modeled 1:1 on the Speakers page.
- [src/pages/Events.tsx](src/pages/Events.tsx) — event directory: sort tabs (Upcoming first / Most recent / A–Z), landscape EntityImage cards with organizer, date, and location.
- Routes registered in [src/App.tsx](src/App.tsx) (`/companies`, `/events`).

### Discover — [src/pages/Discover.tsx](src/pages/Discover.tsx)
- **New entity-type toggle** between the results count and the Sort control: Speakers / Companies / Events / Topics. Default (nothing selected) keeps the existing full sequence; selecting one shows only that entity section; clicking it again returns to the default. Styled as the existing segmented mono/uppercase control (`bg-ink text-paper` when active).
- **Filter bug fix** in [src/data/adapters/search.ts](src/data/adapters/search.ts): previously, any active filter dropped every non-appearance result, so filtering by a speaker with no seed appearance (e.g. Mira Murati) returned "Nothing matches yet". Entity results now pass when they are what the filter asks for (speaker doc matches `speakerIds`, company doc matches `companyIds`, etc.). Verified: Mira Murati filter now returns her speaker card.

### Remote asset loading — [src/hooks/useEntityAsset.ts](src/hooks/useEntityAsset.ts)
- The catalog variant picker accepted only `webp` variants; admin uploads are png/jpg (`admin-original`), so they could never display. Now accepts webp/png/jpg/jpeg, sorted by width (null-safe).

### Entity image treatment — [src/components/ui/EntityImage.tsx](src/components/ui/EntityImage.tsx)
- **Company circles**: removed the faint gray ring look; company logos now get a single defined dark ring (`border-ink/60`). Speaker circles keep the light `border-ink/15`.
- **Topics are greyed out**: `monochrome` now defaults to true for topics as well as speakers (CSS `grayscale` on the image; source masters untouched).
- The old bootstrap company assets have a thin gray medallion ring **baked into the file**; those were replaced with fresh logo uploads (section 3) so only the single dark CSS ring shows anywhere.

## 2. Bulk image load for awaiting-image candidates

The owner's manual flow (drag-and-drop at `/admin` → `admin-asset-upload` → next-day intake) was executed programmatically at scale with the same endpoint and the same activation action the Admin UI uses (`approve-activate-entity`). Nothing new was added to the backend; this is the existing flow, just batched.

- Source: English Wikipedia / Wikimedia Commons only (same provenance as the original 75-asset bootstrap; $0 spend).
  - **Speakers** → article lead portrait (usually a Commons conference/panel photo), professional, ≥240px.
  - **Companies / events** → the article's **infobox logo file** rasterized to PNG (≤1024px), never a building or crowd photo. Candidates whose article has no logo file were deliberately left unsourced rather than uploading an off-style photo.
- Wrong-namesake protection: article title match + tech-context check on the summary; ambiguous or mismatched people were skipped and are listed at the end of this file.
- Every upload went through `admin-asset-upload` (`candidateId` + file), which stores the pending upload, queues `entity-image-prepare`, and versions the asset. Verified candidates were then activated with the `approve-activate-entity` admin action so discovery/publishing proceeds automatically.

**Results are summarized in section 5.**

## 3. Replacements for published entities

Off-style published images were staged as image revisions (`admin-asset-upload` with `entityId`/`entityType` → `schedule-entity-image-revision`), which the daily intake applies automatically. Scope:

- **18 of 19 published company logos** re-uploaded with current official marks (kills the baked-in gray medallion ring and fixes outdated logos — OpenAI especially; xAI deliberately kept, see section 5).
- **12 speaker portraits** replaced for being out of frame, outdated, or unprofessional: elon-musk, sam-altman, fei-fei-li, mira-murati, mark-zuckerberg, ilya-sutskever, jack-dorsey, patrick-collison, marc-benioff, arvind-krishna, vinod-khosla, jensen-huang.
- **3 events** moved to minimal name/logo style (like the liked Microsoft Build and Acquired cards): y-combinator-events-2026, web-summit-2026, wef-davos-2026. The two All-In events and Lex Fridman Podcast had no freely available logo (see section 5).

## 4. Topics — action needed from Codex

Topic images could not be replaced from here: `admin-asset-upload` only accepts company/speaker/event, `applyScheduledEntityImageRevisions` in the job-runner skips topics, and `asset-workflow` requires `ASSET_IMPORT_TOKEN` (deleted after bootstrap) or an admin JWT (sign-in disabled). The UI now renders all topic images greyscale, which fixes the "grey out the color" request.

**Codex to-dos for topics** (owner request, quoted intent: symbolic imagery "like energy", not literal room photos):
1. Replace the **open-source-models** topic image (current: random hackathon room) with a symbolic image.
2. Also worth replacing while there: **developer-tools** (old office cubicle photo), **ai-safety** (office monitors), **multimodal-ai** (camera on tripod), **venture-capital** (stage photo).
3. Cheapest path: service-role update of the topic's `image_asset_id` to a new approved Commons-sourced asset, or extend `admin-asset-upload` + `applyScheduledEntityImageRevisions` with a `topic` branch (topics table image column is `image_asset_id`).

## 5. Run results

### Candidate image load (of the 492 awaiting)
- **216 images uploaded** through `admin-asset-upload` (103 speakers + 82 companies + 30 events from the batch, plus a manual naval-ravikant), all 201-accepted, zero failures.
- **215 candidates activated** via `approve-activate-entity` (naval-ravikant activates after the next prepare run). Live catalog confirmed after activation: **100 companies, 100 speakers, 43 events** published (was 19/28/13).
- **~276 candidates intentionally left in Preparing** — no confident Wikipedia/Wikimedia match (obscure or junk expansion names like `participant-1`, `cody`, `deep`), no official logo file for the company/event, or dropped in visual QA as wrong-person/off-style (e.g. a baseball-player "Jim Fan", Disney Cruise Line for Cruise, "TRUMP MOBILE" for MWC Americas). Wrong images were never uploaded. These stay imageless for owner/Codex follow-up.
- Every sourced image + its Wikipedia article + file provenance is in the session manifest (`source-manifest.json` in the session scratchpad) if Codex wants the audit trail.

### Published-entity replacements
- **33 of 37 staged and scheduled** (`entity_image_revisions` status `scheduled`, apply at the next daily intake): 18 companies (current official logos — OpenAI's new wordmark, Microsoft 2012 logo, current Amazon/AMD, etc.), 12 speakers (recent professional portraits for Musk, Altman, Zuckerberg, Fei-Fei Li, Mira Murati, Sutskever, Dorsey, Collison, Benioff, Krishna, Khosla, Jensen Huang), 3 events (Y Combinator, Web Summit, WEF logos).
- **Skipped**: xAI (English Wikipedia now carries a merged "SpaceXAI" mark — brand-ambiguous, kept the current logo; owner to decide), All-In Podcast / All-In Summit / Lex Fridman Podcast (no freely available logo file; still on their old images — see section 4-style follow-up below).

### Bugs found and fixed in the image pipeline (all deployed)
These explain the report line "Valid imported images completed: 0" — the pipeline had never produced a displayable image from an admin upload:
1. **`admin-asset-upload` crashed on every published-entity edit**: it always looked up `entity_candidates` with an empty candidateId before branching, so the `entityId` revision path 500'd unconditionally. Fixed (lookup only in candidate mode). The owner's drag-and-drop "edit published image" flow works for the first time.
2. **`admin-asset-upload` revision path omitted `license_label`** (NOT NULL on `assets`) — inserts failed. Fixed (`"Admin supplied"`, matching the prepare job).
3. **`asset_variants` inserts omitted `width`/`height`** (NOT NULL) in both `admin-asset-upload` and job-runner `prepareVerifiedEntityImage` — the variant insert failed on first attempt, and on retry the asset-exists check skipped the variant entirely, so candidates were marked verified with **zero catalog variants** (nothing to display). Fixed: dimensions parsed from the bytes (`readUploadedImageDimensions` in job-runner), and the variant insert is idempotent (`on_conflict=storage_path`, merge-duplicates) and runs even when the asset already exists.
4. **Frontend `useEntityAsset` only accepted webp variants** — admin uploads are png/jpg. Fixed to accept webp/png/jpg/jpeg, largest width first.
5. Duplicate-checksum note: `assets.checksum_sha256` has a unique index; two replacement uploads (fei-fei-li, mira-murati) collided with existing asset bytes and were re-encoded to proceed. Codex may want the revision path to reuse the existing asset on checksum conflict instead of erroring.

### Catalog pagination fix (2026-07-18, after the weekend)
- **Regression found during verification**: the public `catalog-api` capped every response at 100 rows, and `useEntityAsset` fetched a single `limit=100` page. That was fine at the old scale (≤28 speakers) but with **132 speakers / 101 companies** now published, ~33 entities beyond the cap (Elon Musk, Sam Altman, Mira Murati among them) resolved to **placeholder avatars on the public site despite having real image assets in the DB**. It would have worsened as the expansion campaign climbs toward 500/type.
- **Fix (deployed)**: `catalog-api` now accepts `&offset=` with a stable `order=slug/id.asc`; `useEntityAsset.fetchAllCatalogRows` pages through 100-row windows until a short page ends. Verified: pagination returns all 132 speakers, and the live Speakers page shows **106/106 loaded cards with images, zero blank**, flagged replacements included (Elon Musk portrait loads at 1280×1682). Files: [supabase/functions/catalog-api/index.ts](supabase/functions/catalog-api/index.ts), [src/hooks/useEntityAsset.ts](src/hooks/useEntityAsset.ts). Typecheck + 45 tests pass.

### Backfill completed and configuration restored
- The one-off variant backfill ran to completion on 2026-07-18 (early morning Chicago): **100/100 companies, 100/100 speakers, and 43/43 events now have displayable catalog variants.** Verified end-to-end on the live site (fresh `admin-upload-*` signed URLs render on techstage.pages.dev).
- `prepareVerifiedEntityImage` was then restored to the per-candidate filter with batch limit 50 and redeployed. Kept on purpose: the widened `status in (needs-image, ready, activated)` eligibility, the guarded status PATCH, and the idempotent width/height-complete variant insert.
- Duplicate candidate slugs noticed during QA (`mistral` vs `mistral-ai` — both activated with the same logo; `tobi-lutke` uploaded, `tobias-lutke` left imageless): worth a dedupe pass in the expansion tranche filler.

## 6. Operational notes

- Uploads trigger `invoke_job_runner` per call; `entity-image-prepare` processes in batches of 50 and also applies scheduled revisions. Expect the intake/apply to complete on the next scheduled runs; nothing needs owner action.
- The frontend deploy is production on Cloudflare Pages (`techstage.pages.dev`); previous deployment remains available for instant rollback via the dashboard.
- Edge Functions `admin-asset-upload` and `job-runner` were redeployed with the section-5 bug fixes (image pipeline only — no change to discovery, analysis, publishing, schedules, caps, migrations, or newsletter). Typecheck and all 45 offline tests pass with these changes.
- `.claude/launch.json` gained a local dev-server entry only (tooling, not product).
