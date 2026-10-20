import { useEffect, useState } from "react";

export type RemoteEntityType = "company" | "speaker" | "event" | "topic";

interface AssetVariant {
  width: number;
  height: number;
  format: string;
  variant: string;
  public_url: string;
}

interface CatalogAsset {
  focal_x: number | null;
  focal_y: number | null;
  attribution_text: string | null;
  license_label: string | null;
  license_url: string | null;
  asset_variants: AssetVariant[];
}

interface CatalogRow {
  slug: string;
  image_asset: CatalogAsset | null;
}

export interface ResolvedEntityAsset {
  src: string;
  focalX: number;
  focalY: number;
  attribution: string | null;
  license: string | null;
  licenseUrl: string | null;
}

const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || "https://zckeerbajtwpqcvqpwru.supabase.co";
const resourceByType: Record<RemoteEntityType, string> = {
  company: "companies",
  speaker: "speakers",
  event: "events",
  topic: "topics",
};

const catalogs = new Map<RemoteEntityType, Promise<Map<string, ResolvedEntityAsset>>>();

/** Page through the catalog until a short page signals the end. The server
 *  caps each page at 100 rows, so we request in 100-row windows via offset. */
async function fetchAllCatalogRows(resource: string): Promise<CatalogRow[]> {
  const pageSize = 100;
  const all: CatalogRow[] = [];
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const response = await fetch(`${PROJECT_URL}/functions/v1/catalog-api?resource=${resource}&limit=${pageSize}&offset=${offset}`);
    if (!response.ok) throw new Error(`Image catalog returned ${response.status}`);
    const rows = await response.json() as CatalogRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

function loadCatalog(entityType: RemoteEntityType) {
  const cached = catalogs.get(entityType);
  if (cached) return cached;

  // The catalog is paginated: the entity count per type grows with the
  // expansion campaign (well past 100 and toward 500/type), so a single
  // capped request would silently drop images for later entities.
  const request = fetchAllCatalogRows(resourceByType[entityType])
    .then((rows) => {
      const bySlug = new Map<string, ResolvedEntityAsset>();
      for (const row of rows) {
        const asset = row.image_asset;
        const variant = asset?.asset_variants
          ?.filter((item) => ["webp", "png", "jpg", "jpeg"].includes(item.format) && Boolean(item.public_url))
          .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
        if (!asset || !variant) continue;
        bySlug.set(row.slug, {
          src: variant.public_url,
          focalX: asset.focal_x ?? 0.5,
          focalY: asset.focal_y ?? (entityType === "speaker" ? 0.38 : 0.5),
          attribution: asset.attribution_text,
          license: asset.license_label,
          licenseUrl: asset.license_url,
        });
      }
      return bySlug;
    })
    .catch((error) => {
      catalogs.delete(entityType);
      throw error;
    });

  catalogs.set(entityType, request);
  return request;
}

/** Resolve approved private Storage assets through the public catalog function. */
export function useEntityAsset(entityType: RemoteEntityType, entitySlug: string, enabled: boolean) {
  const [asset, setAsset] = useState<ResolvedEntityAsset | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadCatalog(entityType)
      .then((catalog) => {
        if (live) setAsset(catalog.get(entitySlug) ?? null);
      })
      .catch(() => {
        if (live) setAsset(null);
      });
    return () => { live = false; };
  }, [enabled, entitySlug, entityType]);

  return asset;
}
