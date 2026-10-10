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

-- Reset-only fixtures. Insert while each event is open so normal validation
-- triggers remain enabled. The final event stays active without a deadline.
-- Images are intentionally unsubmitted; no nonexistent Storage paths are used.
do $$
declare
  event_uuid uuid;
  submission_uuid uuid;
  fixture_time timestamptz;
begin
  for i in 1..6 loop
    fixture_time := '2026-01-01 12:00:00+09'::timestamptz + (i - 1) * interval '1 month';
    event_uuid := ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    submission_uuid := ('30000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    update public.event_editions set is_active = false where is_active;
    insert into public.event_editions (
      id, name, rules_description, character_options, is_active, created_at
    ) values (
      event_uuid, '[テスト] 第' || i || '回', 'ローカル画面確認用のサンプル開催回です。',
      '[{"id":"sena","name":"十王 星南","shortName":"SENA","enabled":true},{"id":"tsubame","name":"雨夜 燕","shortName":"TSUBAME","enabled":true}]',
      true, fixture_time
    );
    insert into public.submissions (
      id, event_id, user_id, discord_username, producer_name, category,
      entry_division, created_at, updated_at
    ) values (
      submission_uuid, event_uuid, '00000000-0000-0000-0000-000000000002',
      'テスト参加者', 'サンプルプロデューサー',
      case when i % 2 = 0 then 'tsubame' else 'sena' end,
      case when i % 2 = 0 then 'switch_off' else 'open' end,
      fixture_time + interval '1 day', fixture_time + interval '2 days'
    );
    -- 1: verified score, 2: pending, 3: invalid, 4: zero, 5: no score,
    -- 6: no review yet (current event).
    if i < 6 then
      insert into public.submission_reviews (
        submission_id, verification_status, confirmed_score, admin_note,
        verified_by, verified_at
      ) values (
        submission_uuid,
        case i when 2 then 'pending' when 3 then 'invalid' else 'verified' end,
        case i when 1 then 123456 when 4 then 0 else null end,
        'ローカル確認用メモ（参加履歴には非表示）',
        case when i <> 2 then '00000000-0000-0000-0000-000000000001'::uuid end,
        case when i <> 2 then fixture_time + interval '2 days' end
      );
    end if;
  end loop;
end;
$$;
