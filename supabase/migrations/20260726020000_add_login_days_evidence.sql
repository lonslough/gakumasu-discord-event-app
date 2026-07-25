alter table public.submissions
  add column if not exists login_days_proof_image_path text null;

alter table public.submissions
  drop constraint if exists beginner_proof_required;

alter table public.submissions
  add constraint beginner_evidence_required check (
    entry_division <> 'beginner'
    or (
      beginner_proof_image_path is not null
      and login_days_proof_image_path is not null
    )
  ) not valid;

alter table public.submissions
  add constraint own_login_days_proof_path check (
    login_days_proof_image_path is null
    or login_days_proof_image_path
      like user_id::text || '/login-days-proof/%'
  );

drop policy if exists "storage upload own" on storage.objects;
create policy "storage upload own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in (
    'score',
    'deck',
    'beginner-proof',
    'login-days-proof'
  )
);

create or replace function public.list_admin_submissions()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'user_id', s.user_id, 'discord_username', s.discord_username,
    'producer_name', s.producer_name, 'category', s.category,
    'entry_division', s.entry_division,
    'score_image_path', s.score_image_path, 'deck_image_path', s.deck_image_path,
    'beginner_proof_image_path', s.beginner_proof_image_path,
    'login_days_proof_image_path', s.login_days_proof_image_path,
    'created_at', s.created_at, 'updated_at', s.updated_at,
    'profile', jsonb_build_object('user_id', p.user_id),
    'review', case when r.submission_id is null then null else to_jsonb(r) end
  ) order by s.updated_at desc), '[]'::jsonb)
  from public.submissions s
  join public.profiles p on p.id = s.user_id
  left join public.submission_reviews r on r.submission_id = s.id
  where public.is_admin();
$$;
