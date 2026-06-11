import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

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
      return new Response("Forbidden", { status: 403 })
    }

    const { projectId, clientId, objectKey, fileSize, fileName } = await req.json()

    if (!projectId || !clientId || !objectKey || !fileName) {
      return new Response("Missing required fields", { status: 400 })
    }

    const { error: insertError } = await supabase.from("vx_project_files").insert({
      project_id: projectId,
      client_id: clientId,
      file_name: fileName,
      file_size: fileSize || 0,
      file_url: objectKey,
      is_result: true,
      uploaded_by: user.id,
    })

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Failed to save file record: ${insertError.message}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      )
    }

    const { error: updateError } = await supabase
      .from("vx_projects")
      .update({ status: "completed" })
      .eq("id", projectId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Project updated but failed to change status: ${updateError.message}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
