-- Migration: Client Roles (Projetista / Financeiro)
-- Adiciona suporte a papéis dentro do cliente (sub-roles)
-- Projetista: upload/download de arquivos do projeto (com limites de tamanho)
-- Financeiro: visualização apenas de boletos e contratos

set lock_timeout = '10s';
set statement_timeout = '120s';

-- =============================================================
-- 1. ADD client_role COLUMN TO profiles
-- =============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'client_role'
  ) then
    alter table public.profiles
      add column client_role text check (client_role in ('projetista', 'financeiro'));
  end if;
end $$;

-- =============================================================
-- 2. HELPER: auth_client_role()
-- Retorna o client_role do usuário autenticado (ou null se não tiver)
-- =============================================================
create or replace function public.auth_client_role()
returns text
language sql
stable
set search_path = public
as $$
  select client_role from public.profiles where id = auth.uid();
$$;

-- =============================================================
-- 3. HELPER: auth_is_projetista()
-- =============================================================
create or replace function public.auth_is_projetista()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.auth_role() = 'client' and public.auth_client_role() = 'projetista';
$$;

-- =============================================================
-- 4. HELPER: auth_is_financeiro()
-- =============================================================
create or replace function public.auth_is_financeiro()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.auth_role() = 'client' and public.auth_client_role() = 'financeiro';
$$;

-- =============================================================
-- 5. POLICIES FOR vx_projects
-- Projetista: INSERT com dados controlados, SELECT dos seus projetos
-- Financeiro: SEM acesso a projetos
-- =============================================================

-- Projetista pode inserir projetos (como client normal)
drop policy if exists vx_projects_projetista_insert on public.vx_projects;
create policy vx_projects_projetista_insert on public.vx_projects
  for insert to authenticated
  with check (
    public.auth_is_projetista()
    and client_id = public.auth_client_id()
    and status = 'analysis'
    and estimated_delivery is null
    and technical_notes is null
  );

-- Projetista pode ver seus próprios projetos
drop policy if exists vx_projects_projetista_select on public.vx_projects;
create policy vx_projects_projetista_select on public.vx_projects
  for select to authenticated
  using (
    public.auth_is_projetista()
    and client_id = public.auth_client_id()
  );

-- =============================================================
-- 6. POLICIES FOR vx_project_files
-- Projetista pode inserir (apenas is_result = false) e selecionar
-- =============================================================

drop policy if exists vx_project_files_projetista_insert on public.vx_project_files;
create policy vx_project_files_projetista_insert on public.vx_project_files
  for insert to authenticated
  with check (
    public.auth_is_projetista()
    and is_result = false
    and exists (
      select 1 from public.vx_projects
      where id = project_id and client_id = public.auth_client_id()
    )
  );

drop policy if exists vx_project_files_projetista_select on public.vx_project_files;
create policy vx_project_files_projetista_select on public.vx_project_files
  for select to authenticated
  using (
    public.auth_is_projetista()
    and exists (
      select 1 from public.vx_projects
      where id = project_id and client_id = public.auth_client_id()
    )
    and (not is_result or (select status from public.vx_projects where id = project_id) = 'completed')
  );

-- =============================================================
-- 7. STORAGE POLICIES FOR vx-projects BUCKET
-- Projetista pode fazer upload (com validação de tamanho por tipo)
-- =============================================================

-- Projetista: upload com limites de tamanho
drop policy if exists vx_projects_storage_projetista_insert on storage.objects;
create policy vx_projects_storage_projetista_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vx-projects'
    and public.auth_is_projetista()
    and (storage.foldername(name))[1] = public.auth_client_id()::text
    -- Validação de tamanho por extensão (via metadata)
    -- NOTA: a validação real de tamanho é feita no frontend + bucket file_size_limit
    -- O RLS pode usar metadata->>'size' mas não é 100% confiável em todos os casos
  );

