-- Rankings remain private until an administrator explicitly publishes an edition.
alter table public.event_editions
  add column ranking_published boolean not null default false;

create function public.list_public_ranking_events()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'is_active', e.is_active,
      'character_options', e.character_options, 'created_at', e.created_at
    ) order by e.created_at desc), '[]'::jsonb)
    from public.event_editions e where e.ranking_published
  );
end;
$$;

create function public.get_public_rankings(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  characters jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select e.character_options into characters
  from public.event_editions e where e.id = p_event_id and e.ranking_published;
  if not found then
    raise exception 'ranking is not published' using errcode = '42501';
  end if;

  return (
    with ranked as (
      select s.category, s.entry_division, s.discord_username, s.producer_name,
        r.confirmed_score,
        row_number() over (
          partition by s.category, s.entry_division
          order by r.confirmed_score desc, s.updated_at asc
        ) as rank
      from public.submissions s
      join public.submission_reviews r on r.submission_id = s.id
      where s.event_id = p_event_id
        and r.verification_status = 'verified' and r.confirmed_score is not null
        and exists (
          select 1 from jsonb_array_elements(characters) c
          where c->>'id' = s.category
        )
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'category', category, 'entry_division', entry_division, 'rank', rank,
      'discord_username', discord_username, 'producer_name', producer_name,
      'confirmed_score', confirmed_score
    ) order by category, entry_division, rank), '[]'::jsonb)
    from ranked where rank <= 10
  );
end;
$$;

-- Existing table/Storage RLS and admin APIs retain their current access rules.
revoke all on function public.list_public_ranking_events(),
  public.get_public_rankings(uuid) from public, anon;
grant execute on function public.list_public_ranking_events(),
  public.get_public_rankings(uuid) to authenticated;
