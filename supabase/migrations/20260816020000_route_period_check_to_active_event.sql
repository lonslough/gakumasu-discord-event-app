create or replace function public.is_submission_period_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_submission_period_open(null::uuid)
$$;

revoke all on function public.is_submission_period_open() from public;
grant execute on function public.is_submission_period_open()
to authenticated, service_role;
