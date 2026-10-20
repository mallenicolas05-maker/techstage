import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const projectUrl = (process.env.SUPABASE_URL ?? "https://zckeerbajtwpqcvqpwru.supabase.co").replace(/\/$/, "");
const catalogUrl = `${projectUrl}/functions/v1/catalog-api`;
await mkdir("assets/qa", { recursive: true });

for (const [resource, type] of [["companies", "company"], ["speakers", "speaker"], ["events", "event"], ["topics", "topic"]]) {
  const response = await fetch(`${catalogUrl}?resource=${resource}&limit=100`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${resource} catalog request failed: ${response.status}`);
  const rows = await response.json();
  const items = [];
  for (const row of rows) {
    const variants = row.image_asset?.asset_variants ?? [];
    const preferred = variants.find((variant) => variant.variant === "speaker-512" || (variant.variant === "logo-512" && variant.format === "webp") || variant.variant === "landscape-1600") ?? variants[0];
    if (!preferred?.public_url) throw new Error(`Missing signed variant for ${resource}:${row.slug}`);
    const image = await fetch(preferred.public_url, { signal: AbortSignal.timeout(30_000) });
    if (!image.ok) throw new Error(`Image fetch failed for ${resource}:${row.slug}`);
    items.push({ label: row.name, buffer: Buffer.from(await image.arrayBuffer()) });
  }
  await contactSheet(type, items);
}

async function contactSheet(type, items) {
  const width = 1000; const cellWidth = 200; const cellHeight = 245; const rows = Math.ceil(items.length / 5);
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const image = await sharp(items[index].buffer).resize(176, 176, { fit: "contain", background: "#ffffff" }).webp().toBuffer();
    const label = Buffer.from(`<svg width="184" height="232" xmlns="http://www.w3.org/2000/svg"><rect width="184" height="232" fill="#fff"/><text x="92" y="214" text-anchor="middle" font-size="13" font-family="Arial" fill="#17181c">${escapeXml(items[index].label.slice(0, 25))}</text></svg>`);
    const card = await sharp(label).composite([{ input: image, top: 4, left: 4 }]).webp().toBuffer();
    composites.push({ input: card, left: (index % 5) * cellWidth + 8, top: Math.floor(index / 5) * cellHeight + 8 });
  }
  await sharp({ create: { width, height: rows * cellHeight + 16, channels: 3, background: "#f1f1f2" } }).composite(composites).webp({ quality: 86 }).toFile(`assets/qa/${type}-contact-sheet.webp`);
}

function escapeXml(value) { return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[character])); }
