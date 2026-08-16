create table public.event_editions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  rules_description text not null default '' check (char_length(rules_description) <= 10000),
  submission_start_at timestamptz null,
  submission_end_at timestamptz null,
  character_options jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id),
  constraint valid_event_period check (
    submission_start_at is null or submission_end_at is null
    or submission_start_at < submission_end_at
  )
);

create unique index event_editions_one_active
on public.event_editions (is_active) where is_active;

insert into public.event_editions (
  name, rules_description, submission_start_at, submission_end_at,
  character_options, is_active, updated_by
)
select '第1回', rules_description, submission_start_at, submission_end_at,
  character_options, true, updated_by
from public.event_settings where id = true;

create trigger event_editions_updated_at
before update on public.event_editions
for each row execute function public.set_updated_at();

create trigger validate_event_edition_characters
before insert or update of character_options on public.event_editions
for each row execute function public.validate_event_characters();

alter table public.event_editions enable row level security;
create policy "event editions authenticated read"
on public.event_editions for select to authenticated using (true);
create policy "event editions admin insert"
on public.event_editions for insert to authenticated with check (public.is_admin());
create policy "event editions admin update"
on public.event_editions for update to authenticated
using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.event_editions to authenticated;
revoke all on public.event_editions from anon;

alter table public.submissions add column event_id uuid null
  references public.event_editions(id);
update public.submissions set event_id = (
  select id from public.event_editions where is_active
);
alter table public.submissions alter column event_id set not null;
alter table public.submissions drop constraint if exists submissions_user_id_key;
alter table public.submissions
  add constraint submissions_event_user_key unique (event_id, user_id);

drop trigger if exists validate_submission_character on public.submissions;
create or replace function public.validate_submission_character()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.category = old.category then return new; end if;
  if not exists (
    select 1 from public.event_editions event,
      jsonb_array_elements(event.character_options) option
    where event.id = new.event_id and option->>'id' = new.category
  ) then
    raise exception 'selected character is not configured for this event'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_submission_character
before insert or update of category, event_id on public.submissions
for each row execute function public.validate_submission_character();

create or replace function public.is_submission_period_open(
  p_event_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select
    event.is_active
    and (event.submission_start_at is null or now() >= event.submission_start_at)
    and (event.submission_end_at is null or now() <= event.submission_end_at)
    from public.event_editions event
    where event.id = coalesce(p_event_id, (
      select active.id from public.event_editions active where active.is_active
    ))
  ), false)
$$;

create or replace function public.is_submission_period_open()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_submission_period_open(null::uuid)
$$;

create or replace function public.get_event_settings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'event_id', event.id, 'event_name', event.name,
    'rules_description', event.rules_description,
    'submission_start_at', event.submission_start_at,
    'submission_end_at', event.submission_end_at,
    'character_options', event.character_options,
    'server_now', now(),
    'accepting_submissions', public.is_submission_period_open(event.id)
  ) from public.event_editions event where event.is_active
$$;

create or replace function public.reject_submission_outside_period()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_submission_period_open(new.event_id) then
    raise exception 'submission period is closed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop function if exists public.list_admin_submissions();
create function public.list_admin_submissions(p_event_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'event_id', s.event_id, 'user_id', s.user_id,
    'discord_username', s.discord_username, 'producer_name', s.producer_name,
    'category', s.category, 'entry_division', s.entry_division,
    'score_image_path', s.score_image_path, 'deck_image_path', s.deck_image_path,
    'beginner_proof_image_path', s.beginner_proof_image_path,
    'login_days_proof_image_path', s.login_days_proof_image_path,
    'created_at', s.created_at, 'updated_at', s.updated_at,
    'profile', jsonb_build_object('user_id', p.user_id),
    'review', case when r.submission_id is null then null else to_jsonb(r) end
  ) order by s.updated_at desc), '[]'::jsonb)
  from public.submissions s join public.profiles p on p.id = s.user_id
  left join public.submission_reviews r on r.submission_id = s.id
  where public.is_admin() and s.event_id = coalesce(p_event_id, (
    select id from public.event_editions where is_active
  ));
$$;

create or replace function public.set_active_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'administrator required'; end if;
  if not exists (select 1 from public.event_editions where id = p_event_id) then
    raise exception 'event not found';
  end if;
  update public.event_editions set is_active = false where is_active;
  update public.event_editions set is_active = true where id = p_event_id;
end;
$$;

revoke all on function public.is_submission_period_open(uuid),
  public.get_event_settings(), public.list_admin_submissions(uuid),
  public.set_active_event(uuid) from public;
grant execute on function public.is_submission_period_open(uuid),
  public.get_event_settings() to authenticated, service_role;
grant execute on function public.is_submission_period_open()
  to authenticated, service_role;
grant execute on function public.list_admin_submissions(uuid),
  public.set_active_event(uuid) to authenticated;
