set lock_timeout = '10s';
set statement_timeout = '120s';

alter function public.rls_auto_enable() set search_path = public;

revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.auth_client_id() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_client_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.report_my_invoice_payment(uuid) from public, anon;
revoke execute on function public.submit_my_invoice_feedback(uuid, text, text) from public, anon;
revoke execute on function public.complete_my_flow_step(uuid, uuid, integer) from public, anon;
revoke execute on function public.complete_my_onboarding(uuid) from public, anon;
grant execute on function public.report_my_invoice_payment(uuid) to authenticated;
grant execute on function public.submit_my_invoice_feedback(uuid, text, text) to authenticated;
grant execute on function public.complete_my_flow_step(uuid, uuid, integer) to authenticated;
grant execute on function public.complete_my_onboarding(uuid) to authenticated;
