import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization) return json({ error: "Sessao obrigatoria." }, 401);

    const sessionClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authorization } },
    });
    const { data: identity, error: identityError } = await sessionClient.auth.getUser();
    if (identityError || !identity.user) return json({ error: "Sessao invalida." }, 401);

    const admin = createClient(url, serviceRoleKey);
    const { data: actor } = await admin.from("profiles").select("role, vx_role, is_active").eq("id", identity.user.id).maybeSingle();
    if (!actor?.is_active) return json({ error: "Acesso negado." }, 403);
    if (actor.role !== "admin" && actor.vx_role !== "programador") {
      return json({ error: "Somente administradores ou programadores podem baixar arquivos." }, 403);
    }

    const body = (await request.json()) as { bucket: string; files: { name: string; path: string }[] };
    if (!body.bucket || !body.files?.length) {
      return json({ error: "Informe bucket e lista de arquivos." }, 400);
    }

    const zip = new JSZip();
    const signedUrls: { name: string; url: string }[] = [];

    for (const file of body.files) {
      const { data: signedData, error: signedError } = await admin.storage
        .from(body.bucket)
        .createSignedUrl(file.path, 60);
      if (signedError || !signedData) {
        console.error(`Erro ao criar URL para ${file.path}:`, signedError);
        continue;
      }
      signedUrls.push({ name: file.name, url: signedData.signedUrl });
    }

    if (signedUrls.length === 0) {
      return json({ error: "Nenhum arquivo pode ser baixado." }, 500);
    }

    for (const item of signedUrls) {
      const response = await fetch(item.url);
      if (!response.ok) continue;
      const blob = await response.blob();
      zip.file(item.name, blob);
    }

    if (!Object.keys(zip.files).length) {
      return json({ error: "Nenhum arquivo pode ser lido no storage." }, 500);
    }

    const zipBlob = await zip.generateAsync({ type: "uint8array" });
    const zipName = `vx_project_files_${Date.now()}.zip`;

    return new Response(zipBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Content-Length": zipBlob.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("zip-files error:", err);
    return json({ error: "Falha ao gerar zip." }, 500);
  }
});
