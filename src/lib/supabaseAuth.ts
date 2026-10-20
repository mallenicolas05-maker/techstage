import { createClient, type Session } from "@supabase/supabase-js";
import { CLIENT_RUNTIME_CONFIG } from "@/backend/config";

const { supabaseUrl, supabasePublishableKey } = CLIENT_RUNTIME_CONFIG;

export const supabaseBrowser = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function requestAdminMagicLink(email: string): Promise<void> {
  if (!supabaseBrowser) throw new Error("Supabase browser configuration is missing.");
  const redirectTo = `${window.location.origin}/admin`;
  const { error } = await supabaseBrowser.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}

export async function currentSession(): Promise<Session | null> {
  if (!supabaseBrowser) return null;
  const { data, error } = await supabaseBrowser.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function bootstrapAdmin(session: Session): Promise<{ email: string; role: string }> {
  if (!supabaseBrowser || !supabaseUrl) throw new Error("Supabase browser configuration is missing.");
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-bootstrap`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey ?? "",
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error("This signed-in address is not approved for TechStage Admin.");
  return response.json() as Promise<{ email: string; role: string }>;
}

export async function signOutAdmin(): Promise<void> {
  if (!supabaseBrowser) return;
  const { error } = await supabaseBrowser.auth.signOut();
  if (error) throw error;
}
