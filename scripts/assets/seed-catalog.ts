import process from "node:process";
import { seedCompanies, seedEvents, seedSpeakers } from "@/data/seed/realCatalog";
import { seedTopics } from "@/data/seed/topics";

const dryRun = !process.argv.includes("--execute");
const budgetUsd = Number(process.argv[process.argv.indexOf("--budget-usd") + 1] ?? 0);
if (budgetUsd !== 0) throw new Error("Paid catalog operations are disabled.");

const catalog = {
  companies: seedCompanies.map((row) => ({ slug: row.slug, name: row.name, description: row.description, website_url: row.websiteUrl, status: "published" })),
  speakers: seedSpeakers.map((row) => ({ slug: row.slug, name: row.name, headline: row.headline, biography: row.biography, status: "published" })),
  events: seedEvents.map((row) => ({ slug: row.slug, name: row.title, description: row.description, official_url: row.eventUrl, starts_at: row.startDate, ends_at: row.endDate, timezone: row.timezone, status: "published" })),
  topics: seedTopics.map((row) => ({ slug: row.slug, name: row.name, description: row.description, status: "published" })),
};

if (process.argv.includes("--dump-catalog")) {
  console.log(JSON.stringify(catalog));
  process.exit(0);
}

if (dryRun) {
  console.log(JSON.stringify({ dryRun, budgetUsd, counts: Object.fromEntries(Object.entries(catalog).map(([key, rows]) => [key, rows.length])) }, null, 2));
  process.exit(0);
}

const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const token = process.env.ASSET_IMPORT_TOKEN?.trim();
if (!url || !token) throw new Error("SUPABASE_URL and ASSET_IMPORT_TOKEN are required for execution.");
const response = await fetch(`${url}/functions/v1/asset-workflow`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-asset-import-token": token },
  body: JSON.stringify({ action: "seed-catalog", catalog, dryRun: false, budgetUsd: 0 }),
  signal: AbortSignal.timeout(60_000),
});
const payload = await response.json();
if (!response.ok) throw new Error(`Catalog seed failed (${response.status}): ${JSON.stringify(payload)}`);
console.log(JSON.stringify(payload, null, 2));
