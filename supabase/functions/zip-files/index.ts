import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "vx-deliveries";
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_FILE_PREFIX = "r2://";

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

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectKey(key: string) {
  return key.split("/").map(awsEncode).join("/");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(hash));
}

async function hmac(key: Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(value));
  return new Uint8Array(signature);
}

async function getSigningKey(secret: string, dateStamp: string) {
  const kDate = await hmac(textEncoder.encode(`AWS4${secret}`), dateStamp);
  const kRegion = await hmac(kDate, "auto");
  const kService = await hmac(kRegion, "s3");
  return await hmac(kService, "aws4_request");
}

async function createR2SignedUrl(method: "GET" | "PUT", objectKey: string) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${R2_BUCKET_NAME}/${encodeObjectKey(objectKey)}`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY_ID}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(60 * 60 * 6),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSigningKey(R2_SECRET_ACCESS_KEY, dateStamp);
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `${R2_ENDPOINT}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function getR2ObjectKey(fileUrl: string) {
  if (fileUrl.startsWith(R2_FILE_PREFIX)) return fileUrl.slice(R2_FILE_PREFIX.length);
  return null;
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
      const r2ObjectKey = getR2ObjectKey(file.path);
      if (r2ObjectKey) {
        const signedUrl = await createR2SignedUrl("GET", r2ObjectKey);
        signedUrls.push({ name: file.name, url: signedUrl });
        continue;
      }

      if (/^https?:\/\//i.test(file.path)) {
        signedUrls.push({ name: file.name, url: file.path });
        continue;
      }

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
