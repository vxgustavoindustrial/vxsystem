import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || ""
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || ""
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "vx-deliveries"
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || ""

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const R2_FILE_PREFIX = "r2://"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

const textEncoder = new TextEncoder()

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function encodeObjectKey(key: string) {
  return key.split("/").map(awsEncode).join("/")
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(value))
  return toHex(new Uint8Array(hash))
}

async function hmac(key: Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(value))
  return new Uint8Array(signature)
}

async function getSigningKey(secret: string, dateStamp: string) {
  const kDate = await hmac(textEncoder.encode(`AWS4${secret}`), dateStamp)
  const kRegion = await hmac(kDate, "auto")
  const kService = await hmac(kRegion, "s3")
  return await hmac(kService, "aws4_request")
}

async function createR2SignedUrl(method: "GET" | "PUT", objectKey: string) {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const canonicalUri = `/${R2_BUCKET_NAME}/${encodeObjectKey(objectKey)}`
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY_ID}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(60 * 60 * 6),
    "X-Amz-SignedHeaders": "host",
  }
  const canonicalQuery = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&")
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n")
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n")
  const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, dateStamp)
  const signature = toHex(await hmac(signingKey, stringToSign))

  return `${R2_ENDPOINT}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401)
    }

    const sessionClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser()

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, client_id, client_role, vx_role, is_active")
      .eq("id", user.id)
      .single()

    if (!profile?.is_active) {
      return json({ error: "Forbidden" }, 403)
    }

    const { clientId, projectId, fileName, isResult = false } = await req.json()

    if (!clientId || !projectId || !fileName) {
      return json({ error: "Missing required fields: clientId, projectId, fileName" }, 400)
    }

    const { data: project } = await supabase
      .from("vx_projects")
      .select("id, client_id")
      .eq("id", projectId)
      .eq("client_id", clientId)
      .maybeSingle()

    if (!project) {
      return json({ error: "Project not found" }, 404)
    }

    const isVxUser = profile.role === "admin" || profile.vx_role === "programador" || profile.vx_role === "admin"
    const isClientProjetista = profile.role === "client" && profile.client_id === clientId && profile.client_role === "projetista"

    if (isResult && !isVxUser) {
      return json({ error: "Only VX users can upload result files" }, 403)
    }

    if (!isResult && !isVxUser && !isClientProjetista) {
      return json({ error: "Only the project client or VX users can upload source files" }, 403)
    }

    const ext = fileName.split(".").pop()?.toLowerCase()
    const allowed = ["apk", "step", "pdf", "jpg", "jpeg", "png", "zip", "rar", "7z", "tar", "gz"]
    if (!ext || !allowed.includes(ext)) {
      return json({ error: `Invalid file extension. Allowed: ${allowed.join(", ")}` }, 400)
    }

    const uuid = crypto.randomUUID()
    const objectType = isResult ? "result" : "source"
    const objectKey = `vx-projects/${clientId}/${projectId}/${objectType}-${uuid}.${ext}`
    const uploadUrl = await createR2SignedUrl("PUT", objectKey)

    return json({
      uploadUrl,
      objectKey,
      fileUrl: `${R2_FILE_PREFIX}${objectKey}`,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500)
  }
})
