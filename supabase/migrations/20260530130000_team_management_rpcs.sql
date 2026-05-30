-- Habilitar RLS na tabela profiles
alter table public.profiles enable row level security;

-- Remover políticas existentes para evitar conflitos
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

-- Política para permitir leitura de perfis por qualquer usuário autenticado
create policy profiles_select_all on public.profiles
  for select to authenticated using (true);

-- Política para permitir que administradores realizem qualquer operação na tabela profiles
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- RPC para excluir membro da equipe (auth.users + public.profiles)
create or replace function public.delete_team_member(member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Verificar se quem está chamando é um administrador ou membro
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'member')
  ) then
    raise exception 'Apenas administradores e membros da equipe podem excluir usuários.';
  end if;

  -- Impedir que o usuário exclua a si mesmo
  if member_id = auth.uid() then
    raise exception 'Você não pode excluir a sua própria conta.';
  end if;

  -- Deletar da tabela auth.users (o cascade cuidará de public.profiles)
  delete from auth.users where id = member_id;
end;
$$;

-- RPC para editar membro da equipe (auth.users + public.profiles)
create or replace function public.update_team_member(
  member_id uuid,
  new_name text,
  new_email text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Verificar se quem está chamando é um administrador ou membro
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'member')
  ) then
    raise exception 'Apenas administradores e membros da equipe podem atualizar usuários.';
  end if;

  -- Atualizar auth.users (email e metadados)
  update auth.users
     set email = new_email,
         raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', new_name)
   where id = member_id;

  -- Atualizar public.profiles
  update public.profiles
     set full_name = new_name,
         email = new_email
   where id = member_id;
end;
$$;

-- Garantir permissões de execução para usuários autenticados
grant execute on function public.delete_team_member(uuid) to authenticated;
grant execute on function public.update_team_member(uuid, text, text) to authenticated;
