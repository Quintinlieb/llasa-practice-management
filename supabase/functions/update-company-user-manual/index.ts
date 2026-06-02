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

type UpdateCompanyUserPayload = {
  user_type?: "main_user" | "subuser"
  profile_id?: string
  subuser_id?: string
  auth_user_id?: string
  name?: string
  surname?: string
  contact_number?: string
  email?: string
  username?: string
  role?: string
  signature_storage_path?: string | null
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

  let payload: UpdateCompanyUserPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const userType = String(payload.user_type ?? "main_user").trim()
  const profileId = String(payload.profile_id ?? "").trim()
  const subuserId = String(payload.subuser_id ?? "").trim()
  const authUserId = String(payload.auth_user_id ?? "").trim()
  const name = String(payload.name ?? "").trim()
  const surname = String(payload.surname ?? "").trim()
  const contactNumber = String(payload.contact_number ?? "").trim()
  const email = String(payload.email ?? "").trim().toLowerCase()
  const username = String(payload.username ?? email).trim().toLowerCase()
  const role = String(payload.role ?? "").trim()
  const signatureStoragePath =
    payload.signature_storage_path === null ? null : String(payload.signature_storage_path ?? "").trim()

  if (!["main_user", "subuser"].includes(userType)) return json({ error: "Invalid user type" }, 400)
  if (userType === "main_user" && !profileId) return json({ error: "Provide profile_id" }, 400)
  if (userType === "subuser" && !subuserId) return json({ error: "Provide subuser_id" }, 400)
  if (!name || !surname || !contactNumber || !email || !username) return json({ error: "All fields are required" }, 400)
  if (userType === "subuser" && !role) return json({ error: "Role is required" }, 400)

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

  const { data: masterProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError || !masterProfile?.id) return json({ error: "Forbidden" }, 403)

  if (userType === "main_user" && authUserId) {
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      email: username,
      email_confirm: true,
      user_metadata: {
        user_name: name,
        user_surname: surname,
        contact_number: contactNumber,
        username,
        role: "Main",
        user_type: "main_user",
      },
    })
    if (authUpdateError) return json({ error: authUpdateError.message || "Unable to update auth user" }, 400)
  }

  if (userType === "subuser") {
    const { data: subuserRow, error: subuserLookupError } = await adminClient
      .from("subusers")
      .select("id,auth_user_id")
      .eq("id", subuserId)
      .maybeSingle()
    if (subuserLookupError || !subuserRow?.id) return json({ error: "Subuser not found" }, 404)

    const resolvedAuthUserId = String(subuserRow.auth_user_id ?? authUserId).trim()
    if (resolvedAuthUserId) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(resolvedAuthUserId, {
        email: username,
        email_confirm: true,
        user_metadata: {
          user_name: name,
          user_surname: surname,
          contact_number: contactNumber,
          username,
          role,
          user_type: "subuser",
          company_id: user.id,
        },
      })
      if (authUpdateError) return json({ error: authUpdateError.message || "Unable to update auth user" }, 400)
    }

    const updatePayloads = [
      {
        name,
        surname,
        contact_number: contactNumber,
        email,
        role,
        signature_storage_path: signatureStoragePath || null,
      },
      {
        name,
        surname,
        contact_number: contactNumber,
        email,
        role,
      },
      {
        name,
        surname,
        contact_number: contactNumber,
        email,
      },
    ]

    let updateError: { message?: string } | null = null
    let updated = false
    for (const updatePayload of updatePayloads) {
      const { error } = await adminClient
        .from("subusers")
        .update(updatePayload)
        .eq("id", subuserId)
      if (!error) {
        updateError = null
        updated = true
        break
      }
      const message = String(error.message ?? "").toLowerCase()
      if (message.includes("schema cache") || message.includes("column")) {
        updateError = error
        continue
      }
      updateError = error
      break
    }

    if (!updated) return json({ error: updateError?.message || "Unable to update subuser" }, 400)

    return json({
      ok: true,
      subuser_id: subuserId,
      auth_user_id: resolvedAuthUserId || null,
    })
  }

  const updatePayloads = [
    {
      user_name: name,
      user_surname: surname,
      user_contact: contactNumber,
      user_email: email,
      signature_storage_path: signatureStoragePath || null,
    },
    {
      user_name: name,
      user_surname: surname,
      user_contact: contactNumber,
      user_email: email,
    },
  ]

  let updateError: { message?: string } | null = null
  let updated = false
  for (const updatePayload of updatePayloads) {
    const { error } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", profileId)
    if (!error) {
      updateError = null
      updated = true
      break
    }
    const message = String(error.message ?? "").toLowerCase()
    if (message.includes("schema cache") || message.includes("column")) {
      updateError = error
      continue
    }
    updateError = error
    break
  }

  if (!updated) return json({ error: updateError?.message || "Unable to update main user" }, 400)

  return json({
    ok: true,
    profile_id: profileId,
  })
})
