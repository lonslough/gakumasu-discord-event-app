-- Local development accounts only.
-- Production deployment uses `supabase db push` without `--include-seed`,
-- so this file is not applied to Supabase Cloud.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'test@app.invalid',
    extensions.crypt('test', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'user@app.invalid',
    extensions.crypt('user', extensions.gen_salt('bf')),
    now(),
    '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"test@app.invalid"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"user@app.invalid"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  );

insert into public.profiles (id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000001', 'test', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'user', 'user');
