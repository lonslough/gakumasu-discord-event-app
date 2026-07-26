create table public.event_settings (
  id boolean primary key default true check (id),
  rules_description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id)
);

insert into public.event_settings (id, rules_description)
values (true, '')
on conflict (id) do nothing;

create trigger event_settings_updated_at
before update on public.event_settings
for each row execute function public.set_updated_at();

alter table public.event_settings enable row level security;

create policy "event settings authenticated read"
on public.event_settings for select to authenticated
using (true);

create policy "event settings admin update"
on public.event_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.event_settings from anon;
grant select, update on public.event_settings to authenticated;