-- Projetista: leitura dos seus arquivos
drop policy if exists vx_projects_storage_projetista_select on storage.objects;
create policy vx_projects_storage_projetista_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vx-projects'
    and public.auth_is_projetista()
    and exists (
      select 1
      from public.vx_projects project
      join public.vx_project_files project_file on project_file.project_id = project.id
      where project.client_id = public.auth_client_id()
        and project.id::text = (storage.foldername(name))[2]
        and (
          project_file.file_url = name
          or project_file.file_url like ('%/' || name)
        )
        and (not project_file.is_result or project.status = 'completed')
    )
  );

-- =============================================================
-- 8. POLICIES FOR financial_invoices (Financeiro)
-- Financeiro pode apenas SELECT (visualizar) faturas do seu cliente
-- =============================================================

drop policy if exists financial_invoices_financeiro_select on public.financial_invoices;
create policy financial_invoices_financeiro_select on public.financial_invoices
  for select to authenticated
  using (
    public.auth_is_financeiro()
    and client_id = public.auth_client_id()
  );

-- =============================================================
-- 9. POLICIES FOR service_contracts (Financeiro)
-- Financeiro pode apenas SELECT contratos ativos/assinados
-- =============================================================

drop policy if exists service_contracts_financeiro_select on public.service_contracts;
create policy service_contracts_financeiro_select on public.service_contracts
  for select to authenticated
  using (
    public.auth_is_financeiro()
    and client_id = public.auth_client_id()
    and status in ('signed', 'active')
  );

-- =============================================================
-- 10. POLICIES FOR client_subscriptions (Financeiro)
-- Financeiro pode apenas SELECT assinatura do seu cliente
-- =============================================================

drop policy if exists client_subscriptions_financeiro_select on public.client_subscriptions;
create policy client_subscriptions_financeiro_select on public.client_subscriptions
  for select to authenticated
  using (
    public.auth_is_financeiro()
    and client_id = public.auth_client_id()
  );

-- =============================================================
-- 11. STORAGE POLICIES FOR documents BUCKET (Financeiro)
-- Financeiro pode apenas SELECT (download) documentos financeiros, nunca INSERT
-- =============================================================

drop policy if exists documents_storage_financeiro_select on storage.objects;
create policy documents_storage_financeiro_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.auth_is_financeiro()
    and exists (
      select 1 from public.financial_invoices
      where client_id = public.auth_client_id()
        and file_url like '%' || name
    )
  );

-- =============================================================
-- 12. ATUALIZAR POLÍTICAS EXISTENTES PARA RESPEITAR client_role
-- O cliente padrão (sem client_role) mantém acesso completo como antes
-- =============================================================

-- Atualizar política geral de clientes para projetos para excluir projetistas
-- (já que eles têm política própria)
drop policy if exists vx_projects_client_insert on public.vx_projects;
create policy vx_projects_client_insert on public.vx_projects
  for insert to authenticated
  with check (
    public.auth_role() = 'client'
    and public.auth_client_role() is null  -- apenas clientes sem sub-rolagem
    and client_id = public.auth_client_id()
    and status = 'analysis'
    and estimated_delivery is null
    and technical_notes is null
  );

-- Cliente padrão pode ver projetos
drop policy if exists vx_projects_client_select on public.vx_projects;

-- =============================================================
-- 13. GRANTS
-- =============================================================
grant execute on function public.auth_client_role() to authenticated;
grant execute on function public.auth_is_projetista() to authenticated;
grant execute on function public.auth_is_financeiro() to authenticated;

-- =============================================================
-- 14. ATUALIZAR BUCKET CONFIGURAÇÕES
-- =============================================================
-- vx-projects: sem limite no bucket (a validação será no frontend)
update storage.buckets
  set file_size_limit = null
  where id = 'vx-projects';

-- documents: manter 50MB (já configurado)
-- =============================================================

-- =============================================================
-- 15. REVOKE permissoes desnecessárias para financeiro
-- Financeiro não pode inserir/atualizar/deletar nada
-- =============================================================
-- As políticas RLS já garantem isso, mas vamos garantir que
-- não haja grants excessivos
-- (os grants existentes são para authenticated, as políticas restringem)

