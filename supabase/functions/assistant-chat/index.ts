import "jsr:@supabase/functions-js/edge-runtime.d.ts"

declare const Deno: {
  env: { get: (key: string) => string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
const SYSTEM_PROMPT =
  "You are an AI assistant specialising in South African labour law, responding as an experienced labour-law consultant advising employers. " +
  "Respond in a normal, friendly conversational style using plain paragraphs only. " +
  "Do not use numbered paragraphs, numbered lists, bullet points, markdown, or headings. " +
  "Keep answers brief, direct, and employer-focused. " +
  "Provide practical guidance focused on best labour-law practices in South Africa. " +
  "Do not cite or reference specific provisions, sections, or case law. " +
  "If asked for specific legal provisions or case law, respond politely that this platform is not an expert legal advisor and provides only general guidance on best labour-law practices in South Africa. " +
  "Do not instruct users to hold disciplinary hearings before issuing warnings; hearings are not required for warnings. " +
  "If the guidance includes issuing a warning, mention that the user can create a warning document in Nudoc using the documents section. " +
  "If the question is about contracts and it appears the employee does not have a contract, recommend using the Nudoc contract generator to create one. " +
  "If the issue is complex or fact-specific, recommend contacting an expert for professional support."
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const usageScopeLimits: Record<string, number> = {
  assistant: 10,
  disciplinary_drafting: 7,
}

const isDraftingAssistantPrompt = (message: string) =>
  /draft a formal disciplinary charge description/i.test(message)

type OffenceRow = {
  name: string
  first?: string
  second?: string
  third?: string
  fourth?: string
}

const fallbackOffences: OffenceRow[] = [
  { name: "Unauthorised absenteeism", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Arriving late for work", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Leaving work early", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Failure to report absence", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Failure to report late arrival", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Failure to report leaving early", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Sleeping on duty", first: "First Written Warning", second: "Final Written Warning", third: "Dismissal" },
  { name: "Failure to clock in/out", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Poor housekeeping", first: "First Written Warning", second: "Final Written Warning", third: "Dismissal" },
  { name: "Horseplay", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Unauthorised use of cell phone", first: "First Written Warning", second: "Second Written Warning", third: "Final Written Warning", fourth: "Dismissal" },
  { name: "Breach of Policy or Procedure", first: "First Written Warning", second: "Final Written Warning", third: "Dismissal" },
  { name: "Breach of Rules or Regulations", first: "First Written Warning", second: "Final Written Warning", third: "Dismissal" },
  { name: "Failure to carry out instructions", first: "First Written Warning", second: "Final Written Warning", third: "Dismissal" },
  { name: "Negligence", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised absenteeism > 5 days", first: "Final Written Warning", second: "Dismissal" },
  { name: "Refusal to work overtime", first: "Final Written Warning", second: "Dismissal" },
  { name: "Consistent poor time keeping", first: "Final Written Warning", second: "Dismissal" },
  { name: "Causing inharmonious relationships", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unbecoming behaviour", first: "Final Written Warning", second: "Dismissal" },
  { name: "Insolence / Disrespectful behaviour", first: "Final Written Warning", second: "Dismissal" },
  { name: "Aggressive behaviour", first: "Final Written Warning", second: "Dismissal" },
  { name: "Insubordination / Refusing instructions", first: "Final Written Warning", second: "Dismissal" },
  { name: "Refusal to comply with policy/procedure", first: "Final Written Warning", second: "Dismissal" },
  { name: "Refusal to comply with rule", first: "Final Written Warning", second: "Dismissal" },
  { name: "Damage to company name", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised wastage of materials", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised removal", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised possession", first: "Final Written Warning", second: "Dismissal" },
  { name: "Breach of OHS standards / policies", first: "Final Written Warning", second: "Dismissal" },
  { name: "Private work during working hours", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised disclosure of information", first: "Final Written Warning", second: "Dismissal" },
  { name: "Misappropriation of property / funds", first: "Final Written Warning", second: "Dismissal" },
  { name: "Testing positive for alcohol", first: "Final Written Warning", second: "Dismissal" },
  { name: "Testing positive for illegal drugs", first: "Final Written Warning", second: "Dismissal" },
  { name: "Under the influence of alcohol/drugs", first: "Final Written Warning", second: "Dismissal" },
  { name: "Possession of alcohol/drugs on duty", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised possession of firearm on duty", first: "Final Written Warning", second: "Dismissal" },
  { name: "Intimidation", first: "Final Written Warning", second: "Dismissal" },
  { name: "Incitement", first: "Final Written Warning", second: "Dismissal" },
  { name: "Illegal strike / picketing", first: "Final Written Warning", second: "Dismissal" },
  { name: "Viewing pornographic material on duty", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised access", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised use of company property", first: "Final Written Warning", second: "Dismissal" },
  { name: "Unauthorised use of client property", first: "Final Written Warning", second: "Dismissal" },
  { name: "Abusive language", first: "Final Written Warning", second: "Dismissal" },
  { name: "Dishonesty", first: "Final Written Warning", second: "Dismissal" },
  { name: "Gambling on duty", first: "Final Written Warning", second: "Dismissal" },
  { name: "Clocking for another employee", first: "Final Written Warning", second: "Dismissal" },
  { name: "Theft", first: "Dismissal" },
  { name: "Accomplice to theft", first: "Dismissal" },
  { name: "Fraud", first: "Dismissal" },
  { name: "Accomplice to fraud", first: "Dismissal" },
  { name: "Gross dishonesty", first: "Dismissal" },
  { name: "Gross negligence", first: "Dismissal" },
  { name: "Assault", first: "Dismissal" },
  { name: "Sexual harassment", first: "Dismissal" },
  { name: "Viewing illegal pornography on duty", first: "Dismissal" },
  { name: "Racism", first: "Dismissal" },
  { name: "Refusal to obey OHS rules/procedures", first: "Dismissal" },
  { name: "Bribery", first: "Dismissal" },
  { name: "Falsification of records", first: "Dismissal" },
  { name: "Intentional damage to property", first: "Dismissal" },
  { name: "Gross insubordination", first: "Dismissal" },
  { name: "Unauthorised discharge of firearm", first: "Dismissal" },
  { name: "Unsafe use of firearm", first: "Dismissal" },
  { name: "Threatening another employee/client", first: "Dismissal" },
  { name: "Unauthorised possession of a weapon on duty", first: "Dismissal" },
]

const stopWords = new Set([
  "of",
  "for",
  "to",
  "the",
  "and",
  "or",
  "with",
  "on",
  "in",
  "a",
  "an",
])

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !stopWords.has(token)) ?? []

const pickOffence = (messageLower: string, offences: OffenceRow[]) => {
  const hasAbsence = /absent|absence|absentee/.test(messageLower)
  const hasFiveDays =
    /(?:\b5\b|\bfive\b)\s*day/.test(messageLower) ||
    /more than\s*5\s*day/.test(messageLower) ||
    />\s*5\s*day/.test(messageLower)
  const hasProlonged =
    /prolong|extended|longed/.test(messageLower) && hasAbsence

  if (hasAbsence && (hasFiveDays || hasProlonged)) {
    const match = offences.find((offence) =>
      offence.name.toLowerCase().includes("absenteeism > 5 days")
    )
    if (match) return match
  }

  let bestMatch: { score: number; offence: OffenceRow } | null = null
  for (const offence of offences) {
    const keywords = tokenize(offence.name)
    if (keywords.length === 0) continue
    const matched = keywords.filter((token) => messageLower.includes(token))
    const score = matched.length / keywords.length
    const acceptable = score >= 0.5 || (keywords.length <= 2 && matched.length >= 1)
    if (!acceptable) continue
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { score, offence }
    }
  }

  if (bestMatch) return bestMatch.offence
  if (hasAbsence) {
    return offences.find((offence) =>
      offence.name.toLowerCase().includes("absenteeism")
    ) ?? null
  }
  return null
}

const joinWithAnd = (items: string[]) => {
  if (items.length <= 1) return items.join("")
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

const buildOutcomeNote = (offence: OffenceRow) => {
  const parts: string[] = []
  if (offence.first) parts.push(`a first offence typically attracts ${offence.first}`)
  if (offence.second) parts.push(`a second offence typically attracts ${offence.second}`)
  if (offence.third) parts.push(`a third offence typically attracts ${offence.third}`)
  if (offence.fourth) parts.push(`a further offence may lead to ${offence.fourth}`)
  if (parts.length === 0) return ""
  const sentence = joinWithAnd(parts)
  return `In the Nudoc Code of Conduct, ${offence.name.toLowerCase()} is treated so that ${sentence}.`
}

const wantsWarningOutcome = (value: string) =>
  /what (type|kind) of warning|what warning|which warning|warning should|warning do|warning for|issue a warning|written warning|final warning|final written warning|sanction for|disciplinary outcome|outcome for/.test(
    value,
  )

const isLikelyDismissibleQuestion = (value: string) =>
  /theft|fraud|bribery|assault|sexual harassment|gross dishonesty|gross negligence|racism|falsification|firearm|weapon|pornography|threaten|dishonesty|accomplice/.test(
    value,
  )

const stripWarningSentences = (text: string) => {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const filtered = sentences.filter(
    (sentence) => !/warning/i.test(sentence),
  )
  const result = filtered.join(" ").trim()
  return result.length > 0 ? result : text
}

const loadOffences = async (req: Request): Promise<OffenceRow[]> => {
  try {
    const url = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!url || !anonKey || !authHeader) {
      return fallbackOffences
    }

    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
      },
    })
    if (!userResponse.ok) {
      return fallbackOffences
    }
    const userData = await userResponse.json()
    const userId = userData?.id as string | undefined
    if (!userId) {
      return fallbackOffences
    }

    const conductResponse = await fetch(
      `${url}/rest/v1/company_code_of_conduct?select=data&company_id=eq.${userId}&limit=1`,
      {
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
        },
      },
    )
    if (!conductResponse.ok) {
      return fallbackOffences
    }
    const conductRows = await conductResponse.json()
    const sections =
      (conductRows?.[0]?.data as { sections?: { offences?: OffenceRow[] }[] } | null)
        ?.sections ?? []
    const offences = sections.flatMap((section) => section.offences ?? [])
    return offences.length > 0 ? offences : fallbackOffences
  } catch {
    return fallbackOffences
  }
}

const incrementAssistantUsage = async (
  url: string,
  anonKey: string,
  authHeader: string,
  usageScope: string,
): Promise<number | null> => {
  const parseUsageCount = (payload: unknown): number | null => {
    if (typeof payload === "number") return payload
    if (typeof payload === "string") {
      const n = Number(payload)
      return Number.isNaN(n) ? null : n
    }
    if (Array.isArray(payload)) {
      const first = payload[0]
      if (typeof first === "number") return first
      if (typeof first === "string") {
        const n = Number(first)
        if (!Number.isNaN(n)) return n
      }
      if (first && typeof first === "object") {
        const obj = first as Record<string, unknown>
        const candidate =
          obj.count ?? obj.request_count ?? obj.increment_assistant_usage
        return parseUsageCount(candidate)
      }
      return null
    }
    if (payload && typeof payload === "object") {
      const obj = payload as Record<string, unknown>
      const candidate =
        obj.count ?? obj.request_count ?? obj.increment_assistant_usage
      return parseUsageCount(candidate)
    }
    return null
  }

  const headers = {
    Authorization: authHeader,
    apikey: anonKey,
    "Content-Type": "application/json",
  }

  try {
    let response = await fetch(`${url}/rest/v1/rpc/increment_assistant_usage`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_usage_scope: usageScope }),
    })

    if (!response.ok) {
      response = await fetch(`${url}/rest/v1/rpc/increment_assistant_usage`, {
        method: "POST",
        headers,
        body: "{}",
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.log("USAGE_RPC_STATUS:", response.status)
      console.log("USAGE_RPC_ERROR:", errorText)
      return null
    }

    const raw = await response.text()
    const parsed = raw ? JSON.parse(raw) : null
    return parseUsageCount(parsed)
  } catch {
    return null
  }
}


Deno.serve(async (req: Request) => {
  console.log("HIT assistant-chat")
  console.log("METHOD:", req.method)
  console.log("HAS_KEY:", Boolean(Deno.env.get("OPENAI_API_KEY")))

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  let body: {
    message?: string
    history?: Array<{ role?: string; content?: string }>
    scope?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const requestedScope =
    typeof body.scope === "string" ? body.scope.trim().toLowerCase() : ""
  const inferredScope = isDraftingAssistantPrompt(message)
    ? "disciplinary_drafting"
    : "assistant"
  const usageScope = usageScopeLimits[requestedScope] ? requestedScope : inferredScope
  const maxDailyQuestions = usageScopeLimits[usageScope]

  if (!message) {
    return new Response(
      JSON.stringify({ error: "Message is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const usageCount = await incrementAssistantUsage(
    supabaseUrl,
    supabaseAnonKey,
    authHeader,
    usageScope,
  )
  if (usageCount === null) {
    return new Response(
      JSON.stringify({ error: "Usage tracking failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }
  const remaining = Math.max(0, maxDailyQuestions - usageCount)
  if (usageCount > maxDailyQuestions) {
    return new Response(
      JSON.stringify({
        error: "Daily limit reached",
        limit: maxDailyQuestions,
        remaining: 0,
        scope: usageScope,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY")
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const history = Array.isArray(body.history) ? body.history : []
  const cleanedHistory = history
    .filter(
      (item): item is { role: "user" | "assistant"; content: string } =>
        (item?.role === "user" || item?.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0,
    )
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))

  const lastHistory = cleanedHistory[cleanedHistory.length - 1]
  const shouldAppendMessage =
    !lastHistory ||
    lastHistory.role !== "user" ||
    lastHistory.content !== message

  const payload = {
    model: "gpt-4o-mini",
    max_tokens: 250,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...cleanedHistory,
      ...(shouldAppendMessage ? [{ role: "user", content: message }] : []),
    ],
  }

  const aiResponse = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!aiResponse.ok) {
  const errorText = await aiResponse.text()
  console.log("OPENAI_STATUS:", aiResponse.status)
  console.log("OPENAI_ERROR:", errorText)

  return new Response(
    JSON.stringify({ error: "OpenAI request failed" }),
    {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  )
}


  const result = await aiResponse.json()
  const reply = result?.choices?.[0]?.message?.content
  if (typeof reply !== "string" || !reply.trim()) {
    return new Response(
      JSON.stringify({ error: "Empty response from OpenAI" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    )
  }

  const plainReply = String(reply)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[\-\u2022]\s+/gm, "")
    .replace(/^\s*\d+[\).\s]+\s*/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph: string) =>
      paragraph.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim()
    )
    .filter(Boolean)
    .join("\n\n")

  const lowerMessage = message.toLowerCase()
  const lowerReply = plainReply.toLowerCase()
  const codeOfConductRelevant =
    /misconduct|disciplin|warning|hearing|absent|absentee|attendance/.test(
      lowerMessage,
    ) ||
    /misconduct|disciplin|warning|hearing/.test(lowerReply)

  let codeOfConductNote = ""
  let dismissibleMatch: OffenceRow | null = null
  if (codeOfConductRelevant && isLikelyDismissibleQuestion(lowerMessage)) {
    const offences = await loadOffences(req)
    const match = pickOffence(lowerMessage, offences)
    if (match && match.first?.toLowerCase() === "dismissal" && !match.second) {
      dismissibleMatch = match
    }
  }

  if (codeOfConductRelevant) {
    if (wantsWarningOutcome(lowerMessage)) {
      const offences = await loadOffences(req)
      const match = pickOffence(lowerMessage, offences)
      if (match) {
        codeOfConductNote = buildOutcomeNote(match)
      } else {
        codeOfConductNote =
          "Your Code of Conduct sets outcomes by offence and prior warnings, so confirm the exact offence and prior warnings to align the correct outcome."
      }
    } else if (!lowerReply.includes("code of conduct")) {
      codeOfConductNote =
        "You can also refer to your Code of Conduct in the Documents section for guidance."
    }
  }

  const baseReply =
    dismissibleMatch && /warning/.test(lowerReply)
      ? stripWarningSentences(plainReply)
      : plainReply

  const dismissibleNote =
    dismissibleMatch && !codeOfConductNote
      ? buildOutcomeNote(dismissibleMatch)
      : ""

  const finalReply = wantsWarningOutcome(lowerMessage) && codeOfConductNote
    ? `${codeOfConductNote} Ensure you follow a fair process and keep clear records before issuing any disciplinary outcome.`
    : codeOfConductNote || dismissibleNote
      ? `${baseReply}\n\n${codeOfConductNote || dismissibleNote}`
      : baseReply

  return new Response(
    JSON.stringify({ reply: finalReply, remaining, scope: usageScope }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/assistant-chat' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
