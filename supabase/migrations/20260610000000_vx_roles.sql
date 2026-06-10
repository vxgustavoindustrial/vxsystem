-- Migration: VX Agency Roles (Admin / Programador / Financeiro)
-- Adiciona suporte a níveis de acesso interno da equipe VX:
--   Admin       - Acesso total (remover contratos, boletos, etc.)
--   Programador - Acesso às empresas, upload APK
--   Financeiro  - Upload de boletos e contratos (sem download)

set lock_timeout = '10s';
set statement_timeout = '120s';

-- =============================================================
-- 1. ADD vx_role COLUMN TO profiles
-- =============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'vx_role'
  ) then
    alter table public.profiles
      add column vx_role text check (vx_role in ('admin', 'programador', 'financeiro'));
  end if;
end $$;

-- =============================================================
-- 2. HELPER: auth_vx_role()
-- Retorna o vx_role do usuário autenticado (ou null se não tiver)
-- =============================================================
create or replace function public.auth_vx_role()
returns text
language sql
stable
set search_path = public
as $$
  select vx_role from public.profiles where id = auth.uid();
$$;

-- =============================================================
-- 3. HELPER: auth_is_vx_admin()
-- =============================================================
create or replace function public.auth_is_vx_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.auth_role() in ('admin', 'member') and public.auth_vx_role() = 'admin';
$$;

-- =============================================================
-- 4. HELPER: auth_is_vx_programador()
-- =============================================================
create or replace function public.auth_is_vx_programador()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.auth_role() in ('admin', 'member') and public.auth_vx_role() = 'programador';
$$;

-- =============================================================
-- 5. HELPER: auth_is_vx_financeiro()
-- =============================================================
create or replace function public.auth_is_vx_financeiro()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.auth_role() in ('admin', 'member') and public.auth_vx_role() = 'financeiro';
$$;

-- =============================================================
-- 6. GRANTS
-- =============================================================
grant execute on function public.auth_vx_role() to authenticated;
grant execute on function public.auth_is_vx_admin() to authenticated;
grant execute on function public.auth_is_vx_programador() to authenticated;
grant execute on function public.auth_is_vx_financeiro() to authenticated;
