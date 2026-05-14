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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  let payload: { email?: string }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const email = String(payload.email ?? "").trim().toLowerCase()
  if (!email) {
    return jsonResponse({ error: "Email is required" }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profileMatch, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .ilike("user_email", email)
    .limit(1)
    .maybeSingle()

  if (profileError) {
    return jsonResponse({ error: profileError.message ?? "Unable to validate email" }, 500)
  }

  if (profileMatch) {
    return jsonResponse({ exists: true })
  }

  const { data: subuserMatch, error: subuserError } = await adminClient
    .from("subusers")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle()

  if (subuserError) {
    return jsonResponse({ error: subuserError.message ?? "Unable to validate email" }, 500)
  }

  return jsonResponse({ exists: Boolean(subuserMatch) })
})
