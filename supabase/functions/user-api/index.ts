import { corsHeaders, errorResponse, json } from "../_shared/runtime.ts";
import { enforceRateLimit, requireUser, userRequest } from "../_shared/supabase.ts";

const resources = new Set(["profiles", "notifications", "viewing_progress"]);

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const user = await requireUser(request);
    await enforceRateLimit(`user:${user.id}`, 180, 60);
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "profiles";
    if (!resources.has(resource)) return json({ error: "invalid_resource" }, 400, cors);
    const authorization = request.headers.get("authorization") ?? "";
    const filter = resource === "profiles" ? `id=eq.${user.id}` : `user_id=eq.${user.id}`;
    const response = await userRequest(`${resource}?select=*&${filter}&limit=100`, authorization);
    return json(await response.json(), response.status, cors);
  } catch (error) {
    const response = errorResponse(error);
    return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
  }
});
