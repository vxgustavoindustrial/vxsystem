set lock_timeout = '10s';
set statement_timeout = '120s';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Commercial pipeline managed by agency users.
create table if not exists public.sales_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  company_name text not null,
  contact_name text not null,
  email text,
  phone text,
  source text not null default 'other'
    check (source in ('site', 'instagram', 'linkedin', 'folder', 'business_card', 'whatsapp', 'email', 'other')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'proposal', 'converted', 'lost')),
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_visits (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.sales_contacts(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  scheduled_at timestamptz not null,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  objective text,
  outcome text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_proposals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.sales_contacts(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text,
  amount numeric(12, 2),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until date,
  document_url text,
  accepted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  proposal_id uuid references public.sales_proposals(id) on delete set null,
  contract_type text not null default 'service'
    check (contract_type in ('service', 'nda', 'platform')),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'signed', 'active', 'expired', 'terminated')),
  title text not null,
  document_url text,
  starts_on date,
  ends_on date,
  signed_at timestamptz,
  terms jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_name text not null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'past_due', 'suspended', 'cancelled')),
  monthly_amount numeric(12, 2) not null default 0 check (monthly_amount >= 0),
  support_level text not null default 'standard'
    check (support_level in ('standard', 'priority', 'dedicated')),
  platform_seats integer not null default 1 check (platform_seats > 0),
  starts_on date not null default current_date,
  renews_on_day integer check (renews_on_day between 1 and 28),
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index if not exists client_subscriptions_one_active_per_client
  on public.client_subscriptions(client_id)
  where status in ('active', 'past_due', 'suspended');
create index if not exists sales_contacts_status_idx on public.sales_contacts(status, created_at desc);
create index if not exists sales_visits_schedule_idx on public.sales_visits(scheduled_at, status);
create index if not exists sales_proposals_client_idx on public.sales_proposals(client_id, status);
create index if not exists service_contracts_client_idx on public.service_contracts(client_id, contract_type, status);
create index if not exists vx_projects_client_status_idx on public.vx_projects(client_id, status, created_at desc);
create index if not exists vx_project_files_project_result_idx on public.vx_project_files(project_id, is_result);

drop trigger if exists set_sales_contacts_updated_at on public.sales_contacts;
create trigger set_sales_contacts_updated_at before update on public.sales_contacts
  for each row execute function public.set_updated_at();
drop trigger if exists set_sales_visits_updated_at on public.sales_visits;
create trigger set_sales_visits_updated_at before update on public.sales_visits
  for each row execute function public.set_updated_at();
drop trigger if exists set_sales_proposals_updated_at on public.sales_proposals;
create trigger set_sales_proposals_updated_at before update on public.sales_proposals
  for each row execute function public.set_updated_at();
drop trigger if exists set_service_contracts_updated_at on public.service_contracts;
create trigger set_service_contracts_updated_at before update on public.service_contracts
  for each row execute function public.set_updated_at();
drop trigger if exists set_client_subscriptions_updated_at on public.client_subscriptions;
create trigger set_client_subscriptions_updated_at before update on public.client_subscriptions
  for each row execute function public.set_updated_at();

alter table public.sales_contacts enable row level security;
alter table public.sales_visits enable row level security;
alter table public.sales_proposals enable row level security;
alter table public.service_contracts enable row level security;
alter table public.client_subscriptions enable row level security;

drop policy if exists sales_contacts_admin_all on public.sales_contacts;
create policy sales_contacts_admin_all on public.sales_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sales_visits_admin_all on public.sales_visits;
create policy sales_visits_admin_all on public.sales_visits
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sales_proposals_admin_all on public.sales_proposals;
create policy sales_proposals_admin_all on public.sales_proposals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists service_contracts_admin_all on public.service_contracts;
create policy service_contracts_admin_all on public.service_contracts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists client_subscriptions_admin_all on public.client_subscriptions;
create policy client_subscriptions_admin_all on public.client_subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Clients may view their signed contract and current subscription, but cannot edit them.
drop policy if exists service_contracts_client_select on public.service_contracts;
create policy service_contracts_client_select on public.service_contracts
  for select to authenticated using (client_id = public.auth_client_id() and status in ('signed', 'active'));
drop policy if exists client_subscriptions_client_select on public.client_subscriptions;
create policy client_subscriptions_client_select on public.client_subscriptions
  for select to authenticated using (client_id = public.auth_client_id());

