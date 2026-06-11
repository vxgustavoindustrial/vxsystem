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

function getObjectKey(fileUrl: string) {
  if (fileUrl.startsWith(R2_FILE_PREFIX)) return fileUrl.slice(R2_FILE_PREFIX.length)
  if (fileUrl.startsWith("vx-projects/")) return fileUrl

  try {
    const url = new URL(fileUrl)
    const marker = `/${R2_BUCKET_NAME}/`
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex === -1) return null
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401)

    const sessionClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser()

    if (authError || !user) return json({ error: "Unauthorized" }, 401)

    const { fileUrl } = await req.json()
    if (!fileUrl || typeof fileUrl !== "string") return json({ error: "Missing fileUrl" }, 400)

    const objectKey = getObjectKey(fileUrl)
    if (!objectKey) return json({ error: "Invalid R2 file URL" }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const { data: profile } = await admin
      .from("profiles")
      .select("role, client_id, client_role, vx_role, is_active")
      .eq("id", user.id)
      .single()

    if (!profile?.is_active) return json({ error: "Forbidden" }, 403)

    const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}`
    const candidates = Array.from(new Set([fileUrl, `${R2_FILE_PREFIX}${objectKey}`, objectKey, objectUrl]))

    const { data: file } = await admin
      .from("vx_project_files")
      .select("id, file_url, project_id, vx_projects ( client_id )")
      .in("file_url", candidates)
      .maybeSingle()

    if (!file) return json({ error: "File not found" }, 404)

    const project = Array.isArray(file.vx_projects) ? file.vx_projects[0] : file.vx_projects
    const projectClientId = project?.client_id
    const isVxUser = profile.role === "admin" || profile.vx_role === "programador" || profile.vx_role === "admin"
    const isProjectClient = profile.role === "client" && profile.client_id === projectClientId && profile.client_role === "projetista"

    if (!isVxUser && !isProjectClient) return json({ error: "Forbidden" }, 403)

    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
    })

    const signedRequest = await aws.sign(
      new Request(objectUrl, { method: "GET" }),
      { aws: { signQuery: true } },
    )

    return json({ downloadUrl: signedRequest.url })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500)
  }
})
