alter table public.event_settings
  add column submission_start_at timestamptz null,
  add column submission_end_at timestamptz null;

alter table public.event_settings
  add constraint valid_submission_period check (
    submission_start_at is null
    or submission_end_at is null
    or submission_start_at < submission_end_at
  );

create or replace function public.is_submission_period_open()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select
      (submission_start_at is null or now() >= submission_start_at)
      and (submission_end_at is null or now() <= submission_end_at)
    from public.event_settings
    where id = true
  ), true)
$$;

create or replace function public.get_event_settings()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rules_description', rules_description,
    'submission_start_at', submission_start_at,
    'submission_end_at', submission_end_at,
    'server_now', now(),
    'accepting_submissions', public.is_submission_period_open()
  )
  from public.event_settings
  where id = true
$$;

create or replace function public.reject_submission_outside_period()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_submission_period_open() then
    raise exception 'submission period is closed'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger reject_submission_outside_period
before insert or update on public.submissions
for each row execute function public.reject_submission_outside_period();

drop policy if exists "storage upload own" on storage.objects;
create policy "storage upload own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-images'
  and public.is_submission_period_open()
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in (
    'score',
    'deck',
    'beginner-proof',
    'login-days-proof'
  )
);

revoke all on function public.is_submission_period_open(),
  public.get_event_settings(), public.reject_submission_outside_period()
from public;
grant execute on function public.is_submission_period_open(),
  public.get_event_settings() to authenticated, service_role;

comment on function public.reject_submission_outside_period() is
  'Reject participant submission inserts and updates outside the configured period.';