grant select, insert, update, delete on public.sales_contacts to authenticated;
grant select, insert, update, delete on public.sales_visits to authenticated;
grant select, insert, update, delete on public.sales_proposals to authenticated;
grant select, insert, update, delete on public.service_contracts to authenticated;
grant select, insert, update, delete on public.client_subscriptions to authenticated;

-- Relational integrity for existing operational admin records.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_credentials_client_id_fkey') then
    alter table public.client_credentials
      add constraint client_credentials_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_client_id_fkey') then
    alter table public.documents
      add constraint documents_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'financial_invoices_client_id_fkey') then
    alter table public.financial_invoices
      add constraint financial_invoices_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
  end if;
end
$$;

-- Remove broad client-side mutations of privileged fields.
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists clients_self_update on public.clients;
drop policy if exists credentials_client_select on public.client_credentials;
drop policy if exists invoices_client_update on public.financial_invoices;
drop policy if exists vx_projects_client_update on public.vx_projects;

create or replace function public.report_my_invoice_payment(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.financial_invoices
     set status = 'payment_reported', updated_at = now()
   where id = p_invoice_id
     and client_id = public.auth_client_id()
     and status not in ('paid', 'cancelled');

  if not found then
    raise exception 'Invoice is not available for payment reporting.';
  end if;
end;
$$;

create or replace function public.submit_my_invoice_feedback(
  p_invoice_id uuid,
  p_client_notes text default null,
  p_dispute_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.financial_invoices
     set client_notes = case when p_client_notes is null then client_notes else p_client_notes end,
         dispute_message = case when p_dispute_message is null then dispute_message else p_dispute_message end,
         dispute_at = case when p_dispute_message is null then dispute_at else now() end,
         status = case when p_dispute_message is null then status else 'disputed' end,
         updated_at = now()
   where id = p_invoice_id
     and client_id = public.auth_client_id();

  if not found then
    raise exception 'Invoice is not available for feedback.';
  end if;
end;
$$;

create or replace function public.complete_my_flow_step(
  p_client_id uuid,
  p_flow_id uuid,
  p_step_number integer
)
returns public.flow_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.flow_progress;
begin
  if not public.is_admin() and p_client_id <> public.auth_client_id() then
    raise exception 'Client not authorized for this progress.';
  end if;

  update public.flow_progress
     set completed_steps = (
           select array_agg(distinct step order by step)
             from unnest(completed_steps || p_step_number) as step
         ),
         current_step = greatest(current_step, p_step_number + 1),
         updated_at = now()
   where client_id = p_client_id
     and flow_id = p_flow_id
  returning * into v_progress;

  if v_progress.id is null then
    raise exception 'Flow progress was not found.';
  end if;

  return v_progress;
end;
$$;

create or replace function public.complete_my_onboarding(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and p_client_id <> public.auth_client_id() then
    raise exception 'Client not authorized for this onboarding.';
  end if;

  update public.clients
     set onboarding_completed = true, status = 'active', updated_at = now()
   where id = p_client_id;

  if not found then
    raise exception 'Client was not found.';
  end if;
end;
$$;

revoke all on function public.report_my_invoice_payment(uuid) from public;
revoke all on function public.submit_my_invoice_feedback(uuid, text, text) from public;
revoke all on function public.complete_my_flow_step(uuid, uuid, integer) from public;
revoke all on function public.complete_my_onboarding(uuid) from public;
grant execute on function public.report_my_invoice_payment(uuid) to authenticated;
grant execute on function public.submit_my_invoice_feedback(uuid, text, text) to authenticated;
grant execute on function public.complete_my_flow_step(uuid, uuid, integer) to authenticated;
grant execute on function public.complete_my_onboarding(uuid) to authenticated;

-- Industrial project files must be private and scoped to the linked client project.
update storage.buckets set public = false where id = 'vx-projects';
drop policy if exists "Allow authenticated delete access for vx-projects" on storage.objects;
drop policy if exists "Allow authenticated upload access for vx-projects" on storage.objects;
drop policy if exists "Allow public read access for vx-projects" on storage.objects;
drop policy if exists vx_projects_storage_admin_all on storage.objects;
create policy vx_projects_storage_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'vx-projects' and public.is_admin())
  with check (bucket_id = 'vx-projects' and public.is_admin());
drop policy if exists vx_projects_storage_client_insert on storage.objects;
create policy vx_projects_storage_client_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vx-projects'
    and (storage.foldername(name))[1] = public.auth_client_id()::text
  );
drop policy if exists vx_projects_storage_client_select on storage.objects;
create policy vx_projects_storage_client_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vx-projects'
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
