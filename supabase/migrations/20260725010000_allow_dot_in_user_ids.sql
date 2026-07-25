alter table public.profiles
  drop constraint if exists profiles_user_id_check;

alter table public.profiles
  add constraint profiles_user_id_check check (
    user_id = lower(user_id)
    and char_length(user_id) between 3 and 32
    and user_id ~ '^[a-z0-9_-]+(\.[a-z0-9_-]+)*$'
  );
