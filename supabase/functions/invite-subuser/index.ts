import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

declare const Deno: {
  env: { get: (key: string) => string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type InviteSubuserPayload = {
  name?: string
  surname?: string
  contact_number?: string
  email?: string
}

const badRequest = (error: string, status = 400) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return badRequest("Method not allowed", 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return badRequest("Server misconfigured", 500)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return badRequest("Unauthorized", 401)
  }

  let payload: InviteSubuserPayload
  try {
    payload = await req.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const name = (payload.name ?? "").trim()
  const surname = (payload.surname ?? "").trim()
  const contactNumber = (payload.contact_number ?? "").trim()
  const email = (payload.email ?? "").trim().toLowerCase()

  if (!name || !surname || !contactNumber || !email) {
    return badRequest("All fields are required")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser()

  if (userError || !user) {
    return badRequest("Unauthorized", 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const appUrl = Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? ""
  const redirectTo = appUrl ? `${appUrl.replace(/\/$/, "")}/auth` : undefined

  const { data: inviteResult, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_by_company_id: user.id,
        name,
        surname,
        contact_number: contactNumber,
        role: "subuser",
      },
      ...(redirectTo ? { redirectTo } : {}),
    })

  if (inviteError) {
    return badRequest(inviteError.message, 400)
  }

  const invitedAuthUserId = inviteResult.user?.id ?? null

  const { error: upsertError } = await adminClient
    .from("subusers")
    .upsert(
      {
        company_id: user.id,
        invited_by: user.id,
        auth_user_id: invitedAuthUserId,
        name,
        surname,
        contact_number: contactNumber,
        email,
        status: "invited",
        invited_at: new Date().toISOString(),
        accepted_at: null,
      },
      {
        onConflict: "company_id,email",
      },
    )

  if (upsertError) {
    return badRequest(upsertError.message, 400)
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Invite sent",
      email,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  )
})
