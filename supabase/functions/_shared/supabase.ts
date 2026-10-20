import { env } from "./runtime.ts";

const baseUrl = () => env("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
const serviceKey = () => env("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export async function serviceRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = baseUrl();
  const key = serviceKey();
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...init.headers,
    },
  });
}

export async function userRequest(
  path: string,
  authorization: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = baseUrl();
  const publishable =
    env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY") ?? "";
  if (!url || !publishable)
    throw new Error("Supabase client configuration is missing");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishable,
      authorization,
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export async function publicRequest(
  path: string,
  authorization: string | null,
  init: RequestInit = {},
): Promise<Response> {
  const url = baseUrl();
  const publishable =
    env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY") ?? "";
  if (!url || !publishable)
    throw new Error("Supabase client configuration is missing");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishable,
      authorization: authorization?.startsWith("Bearer ")
        ? authorization
        : `Bearer ${publishable}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export async function requireUser(
  request: Request,
): Promise<{ id: string; email: string; role: string }> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    throw new Error("Authentication required");
  // RLS restricts this read to auth.uid(), so no client-supplied user identifier is trusted.
  const profileResponse = await userRequest(
    "profiles?select=id,email,role&limit=1",
    authorization,
  );
  if (!profileResponse.ok) throw new Error("Unable to verify admin profile");
  const profiles = (await profileResponse.json()) as Array<{
    id: string;
    email: string;
    role: string;
  }>;
  const profile = profiles[0];
  if (!profile) throw new Error("Authenticated profile is missing");
  return profile;
}

export async function requireAdmin(
  request: Request,
): Promise<{ id: string; email: string }> {
  const profile = await requireUser(request);
  const allowlist = new Set(
    (env("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (profile.role !== "admin" || !allowlist.has(profile.email.toLowerCase()))
    throw new Error("Admin access denied");
  return { id: profile.id, email: profile.email };
}

/** Temporary setup-mode identity used while the owner has intentionally
 * disabled the Admin sign-in screen. Remove this when sign-in is restored. */
export async function setupAdmin(): Promise<{ id: string; email: string }> {
  const response = await serviceRequest(
    "profiles?select=id,email&role=eq.admin&limit=1",
  );
  if (!response.ok) throw new Error("Unable to load the setup Admin profile");
  const [profile] = (await response.json()) as Array<{
    id: string;
    email: string;
  }>;
  if (!profile) throw new Error("Setup Admin profile is missing");
  return profile;
}

export async function insertAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  detail: string,
) {
  const response = await serviceRequest("audit_log", {
    method: "POST",
    body: JSON.stringify({
      actor_id: actorId,
      actor_label: actorId ? "admin" : "system",
      action,
      entity_type: entityType,
      entity_id: entityId,
      detail,
    }),
  });
  if (!response.ok) throw new Error(`Audit insert failed: ${response.status}`);
}

export async function enforceRateLimit(
  key: string,
  maximumRequests: number,
  windowSeconds: number,
): Promise<void> {
  const response = await serviceRequest("rpc/consume_rate_limit", {
    method: "POST",
    body: JSON.stringify({
      counter_key: key.slice(0, 240),
      maximum_requests: maximumRequests,
      window_seconds: windowSeconds,
    }),
  });
  if (!response.ok || (await response.json()) !== true)
    throw new Error("Rate limit exceeded");
}

export async function uploadStorageObject(
  bucket: string,
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const url = baseUrl();
  const key = serviceKey();
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  const response = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(`Storage upload failed: ${response.status}`);
}

export async function downloadStorageObject(
  bucket: string,
  path: string,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const url = baseUrl();
  const key = serviceKey();
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  const response = await fetch(
    `${url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(`Storage download failed: ${response.status}`);
  return {
    bytes: await response.arrayBuffer(),
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export async function deleteStorageObject(
  bucket: string,
  paths: string[],
): Promise<void> {
  if (!paths.length) return;
  const url = baseUrl();
  const key = serviceKey();
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  const response = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: "DELETE",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prefixes: paths }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(`Storage deletion failed: ${response.status}`);
}

export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const url = baseUrl();
  const key = serviceKey();
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  const response = await fetch(
    `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new Error(`Storage signing failed: ${response.status}`);
  const payload = (await response.json()) as {
    signedURL?: string;
    signedUrl?: string;
  };
  const signed = payload.signedURL ?? payload.signedUrl;
  if (!signed) throw new Error("Storage signing returned no URL");
  return signed.startsWith("/object/")
    ? `${url}/storage/v1${signed}`
    : new URL(signed, url).toString();
}

export async function createSignedStorageUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return new Map();
  const url = baseUrl();
  const key = serviceKey();
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  const response = await fetch(
    `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn, paths: uniquePaths }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new Error(`Storage batch signing failed: ${response.status}`);
  const payload = (await response.json()) as Array<{
    path?: string;
    signedURL?: string;
    signedUrl?: string;
  }>;
  const signed = new Map<string, string>();
  payload.forEach((item, index) => {
    const path = item.path ?? uniquePaths[index];
    const value = item.signedURL ?? item.signedUrl;
    if (!path || !value) return;
    signed.set(
      path,
      value.startsWith("/object/")
        ? `${url}/storage/v1${value}`
        : new URL(value, url).toString(),
    );
  });
  return signed;
}
