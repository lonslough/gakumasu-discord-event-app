create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id text unique not null check (
    user_id = lower(user_id)
    and char_length(user_id) between 3 and 32
    and user_id ~ '^[a-z0-9_-]+(\.[a-z0-9_-]+)*$'
  ),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  discord_username text not null check (char_length(discord_username) between 1 and 100),
  producer_name text not null check (char_length(producer_name) between 1 and 100),
  category text not null check (category in ('sena', 'tsubame')),
  score_image_path text not null,
  deck_image_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint own_score_path check (score_image_path like user_id::text || '/score/%'),
  constraint own_deck_path check (deck_image_path like user_id::text || '/deck/%')
);

create table public.submission_reviews (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  confirmed_score bigint null check (confirmed_score >= 0),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'invalid')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  verified_at timestamptz null,
  verified_by uuid null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.submission_reviews for each row execute function public.set_updated_at();

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles where id = check_user and role = 'admin') $$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_reviews enable row level security;

create policy "profiles select self or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "submissions select own or admin" on public.submissions for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "submissions insert own" on public.submissions for insert to authenticated
with check (user_id = auth.uid());
create policy "submissions update own" on public.submissions for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "reviews admin select" on public.submission_reviews for select to authenticated using (public.is_admin());
create policy "reviews admin insert" on public.submission_reviews for insert to authenticated with check (public.is_admin());
create policy "reviews admin update" on public.submission_reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.profiles, public.submissions, public.submission_reviews from anon;
grant select on public.profiles to authenticated;
grant select, insert, update on public.submissions to authenticated;
grant select, insert, update on public.submission_reviews to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-images', 'submission-images', false, 10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "storage upload own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('score', 'deck')
);
create policy "storage read own or admin" on storage.objects for select to authenticated
using (
  bucket_id = 'submission-images'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy "storage update own" on storage.objects for update to authenticated
using (bucket_id = 'submission-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'submission-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage delete own" on storage.objects for delete to authenticated
using (bucket_id = 'submission-images' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.list_user_summaries()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  from (
    select p.id, p.user_id, p.role, p.created_at, p.updated_at,
      (s.id is not null) as has_submission, s.updated_at as last_submitted_at
    from public.profiles p left join public.submissions s on s.user_id = p.id
    where public.is_admin()
    order by p.created_at desc limit 100
  ) x;
$$;

create or replace function public.list_admin_submissions()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'user_id', s.user_id, 'discord_username', s.discord_username,
    'producer_name', s.producer_name, 'category', s.category,
    'score_image_path', s.score_image_path, 'deck_image_path', s.deck_image_path,
    'created_at', s.created_at, 'updated_at', s.updated_at,
    'profile', jsonb_build_object('user_id', p.user_id),
    'review', case when r.submission_id is null then null else to_jsonb(r) end
  ) order by s.updated_at desc), '[]'::jsonb)
  from public.submissions s
  join public.profiles p on p.id = s.user_id
  left join public.submission_reviews r on r.submission_id = s.id
  where public.is_admin();
$$;

create or replace function public.count_registered_users()
returns bigint language sql stable security definer set search_path = ''
as $$ select count(*) from public.profiles where role = 'user' and public.is_admin() $$;

revoke all on function public.list_user_summaries(), public.list_admin_submissions(), public.count_registered_users() from public;
grant execute on function public.list_user_summaries(), public.list_admin_submissions(), public.count_registered_users() to authenticated;
