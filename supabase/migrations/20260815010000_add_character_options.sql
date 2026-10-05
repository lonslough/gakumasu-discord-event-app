alter table public.event_settings
  add column character_options jsonb not null default '[
    {"id":"sena","name":"十王 星南","shortName":"SENA","enabled":true},
    {"id":"tsubame","name":"雨夜 燕","shortName":"TSUBAME","enabled":true}
  ]'::jsonb;

alter table public.submissions drop constraint if exists submissions_category_check;

create or replace function public.validate_event_characters()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed_ids constant text[] := array[
    'saki', 'temari', 'kotone', 'mao', 'lilja', 'china', 'sumika',
    'hiro', 'rinami', 'ume', 'misuzu', 'sena', 'tsubame'
  ];
begin
  if jsonb_typeof(new.character_options) <> 'array'
    or jsonb_array_length(new.character_options) <> 2
    or (select count(distinct option->>'id') from jsonb_array_elements(new.character_options) option) <> 2
    or exists (
      select 1 from jsonb_array_elements(new.character_options) option
      where not ((option->>'id') = any(allowed_ids))
    )
  then
    raise exception 'exactly two different characters must be selected'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_event_characters
before insert or update of character_options on public.event_settings
for each row execute function public.validate_event_characters();

create or replace function public.validate_submission_character()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- A disabled/removed character remains valid on an existing submission until
  -- the participant explicitly changes it.
  if tg_op = 'UPDATE' and new.category = old.category then
    return new;
  end if;

  if not exists (
    select 1
    from public.event_settings settings,
      jsonb_array_elements(settings.character_options) option
    where settings.id = true
      and option->>'id' = new.category
      and coalesce((option->>'enabled')::boolean, false)
  ) then
    raise exception 'selected character is not enabled'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_submission_character
before insert or update of category on public.submissions
for each row execute function public.validate_submission_character();

create or replace function public.get_event_settings()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rules_description', rules_description,
    'submission_start_at', submission_start_at,
    'submission_end_at', submission_end_at,
    'character_options', character_options,
    'server_now', now(),
    'accepting_submissions', public.is_submission_period_open()
  )
  from public.event_settings
  where id = true
$$;

revoke all on function public.validate_event_characters(),
  public.validate_submission_character() from public;

comment on column public.event_settings.character_options is
  'Ordered character definitions selectable for this event.';
