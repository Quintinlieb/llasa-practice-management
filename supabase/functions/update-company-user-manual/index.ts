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
  user_type?: "main_user"
  profile_id?: string
  auth_user_id?: string
  name?: string
  surname?: string
  contact_number?: string
  email?: string
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

  const profileId = String(payload.profile_id ?? payload.auth_user_id ?? "").trim()
  const name = String(payload.name ?? "").trim()
  const surname = String(payload.surname ?? "").trim()
  const contactNumber = String(payload.contact_number ?? "").trim()
  const email = String(payload.email ?? "").trim().toLowerCase()
  const signatureStoragePath =
    payload.signature_storage_path === null ? null : String(payload.signature_storage_path ?? "").trim()

  if (!profileId) return json({ error: "Provide profile_id" }, 400)
  if (!name || !surname || !contactNumber || !email) return json({ error: "All fields are required" }, 400)

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
