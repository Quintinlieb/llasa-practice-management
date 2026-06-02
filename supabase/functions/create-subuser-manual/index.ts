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
  user_type?: "main_user" | "subuser"
  name?: string
  surname?: string
  contact_number?: string
  email?: string
  role?: "Consultant" | "Administrator" | "IT Support"
  profile_picture?: string
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
  const userType = (payload.user_type ?? "subuser").trim()
  const role = (payload.role ?? "").trim()
  const profilePicture = (payload.profile_picture ?? "").trim()
  const username = (payload.username ?? "").trim()
  const password = (payload.password ?? "").trim()

  if (!["main_user", "subuser"].includes(userType)) {
    return badRequest("Invalid user type")
  }

  if (!name || !surname || !contactNumber || !email || !username || !password) {
    return badRequest("All fields are required")
  }

  if (userType === "subuser" && !role) {
    return badRequest("Role is required for subusers")
  }

  if (userType === "subuser" && !["Consultant", "Administrator", "IT Support"].includes(role)) {
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
      user_type: userType,
      role: userType === "subuser" ? role : "Main",
      username,
      ...(userType === "subuser" ? { company_id: user.id } : {}),
    },
  })

  if (createUserError || !createdUser.user?.id) {
    return badRequest(createUserError?.message ?? "Unable to create auth user", 400)
  }

  if (userType === "main_user") {
    const { data: sourceProfile, error: sourceProfileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (sourceProfileError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id)
      return badRequest(sourceProfileError.message ?? "Unable to read source profile", 400)
    }

    const profileBaseRow = {
      id: createdUser.user.id,
      branches: Array.isArray(sourceProfile?.branches) ? sourceProfile.branches : [],
      branches_enabled: Boolean(sourceProfile?.branches_enabled ?? false),
      company_contact: sourceProfile?.company_contact ?? contactNumber,
      company_email: sourceProfile?.company_email ?? email,
      company_name: sourceProfile?.company_name ?? `${name} ${surname}`.trim(),
      company_type: sourceProfile?.company_type ?? "(Pty) Ltd",
      physical_address: sourceProfile?.physical_address ?? "N/A",
      postal_address: sourceProfile?.postal_address ?? "N/A",
      registration_number: sourceProfile?.registration_number ?? "N/A",
      representative_name: sourceProfile?.representative_name ?? name,
      representative_surname: sourceProfile?.representative_surname ?? surname,
      user_contact: contactNumber,
      user_email: email,
      user_name: name,
      user_surname: surname,
      vat_number: sourceProfile?.vat_number ?? null,
    }

    const profileRows = [
      { ...profileBaseRow, account_type: sourceProfile?.account_type ?? "business" },
      profileBaseRow,
      {
        id: createdUser.user.id,
        company_name: sourceProfile?.company_name ?? `${name} ${surname}`.trim(),
        registration_number: sourceProfile?.registration_number ?? "N/A",
        physical_address: sourceProfile?.physical_address ?? "N/A",
        postal_address: sourceProfile?.postal_address ?? "N/A",
        representative_name: sourceProfile?.representative_name ?? name,
        representative_surname: sourceProfile?.representative_surname ?? surname,
        company_contact: sourceProfile?.company_contact ?? contactNumber,
        company_email: sourceProfile?.company_email ?? email,
        user_name: name,
        user_surname: surname,
        user_contact: contactNumber,
        user_email: email,
      },
      {
        id: createdUser.user.id,
        user_name: name,
        user_surname: surname,
        user_contact: contactNumber,
        user_email: email,
      },
    ]

    let profileWriteError: { message?: string } | null = null
    let profileWritten = false
    for (const row of profileRows) {
      const { error } = await adminClient
        .from("profiles")
        .upsert(row, { onConflict: "id" })
      if (!error) {
        profileWritten = true
        profileWriteError = null
        break
      }
      const message = String(error.message ?? "").toLowerCase()
      if (message.includes("schema cache") || message.includes("column")) {
        profileWriteError = error
        continue
      }
      profileWriteError = error
      break
    }

    if (!profileWritten) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id)
      return badRequest(profileWriteError.message ?? "Unable to write profile row", 400)
    }

    if (profilePicture) {
      const { error: profilePictureUpdateError } = await adminClient
        .from("profiles")
        .update({ profile_picture: profilePicture })
        .eq("id", createdUser.user.id)

      if (profilePictureUpdateError) {
        const message = String(profilePictureUpdateError.message ?? "")
        if (!(message.includes("profile_picture") && message.includes("column"))) {
          return badRequest(message || "Unable to save profile picture", 400)
        }
      }
    }

    const appUrl = (Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "").replace(/\/$/, "")
    const loginUrl = appUrl ? `${appUrl}/auth` : "https://app.llasa.co.za/auth"
    const emailResult = await sendAccountCreatedEmail({
      to: email,
      name: `${name} ${surname}`.trim(),
      loginUrl,
      companyName: sourceProfile?.company_name,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        message: emailResult.sent
          ? "Main user created and email notification sent."
          : "Main user created. Email notification not sent.",
        auth_user_id: createdUser.user.id,
        email,
        email_notification_sent: emailResult.sent,
        email_notification_error: emailResult.sent ? null : emailResult.reason,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    )
  }

  const subuserBaseRow = {
    company_id: user.id,
    invited_by: user.id,
    auth_user_id: createdUser.user.id,
    name,
    surname,
    contact_number: contactNumber,
    email,
    profile_picture: profilePicture || null,
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

  if (profilePicture) {
    const { error: profilePictureUpdateError } = await adminClient
      .from("subusers")
      .update({ profile_picture: profilePicture })
      .eq("auth_user_id", createdUser.user.id)

    if (profilePictureUpdateError) {
      const message = String(profilePictureUpdateError.message ?? "")
      if (!(message.includes("profile_picture") && message.includes("column"))) {
        return badRequest(message || "Unable to save subuser profile picture", 400)
      }
    }
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
