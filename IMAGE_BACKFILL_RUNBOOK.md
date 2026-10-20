# TechStage image backfill runbook

The image system uses the canonical `techstage-dev` Supabase project for the normal database, Auth, Storage, and Edge Functions. The public frontend remains in local mode during review.

Deployment status (2026-07-14): project `zckeerbajtwpqcvqpwru` is active on the Free plan; 75 approved assets, 122 delivery variants, and 75 private source masters are present and linked. The completed bootstrap used only official pages and Wikimedia Commons, so no Pexels/Pixabay key or bootstrap secret was required and the recorded cost is `$0`.

## One-time Supabase setup

1. In a new Codex task with the Supabase plugin loaded, select `Malenicola05-4721`.
2. Confirm project creation reports `$0`, then create `techstage-dev`. Stop if it reports any charge.
3. Apply the migrations in timestamp order and deploy `catalog-api` plus `asset-workflow`.
4. Only when future editors explicitly enable Pexels/Pixabay discovery, add through **Supabase Dashboard → Edge Functions → Secrets**:
   - `PEXELS_API_KEY`
   - `PIXABAY_API_KEY`
   - `ASSET_IMPORT_TOKEN` — a random one-time value; do not use a service-role key.
5. Keep `VITE_DATA_MODE=local` throughout image review.

## Import

All commands enforce a `$0` budget.

```bash
npm run assets:seed
npm run assets:dry-run
```

The deployed credential-free path is reproducible with a publishable project key and uses official/Wikimedia assets only:

```bash
SUPABASE_URL="https://PROJECT_REF.supabase.co" SUPABASE_ANON_KEY="PROJECT_PUBLISHABLE_KEY" npm run assets:import:free
```

It writes the resolved provenance manifest, import receipt, and visual contact sheets under `assets/`. Temporary Storage upload policies must be created only for the import window and removed immediately afterward. The deployed project has no temporary bootstrap policies remaining.

After reviewing both dry runs:

```bash
SUPABASE_URL="https://PROJECT_REF.supabase.co" ASSET_IMPORT_TOKEN="..." npm run assets:seed:execute
SUPABASE_URL="https://PROJECT_REF.supabase.co" ASSET_IMPORT_TOKEN="..." npm run assets:stage -- --max-items 3
```

Review the 75-item manifest in the operations desk, then list the real staged candidates:

```bash
SUPABASE_URL="https://PROJECT_REF.supabase.co" ASSET_IMPORT_TOKEN="..." \
node scripts/assets/backfill.mjs --list --execute --budget-usd 0
```

Reject unsuitable candidates before using a fallback:

```bash
SUPABASE_URL="https://PROJECT_REF.supabase.co" ASSET_IMPORT_TOKEN="..." \
node scripts/assets/backfill.mjs --reject "ASSET_UUID" --execute --budget-usd 0
```

After all Pexels candidates for a topic are rejected, request Pixabay:

```bash
SUPABASE_URL="https://PROJECT_REF.supabase.co" ASSET_IMPORT_TOKEN="..." \
node scripts/assets/backfill.mjs --fallback "TOPIC_SLUG" --execute --budget-usd 0
```

Process an approved candidate in a three-item pilot:

```bash
SUPABASE_URL="https://PROJECT_REF.supabase.co" ASSET_IMPORT_TOKEN="..." \
node scripts/assets/backfill.mjs --asset-id "ASSET_UUID" --execute --budget-usd 0
```

The processor verifies the approved source checksum, generates the required variants, uploads them to private Storage, and finalizes the entity link. Company logos produce 512px WebP and PNG; speakers produce 256/512 WebP; events and topics produce 1600×900 WebP. The catalog issues short-lived URLs only after approval.

## Close bootstrap access

After the 75 assets are approved, delete `ASSET_IMPORT_TOKEN` from Edge Function secrets if one was used. Ongoing changes then require an authenticated TechStage admin. Never place provider keys or the token in Git, chat, or a `VITE_*` variable.
