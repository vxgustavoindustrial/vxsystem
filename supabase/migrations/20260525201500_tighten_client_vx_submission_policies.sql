set lock_timeout = '10s';
set statement_timeout = '120s';

drop policy if exists vx_projects_client_insert on public.vx_projects;
create policy vx_projects_client_insert on public.vx_projects
  for insert to authenticated
  with check (
    client_id = public.auth_client_id()
    and status = 'analysis'
    and estimated_delivery is null
    and technical_notes is null
  );

drop policy if exists vx_files_client_insert on public.vx_project_files;
create policy vx_files_client_insert on public.vx_project_files
  for insert to authenticated
  with check (
    not is_result
    and exists (
      select 1
        from public.vx_projects project
       where project.id = project_id
         and project.client_id = public.auth_client_id()
    )
  );

drop policy if exists vx_files_client_select on public.vx_project_files;
create policy vx_files_client_select on public.vx_project_files
  for select to authenticated
  using (
    exists (
      select 1
        from public.vx_projects project
       where project.id = project_id
         and project.client_id = public.auth_client_id()
         and (not is_result or project.status = 'completed')
    )
  );

drop policy if exists tickets_client_update on public.support_tickets;
