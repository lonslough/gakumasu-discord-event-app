-- Keep existing answers and IDs, while allowing each edition to define 1-10 divisions.
alter table public.event_editions add column division_settings jsonb not null default '{
  "open":{"name":"無差別部門","description":"参加条件なし","eligibility":"","requiresProof":false,"order":0},
  "switch_off":{"name":"スイッチカードOFF部門","description":"スイッチカードOFF必須","eligibility":"","requiresProof":false,"order":1},
  "beginner":{"name":"初心者部門","description":"スイッチカードOFF必須","eligibility":"参加条件：イベント参加時点で「PLv60未満」または「ログイン日数合計90日以下」の方","requiresProof":true,"order":2}
}'::jsonb;

-- Match JavaScript trim(), including Unicode whitespace, at the database boundary.
create function public.trim_division_text(value text) returns text
language sql immutable strict set search_path = '' as $$
  select btrim(value, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) ||
    chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) ||
    chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) ||
    chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279));
$$;

create function public.validate_event_divisions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
  division_id text;
  option jsonb;
  label text;
  description text;
  eligibility text;
  position integer;
  names text[] := '{}';
  positions integer[] := '{}';
  normalized jsonb := '{}'::jsonb;
  answered_id text;
begin
  if jsonb_typeof(new.division_settings) is distinct from 'object' then
    raise exception 'divisions must be an object' using errcode = '23514';
  end if;
  select count(*) into total from jsonb_object_keys(new.division_settings);
  if total not between 1 and 10 then
    raise exception 'division count must be between 1 and 10' using errcode = '23514';
  end if;
  for division_id, option in select * from jsonb_each(new.division_settings) loop
    if char_length(division_id) not between 1 and 64 or
      jsonb_typeof(option) is distinct from 'object' or
      jsonb_typeof(option->'name') is distinct from 'string' or
      jsonb_typeof(option->'description') is distinct from 'string' or
      jsonb_typeof(option->'eligibility') is distinct from 'string' or
      jsonb_typeof(option->'requiresProof') is distinct from 'boolean' or
      jsonb_typeof(option->'order') is distinct from 'number' or
      coalesce(option->>'order', '') !~ '^[0-9]$' then
      raise exception 'invalid division settings' using errcode = '23514';
    end if;
    label := public.trim_division_text(option->>'name');
    description := public.trim_division_text(option->>'description');
    eligibility := public.trim_division_text(option->>'eligibility');
    position := (option->>'order')::integer;
    if char_length(label) not between 1 and 50 or char_length(description) > 200 or
      char_length(eligibility) > 500 or label = any(names) or
      position >= total or position = any(positions) then
      raise exception 'invalid division settings' using errcode = '23514';
    end if;
    names := array_append(names, label);
    positions := array_append(positions, position);
    normalized := normalized || jsonb_build_object(division_id, jsonb_build_object(
      'name', label, 'description', description, 'eligibility', eligibility,
      'requiresProof', (option->>'requiresProof')::boolean, 'order', position
    ));
  end loop;
  new.division_settings := normalized;

  -- UPDATE holds the edition row lock. Submission writes take the same lock
  -- before validating, so concurrent first answers cannot lose their division.
  if tg_op = 'UPDATE' and new.division_settings is distinct from old.division_settings then
    for answered_id in select distinct s.entry_division from public.submissions s where s.event_id = old.id loop
      if not (new.division_settings ? answered_id) or
        new.division_settings->answered_id->'requiresProof' is distinct from old.division_settings->answered_id->'requiresProof' then
        raise exception 'answered division cannot be removed or change proof requirements' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
create trigger validate_event_divisions before insert or update of division_settings
on public.event_editions for each row execute function public.validate_event_divisions();

alter table public.submissions drop constraint submissions_entry_division_check;
alter table public.submissions drop constraint beginner_evidence_required;

