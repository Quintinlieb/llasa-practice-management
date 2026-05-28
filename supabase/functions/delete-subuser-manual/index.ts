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

type SubuserLookupRow = {
  id: string
  auth_user_id: string | null
  email: string | null
  profile_picture: string | null
  signature_storage_path: string | null
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })

const isAuthUserMissingError = (error: { message?: string } | null | undefined) => {
  const message = String(error?.message ?? "").trim().toLowerCase()
  return (
    message.includes("user not found") ||
    message.includes("not found") ||
    message.includes("does not exist")
  )
}

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

  // Only master users (profiles row exists) can delete subusers.
  const { data: masterProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError || !masterProfile?.id) return json({ error: "Forbidden" }, 403)

  const tryLookup = async (column: "id" | "auth_user_id" | "email", value: string) => {
    const { data, error } = await adminClient
      .from("subusers")
      .select("id,auth_user_id,email,profile_picture,signature_storage_path")
      .eq(column, value)
      .limit(1)
      .maybeSingle()
    return { row: (data as SubuserLookupRow | null) ?? null, error }
  }

  let row: SubuserLookupRow | null = null
  let rowError: { message?: string } | null = null

  if (subuserId) {
    const result = await tryLookup("id", subuserId)
    row = result.row
    rowError = result.error
  }
  if (!row && !rowError && authUserId) {
    const result = await tryLookup("auth_user_id", authUserId)
    row = result.row
    rowError = result.error
  }
  if (!row && !rowError && email) {
    const result = await tryLookup("email", email)
    row = result.row
    rowError = result.error
  }

  if (rowError) return json({ error: rowError.message || "Unable to load subuser" }, 400)
  if (!row) {
    return json(
      {
        error: "Subuser not found",
        lookup: {
          subuser_id: subuserId || null,
          auth_user_id: authUserId || null,
          email: email || null,
        },
      },
      404,
    )
  }

  const resolvedAuthUserId = String(row.auth_user_id ?? "").trim()
  const profilePicturePath = String(row.profile_picture ?? "").trim()
  const signatureStoragePath = String(row.signature_storage_path ?? "").trim()

  const { error: deleteSubuserError } = await adminClient
    .from("subusers")
    .delete()
    .eq("id", row.id)
  if (deleteSubuserError) {
    return json({ error: deleteSubuserError.message || "Unable to delete subuser row" }, 400)
  }

  if (resolvedAuthUserId) {
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(resolvedAuthUserId)
    if (deleteAuthError && !isAuthUserMissingError(deleteAuthError)) {
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

  if (profilePicturePath && !/^(?:data:|blob:|https?:\/\/)/i.test(profilePicturePath)) {
    const normalizedProfilePicturePath = profilePicturePath.replace(/^profile-pictures\//, "")
    await adminClient.storage.from("profile-pictures").remove([normalizedProfilePicturePath])
  }
  if (signatureStoragePath && !/^(?:data:|blob:|https?:\/\/)/i.test(signatureStoragePath)) {
    const normalizedSignaturePath = signatureStoragePath.replace(/^user-signatures\//, "")
    await adminClient.storage.from("user-signatures").remove([normalizedSignaturePath])
  }

  return json({
    ok: true,
    subuser_deleted: true,
    auth_deleted: Boolean(resolvedAuthUserId),
    deleted_subuser_id: row.id,
    deleted_auth_user_id: resolvedAuthUserId || null,
  })
})
