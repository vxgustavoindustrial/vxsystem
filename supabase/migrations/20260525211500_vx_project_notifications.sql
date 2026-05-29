set lock_timeout = '10s';
set statement_timeout = '120s';

create or replace function public.notify_vx_project_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_status_label text;
begin
  select name into v_client_name from public.clients where id = new.client_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, client_id, type, title, body, link)
    select profile.id, new.client_id, 'task', 'Novo projeto VX recebido',
           coalesce(v_client_name, 'Cliente') || ' enviou o projeto ' || new.title || '.',
           '/agency/uploads'
      from public.profiles profile
     where profile.role in ('admin', 'member')
       and profile.is_active = true;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.estimated_delivery is distinct from old.estimated_delivery then
    v_status_label := case new.status
      when 'analysis' then 'Em analise'
      when 'processing' then 'Em processamento'
      when 'completed' then 'Finalizado'
      else new.status
    end;

    insert into public.notifications (user_id, client_id, type, title, body, link)
    select profile.id, new.client_id, 'task', 'Atualizacao do projeto VX',
           new.title || ': ' || v_status_label ||
             case when new.estimated_delivery is not null
               then ' - previsao ' || to_char(new.estimated_delivery, 'DD/MM/YYYY')
               else ''
             end || '.',
           case when new.status = 'completed' then '/client/library' else '/client/processing' end
      from public.profiles profile
     where profile.client_id = new.client_id
       and profile.role = 'client'
       and profile.is_active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_vx_project_events on public.vx_projects;
create trigger notify_vx_project_events
after insert or update of status, estimated_delivery on public.vx_projects
for each row execute function public.notify_vx_project_events();

revoke all on function public.notify_vx_project_events() from public, anon, authenticated;
