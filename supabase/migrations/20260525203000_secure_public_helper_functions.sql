set lock_timeout = '10s';
set statement_timeout = '120s';

alter function public.auth_role() set search_path = public;
alter function public.auth_client_id() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.auth_role() from anon;
revoke execute on function public.auth_client_id() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.handle_updated_at() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke execute on function public.report_my_invoice_payment(uuid) from anon;
revoke execute on function public.submit_my_invoice_feedback(uuid, text, text) from anon;
revoke execute on function public.complete_my_flow_step(uuid, uuid, integer) from anon;
revoke execute on function public.complete_my_onboarding(uuid) from anon;
