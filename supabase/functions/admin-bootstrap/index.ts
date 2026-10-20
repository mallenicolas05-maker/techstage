import { corsHeaders, env, errorResponse, json } from "../_shared/runtime.ts";
import { insertAudit, serviceRequest } from "../_shared/supabase.ts";

/** Promotes only an allowlisted magic-link user.  The browser never receives the
 * allowlist, service key, or a privileged role-writing capability. */
Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) throw new Error("Authentication required");
    const url = env("SUPABASE_URL");
    const key = env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
    if (!url || !key) throw new Error("Supabase client configuration is missing");
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok) throw new Error("Authentication required");
    const user = await userResponse.json() as { id?: string; email?: string; user_metadata?: Record<string, unknown> };
    const email = String(user.email ?? "").trim().toLowerCase();
    const allowed = new Set((env("ADMIN_EMAILS") ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
    if (!user.id || !email || !allowed.has(email)) throw new Error("Admin access denied");
    const response = await serviceRequest("profiles?on_conflict=id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: user.id, email, display_name: String(user.user_metadata?.full_name ?? "TechStage Admin").slice(0, 160), role: "admin" }),
    });
    if (!response.ok) throw new Error("Unable to create the Admin profile");
    await insertAudit(user.id, "admin.bootstrap", "profile", user.id, "Allowlisted magic-link session verified.");
    return json({ email, role: "admin" }, 200, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});
