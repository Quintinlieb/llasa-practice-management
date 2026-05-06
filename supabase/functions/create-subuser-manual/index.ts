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

type CreateSubuserPayload = {
  name?: string
  surname?: string
  contact_number?: string
  email?: string
  role?: "Main" | "Consultant" | "Administrator"
  username?: string
  password?: string
}

const badRequest = (error: string, status = 400) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })

const sendAccountCreatedEmail = async (params: {
  to: string
  name: string
  loginUrl: string
  companyName?: string
}) => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail =
    Deno.env.get("SUBUSER_NOTIFY_FROM_EMAIL") ?? "LLASA <no-reply@llasa.co.za>"

  if (!resendApiKey) {
    return { sent: false, reason: "missing_resend_api_key" as const }
  }

  const subject = "Your LLASA account has been created"
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
      <p>Hi ${params.name},</p>
      <p>Your account has been created${params.companyName ? ` for <strong>${params.companyName}</strong>` : ""}.</p>
      <p>You can now log in using your username (your email address) and password.</p>
      <p>
        <a href="${params.loginUrl}" style="display:inline-block;padding:10px 14px;background:#3eca44;color:#ffffff;text-decoration:none;border-radius:4px;">
          Log In
        </a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${params.loginUrl}">${params.loginUrl}</a></p>
    </div>
  `

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    return { sent: false, reason: text || "resend_send_failed" as const }
  }

  return { sent: true as const }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return badRequest("Method not allowed", 405)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return badRequest("Server misconfigured", 500)

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return badRequest("Unauthorized", 401)

  let payload: CreateSubuserPayload
  try {
    payload = await req.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const name = (payload.name ?? "").trim()
  const surname = (payload.surname ?? "").trim()
  const contactNumber = (payload.contact_number ?? "").trim()
  const email = (payload.email ?? "").trim().toLowerCase()
  const role = (payload.role ?? "").trim()
  const username = (payload.username ?? "").trim()
  const password = (payload.password ?? "").trim()

  if (!name || !surname || !contactNumber || !email || !role || !username || !password) {
    return badRequest("All fields are required")
  }

  if (!["Main", "Consultant", "Administrator"].includes(role)) {
    return badRequest("Invalid role")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser()

  if (userError || !user) return badRequest("Unauthorized", 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      user_name: name,
      user_surname: surname,
      contact_number: contactNumber,
      role,
      username,
      company_id: user.id,
    },
  })

  if (createUserError || !createdUser.user?.id) {
    return badRequest(createUserError?.message ?? "Unable to create auth user", 400)
  }

  const subuserBaseRow = {
    company_id: user.id,
    invited_by: user.id,
    auth_user_id: createdUser.user.id,
    name,
    surname,
    contact_number: contactNumber,
    email,
    status: "accepted",
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
  }
  const subuserRowWithRole = { ...subuserBaseRow, role }
  const tryInsert = async (row: Record<string, unknown>) =>
    adminClient.from("subusers").insert(row)
  const tryUpdateByCompanyAndEmail = async (row: Record<string, unknown>) =>
    adminClient
      .from("subusers")
      .update(row)
      .eq("company_id", user.id)
      .eq("email", email)

  let writeError: { message?: string } | null = null
  const { error: insertWithRoleError } = await tryInsert(subuserRowWithRole)
  if (!insertWithRoleError) {
    writeError = null
  } else {
    const message = String(insertWithRoleError.message ?? "")
    if (message.includes("role") && message.includes("column")) {
      const { error: insertNoRoleError } = await tryInsert(subuserBaseRow)
      if (!insertNoRoleError) {
        writeError = null
      } else if (String(insertNoRoleError.message ?? "").toLowerCase().includes("duplicate")) {
        const { error: updateNoRoleError } = await tryUpdateByCompanyAndEmail(subuserBaseRow)
        writeError = updateNoRoleError ?? null
      } else {
        writeError = insertNoRoleError
      }
    } else if (message.toLowerCase().includes("duplicate")) {
      const { error: updateWithRoleError } = await tryUpdateByCompanyAndEmail(subuserRowWithRole)
      if (!updateWithRoleError) {
        writeError = null
      } else {
        const updateMessage = String(updateWithRoleError.message ?? "")
        if (updateMessage.includes("role") && updateMessage.includes("column")) {
          const { error: updateNoRoleError } = await tryUpdateByCompanyAndEmail(subuserBaseRow)
          writeError = updateNoRoleError ?? null
        } else {
          writeError = updateWithRoleError
        }
      }
    } else {
      writeError = insertWithRoleError
    }
  }

  if (writeError) {
    // Avoid orphaned auth users if subuser row write fails
    await adminClient.auth.admin.deleteUser(createdUser.user.id)
    return badRequest(writeError.message ?? "Unable to write subuser row", 400)
  }

  const appUrl = (Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "").replace(/\/$/, "")
  const loginUrl = appUrl ? `${appUrl}/auth` : "https://app.llasa.co.za/auth"
  const emailResult = await sendAccountCreatedEmail({
    to: email,
    name: `${name} ${surname}`.trim(),
    loginUrl,
  })

  return new Response(
    JSON.stringify({
      ok: true,
      message: emailResult.sent
        ? "Subuser created and email notification sent."
        : "Subuser created. Email notification not sent.",
      auth_user_id: createdUser.user.id,
      email,
      email_notification_sent: emailResult.sent,
      email_notification_error: emailResult.sent ? null : emailResult.reason,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  )
})
