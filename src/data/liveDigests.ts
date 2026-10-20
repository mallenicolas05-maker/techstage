import { CLIENT_RUNTIME_CONFIG } from "@/backend/config";

export type LiveDigestPanel = { id: string; position: number; title: string; source_url: string; editorial_sections: unknown; appearance?: { slug: string; title: string; occurred_at: string | null } | null };
export type LiveDigestIssue = { id: string; slug: string; issue_number: number; title: string; deck: string; big_picture: string; reading_minutes: number; sent_at: string | null; digest_panels: LiveDigestPanel[] };

async function readIssues(lookup?: string): Promise<LiveDigestIssue[]> {
  if (!CLIENT_RUNTIME_CONFIG.supabaseUrl || !CLIENT_RUNTIME_CONFIG.supabasePublishableKey) return [];
  const query = new URLSearchParams({ resource: "digest_issues", limit: lookup ? "1" : "50" });
  if (lookup) query.set("lookup", lookup);
  const response = await fetch(`${CLIENT_RUNTIME_CONFIG.supabaseUrl}/functions/v1/catalog-api?${query}`, { headers: { apikey: CLIENT_RUNTIME_CONFIG.supabasePublishableKey } });
  if (!response.ok) throw new Error("Stage Notes could not load.");
  return response.json() as Promise<LiveDigestIssue[]>;
}

export async function listLiveDigestIssues() { return readIssues(); }
export async function getLiveDigestIssue(slug: string) { return (await readIssues(slug))[0] ?? null; }
