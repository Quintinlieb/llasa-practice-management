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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: masterProfile, error: masterProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  const { data: subuserRow, error: subuserError } = masterProfile?.id
    ? { data: null, error: null }
    : await adminClient
        .from("subusers")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle()

  if ((masterProfileError && !subuserRow?.id) || (subuserError && !masterProfile?.id)) {
    return json({ error: "Forbidden" }, 403)
  }
  if (!masterProfile?.id && !subuserRow?.id) return json({ error: "Forbidden" }, 403)

  const { data, error } = await adminClient
    .from("user_presence")
    .select("auth_user_id,last_seen_at")

  if (error) return json({ error: error.message || "Unable to load presence" }, 400)
  return json({ ok: true, presence: data ?? [] })
})
