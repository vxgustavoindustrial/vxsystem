import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || ""
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || ""
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "vx-deliveries"
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || ""

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response("Missing Authorization header", { status: 401 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vx_role")
      .eq("id", user.id)
      .single()

    const isProgramador = profile?.vx_role === "programador" || profile?.vx_role === "admin"

    if (!isProgramador) {
      return new Response("Forbidden: only programador or admin can upload results", { status: 403 })
    }

    const { clientId, projectId, fileName } = await req.json()

    if (!clientId || !projectId || !fileName) {
      return new Response("Missing required fields: clientId, projectId, fileName", { status: 400 })
    }

    const ext = fileName.split(".").pop()?.toLowerCase()
    const allowed = ["apk", "zip", "rar", "7z", "tar", "gz"]
    if (!ext || !allowed.includes(ext)) {
      return new Response(`Invalid file extension. Allowed: ${allowed.join(", ")}`, { status: 400 })
    }

    const uuid = crypto.randomUUID()
    const objectKey = `vx-projects/${clientId}/${projectId}/result-${uuid}.${ext}`
    const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${objectKey}`

    const aws = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
    })

    const signedRequest = await aws.sign(
      new Request(objectUrl, { method: "PUT" }),
      { aws: { signQuery: true } },
    )

    return new Response(
      JSON.stringify({
        uploadUrl: signedRequest.url,
        objectKey,
        publicUrl: objectUrl,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    )
  }
})
