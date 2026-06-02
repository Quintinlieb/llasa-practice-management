import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

declare const Deno: {
  env: { get: (key: string) => string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500)

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Unauthorized" }, 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()
  if (authError || !user?.id) return json({ error: "Unauthorized" }, 401)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const isExplicitOffline =
    body.is_online === false ||
    body.online === false ||
    String(body.status ?? "").trim().toLowerCase() === "offline"

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = new Date().toISOString()
  const metadata = user.user_metadata ?? {}
  const metadataName = String(metadata.user_name || metadata.name || "").trim()
  const metadataSurname = String(metadata.user_surname || metadata.surname || "").trim()
  const metadataEmail = String(user.email || "").trim()
  let payload: Record<string, unknown> = {
    auth_user_id: user.id,
    user_type: "main_user",
    profile_id: user.id,
    subuser_id: null,
    display_name: `${metadataName} ${metadataSurname}`.trim() || metadataEmail || "User",
    email: metadataEmail,
    last_seen_at: now,
    is_online: !isExplicitOffline,
    signed_out_at: isExplicitOffline ? now : null,
    updated_at: now,
  }

  const { data: profileRow } = await adminClient
    .from("profiles")
    .select("id,user_name,user_surname,user_email")
    .eq("id", user.id)
    .maybeSingle()

  if (profileRow?.id) {
    const displayName = `${String(profileRow.user_name || "").trim()} ${String(profileRow.user_surname || "").trim()}`.trim()
    payload = {
      ...payload,
      user_type: "main_user",
      profile_id: String(profileRow.id),
      subuser_id: null,
      display_name: displayName || metadataEmail || "User",
      email: String(profileRow.user_email || metadataEmail).trim(),
    }
  } else {
    const { data: subuserRow } = await adminClient
      .from("subusers")
      .select("id,name,surname,email")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (subuserRow?.id) {
      const displayName = `${String(subuserRow.name || "").trim()} ${String(subuserRow.surname || "").trim()}`.trim()
      payload = {
        ...payload,
        user_type: "subuser",
        profile_id: null,
        subuser_id: String(subuserRow.id),
        display_name: displayName || metadataEmail || "User",
        email: String(subuserRow.email || metadataEmail).trim(),
      }
    }
  }

  let { error } = await adminClient
    .from("user_presence")
    .upsert(payload, { onConflict: "auth_user_id" })

  if (error) {
    const message = String(error.message ?? "").toLowerCase()
    const isMissingOnlineColumn =
      message.includes("is_online") ||
      message.includes("signed_out_at") ||
      message.includes("schema cache") ||
      message.includes("column")

    if (isMissingOnlineColumn) {
      const fallbackPayload = { ...payload }
      delete fallbackPayload.is_online
      delete fallbackPayload.signed_out_at
      const fallbackResult = await adminClient
        .from("user_presence")
        .upsert(fallbackPayload, { onConflict: "auth_user_id" })
      error = fallbackResult.error
    }
  }

  if (error) return json({ error: error.message || "Unable to update presence" }, 400)
  return json({ ok: true, is_online: !isExplicitOffline, last_seen_at: now })
})
