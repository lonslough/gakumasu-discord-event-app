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
