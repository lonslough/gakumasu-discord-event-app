-- Return only the score immediately ahead of the authenticated caller.
-- Do not expose other submissions or administrative review fields through RLS.
create function public.get_my_rank_neighbor(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  result jsonb;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_event_id is null or not public.is_submission_period_open(p_event_id) then
    return jsonb_build_object('status', 'closed', 'higher_score', null);
  end if;

  with mine as (
    select s.category, s.entry_division
    from public.submissions s
    where s.event_id = p_event_id and s.user_id = caller
  ), ranked as (
    select s.user_id,
      row_number() over ranking_order as position,
      lag(r.confirmed_score) over ranking_order as higher_score
    from public.submissions s
    join public.submission_reviews r on r.submission_id = s.id
    join mine m on m.category = s.category and m.entry_division = s.entry_division
    where s.event_id = p_event_id
      and r.verification_status = 'verified' and r.confirmed_score is not null
    window ranking_order as (order by r.confirmed_score desc, s.updated_at asc)
  )
  select jsonb_build_object(
    'status', case when ranked.position = 1 then 'first' else 'ranked' end,
    'higher_score', ranked.higher_score
  ) into result from ranked where ranked.user_id = caller;

  return coalesce(result, jsonb_build_object('status', 'unranked', 'higher_score', null));
end;
$$;

revoke all on function public.get_my_rank_neighbor(uuid) from public, anon;
grant execute on function public.get_my_rank_neighbor(uuid) to authenticated;
