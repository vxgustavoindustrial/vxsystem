set lock_timeout = '10s';
set statement_timeout = '120s';

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists documents_storage_admin_all on storage.objects;
create policy documents_storage_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

drop policy if exists documents_storage_client_select on storage.objects;
create policy documents_storage_client_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      exists (
        select 1 from public.documents document
        where document.client_id = public.auth_client_id()
          and (document.file_url = name or document.file_url like ('%/' || name))
      )
      or exists (
        select 1 from public.financial_invoices invoice
        where invoice.client_id = public.auth_client_id()
          and (invoice.file_url = name or invoice.file_url like ('%/' || name))
      )
    )
  );
