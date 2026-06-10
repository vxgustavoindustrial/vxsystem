import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "member";
  vxRole?: string | null;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization) return json({ error: "Sessao obrigatoria." }, 401);

    const sessionClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: identity, error: identityError } = await sessionClient.auth.getUser();
    if (identityError || !identity.user) return json({ error: "Sessao invalida." }, 401);

    const admin = createClient(url, serviceRoleKey);
    const { data: actor } = await admin.from("profiles").select("role, is_active").eq("id", identity.user.id).maybeSingle();
    if (!actor?.is_active || actor.role !== "admin") {
      return json({ error: "Somente administradores podem criar membros." }, 403);
    }

    const body = (await request.json()) as RequestBody;
    if (!body.email || !body.password || !body.fullName || body.password.length < 10) {
      return json({ error: "Informe nome, e-mail e senha segura com ao menos 10 caracteres." }, 400);
    }
    if (!["admin", "member"].includes(body.role)) {
      return json({ error: "Cargo invalido. Use admin ou member." }, 400);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.fullName.trim() },
    });
    if (createError || !created.user) return json({ error: createError?.message || "Erro ao criar usuario." }, 400);

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id,
      full_name: body.fullName.trim(),
      email: body.email.trim().toLowerCase(),
      role: body.role,
      vx_role: body.vxRole || null,
      is_active: true,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "Nao foi possivel criar o perfil do membro." }, 500);
    }

    return json({ success: true, userId: created.user.id }, 201);
  } catch {
    return json({ error: "Falha inesperada ao criar membro." }, 500);
  }
});
