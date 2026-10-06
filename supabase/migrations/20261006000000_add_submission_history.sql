-- Only expose the caller's participation and public review fields.
-- Keep submission_reviews and its administrative notes protected by existing RLS.
create function public.list_my_submission_history()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
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
  where s.user_id = (select auth.uid());
$$;

revoke all on function public.list_my_submission_history() from public, anon;
grant execute on function public.list_my_submission_history() to authenticated;
