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

type DeleteSubuserPayload = {
  subuser_id?: string
  auth_user_id?: string
  email?: string
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
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Unauthorized" }, 401)

  let payload: DeleteSubuserPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const subuserId = String(payload.subuser_id ?? "").trim()
  const authUserId = String(payload.auth_user_id ?? "").trim()
  const email = String(payload.email ?? "").trim().toLowerCase()
  if (!subuserId && !authUserId && !email) {
    return json({ error: "Provide subuser_id, auth_user_id, or email" }, 400)
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()
  if (authError || !user) return json({ error: "Unauthorized" }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Only master users (profiles table) can delete subusers.
  const { data: masterProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError || !masterProfile?.id) return json({ error: "Forbidden" }, 403)

  let query = adminClient
    .from("subusers")
    .select("id,auth_user_id,email,company_id")
    .eq("company_id", user.id)
    .limit(1)

  if (subuserId) query = query.eq("id", subuserId)
  else if (authUserId) query = query.eq("auth_user_id", authUserId)
  else query = query.eq("email", email)

  const { data: row, error: rowError } = await query.maybeSingle()
  if (rowError) return json({ error: rowError.message || "Unable to load subuser" }, 400)
  if (!row) return json({ error: "Subuser not found" }, 404)

  const resolvedAuthUserId = String(row.auth_user_id ?? "").trim()

  const { error: deleteSubuserError } = await adminClient
    .from("subusers")
    .delete()
    .eq("id", row.id)
    .eq("company_id", user.id)
  if (deleteSubuserError) {
    return json({ error: deleteSubuserError.message || "Unable to delete subuser row" }, 400)
  }

  if (resolvedAuthUserId) {
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(resolvedAuthUserId)
    if (deleteAuthError) {
      return json(
        {
          error: deleteAuthError.message || "Subuser row deleted, but auth user delete failed",
          partial: true,
          subuser_deleted: true,
          auth_deleted: false,
        },
        400,
      )
    }
  }

  return json({
    ok: true,
    subuser_deleted: true,
    auth_deleted: Boolean(resolvedAuthUserId),
    deleted_subuser_id: row.id,
    deleted_auth_user_id: resolvedAuthUserId || null,
  })
})

