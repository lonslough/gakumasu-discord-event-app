alter table public.submissions
  add column if not exists entry_division text not null default 'open'
    check (entry_division in ('open', 'switch_off', 'beginner')),
  add column if not exists beginner_proof_image_path text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'beginner_proof_required'
      and conrelid = 'public.submissions'::regclass
  ) then
    alter table public.submissions
      add constraint beginner_proof_required check (
        entry_division <> 'beginner' or beginner_proof_image_path is not null
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'own_beginner_proof_path'
      and conrelid = 'public.submissions'::regclass
  ) then
    alter table public.submissions
      add constraint own_beginner_proof_path check (
        beginner_proof_image_path is null
        or beginner_proof_image_path like user_id::text || '/beginner-proof/%'
      );
  end if;
end
$$;

create or replace function public.prevent_entry_division_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.entry_division is distinct from old.entry_division then
    raise exception 'entry division cannot be changed after submission';
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_entry_division_immutable
  on public.submissions;
create trigger submissions_entry_division_immutable
before update of entry_division on public.submissions
for each row execute function public.prevent_entry_division_change();

drop policy if exists "storage upload own" on storage.objects;
create policy "storage upload own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('score', 'deck', 'beginner-proof')
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
    'created_at', s.created_at, 'updated_at', s.updated_at,
    'profile', jsonb_build_object('user_id', p.user_id),
    'review', case when r.submission_id is null then null else to_jsonb(r) end
  ) order by s.updated_at desc), '[]'::jsonb)
  from public.submissions s
  join public.profiles p on p.id = s.user_id
  left join public.submission_reviews r on r.submission_id = s.id
  where public.is_admin();
$$;
