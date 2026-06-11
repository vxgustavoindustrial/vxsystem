import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18"

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
    const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}`

    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    })

    const signedRequest = await aws.sign(
      new Request(objectUrl, { method: "PUT" }),
      { aws: { signQuery: true } },
    )

    return json({
      uploadUrl: signedRequest.url,
      objectKey,
      fileUrl: `${R2_FILE_PREFIX}${objectKey}`,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500)
  }
})