create function public.validate_submission_division() returns trigger
language plpgsql security definer set search_path = '' as $$
declare options jsonb;
begin
  select e.division_settings into options from public.event_editions e
  where e.id = new.event_id for no key update;
  if options is null or not (options ? new.entry_division) then
    raise exception 'selected division is not configured for this event' using errcode = '23514';
  end if;
  if (options->new.entry_division->>'requiresProof')::boolean and
    (new.beginner_proof_image_path is null or new.login_days_proof_image_path is null) then
    raise exception 'division requires both proof images' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger a_validate_submission_division before insert or update
on public.submissions for each row execute function public.validate_submission_division();

create function public.get_event_division_usage(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'administrator required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_editions where id = p_event_id) then
    raise exception 'event not found' using errcode = '22023';
  end if;
  return (select coalesce(jsonb_object_agg(ids.id, (
    select count(*) from public.submissions s where s.event_id = p_event_id and s.entry_division = ids.id
  )), '{}'::jsonb) from public.event_editions e, jsonb_object_keys(e.division_settings) ids(id)
  where e.id = p_event_id);
end;
$$;

create or replace function public.get_event_settings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'event_id', event.id, 'event_name', event.name,
    'rules_description', event.rules_description,
    'submission_start_at', event.submission_start_at,
    'submission_end_at', event.submission_end_at,
    'character_options', event.character_options,
    'division_settings', event.division_settings,
    'server_now', now(),
    'accepting_submissions', public.is_submission_period_open(event.id)
  ) from public.event_editions event where event.is_active;
$$;

create or replace function public.list_public_ranking_events()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'is_active', e.is_active,
      'character_options', e.character_options, 'division_settings', e.division_settings, 'created_at', e.created_at
    ) order by e.created_at desc), '[]'::jsonb)
    from public.event_editions e where e.ranking_published
  );
end;
$$;

-- Helpers/triggers are not RPCs. Only the admin-checked count RPC is exposed.
revoke all on function public.trim_division_text(text), public.validate_event_divisions(),
  public.validate_submission_division() from public, anon, authenticated;
revoke all on function public.get_event_division_usage(uuid) from public, anon;
grant execute on function public.get_event_division_usage(uuid) to authenticated;
-- Compute ranks within each edition/character/division on the server.
-- Publication does not restrict callers viewing their own rank.
-- Only expose the caller's participation and public review fields.
-- Keep submission_reviews and its administrative notes protected by existing RLS.
create or replace function public.list_my_submission_history()
returns jsonb language sql stable security definer set search_path = '' as $$
  with ranked as (
    select s.id,
      row_number() over (
        partition by s.event_id, s.category, s.entry_division
        order by r.confirmed_score desc, s.updated_at asc
      ) as rank
    from public.submissions s
    join public.submission_reviews r on r.submission_id = s.id
    join public.event_editions e on e.id = s.event_id
    where r.verification_status = 'verified' and r.confirmed_score is not null
      and exists (
        select 1 from public.submissions mine
        where mine.user_id = (select auth.uid())
          and mine.event_id = s.event_id and mine.category = s.category
          and mine.entry_division = s.entry_division
      )
      and exists (
        select 1 from jsonb_array_elements(e.character_options) c
        where c->>'id' = s.category
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'rank', ranked.rank,
    'event_id', e.id,
    'event_name', e.name,
    'is_active', e.is_active,
    'character_options', e.character_options,
    'division_settings', e.division_settings,
    'discord_username', s.discord_username,
    'producer_name', s.producer_name,
    'category', s.category,
    'entry_division', s.entry_division,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    'score_image_path', s.score_image_path,
    'deck_image_path', s.deck_image_path,
    'beginner_proof_image_path', s.beginner_proof_image_path,
    'login_days_proof_image_path', s.login_days_proof_image_path,
    'verification_status', coalesce(r.verification_status, 'pending'),
    'confirmed_score', case when r.verification_status = 'verified'
      then r.confirmed_score else null end
  ) order by e.created_at desc, e.id desc), '[]'::jsonb)
  from public.submissions s
  join public.event_editions e on e.id = s.event_id
  left join public.submission_reviews r on r.submission_id = s.id
  left join ranked on ranked.id = s.id
  where s.user_id = (select auth.uid());
$$;

revoke all on function public.list_my_submission_history() from public, anon;
grant execute on function public.list_my_submission_history() to authenticated;
