begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures and active-event changes are rolled back at the end.
insert into auth.users (id, email) values
  ('af000000-0000-0000-0000-000000000001', 'history-self@app.invalid'),
  ('af000000-0000-0000-0000-000000000002', 'history-other@app.invalid'),
  ('af000000-0000-0000-0000-000000000003', 'history-admin@app.invalid');
insert into public.profiles (id, user_id, role) values
  ('af000000-0000-0000-0000-000000000001', 'history-self', 'user'),
  ('af000000-0000-0000-0000-000000000002', 'history-other', 'user'),
  ('af000000-0000-0000-0000-000000000003', 'history-admin', 'admin');

do $$
declare
  event_uuid uuid;
  submission_uuid uuid;
begin
  for i in 1..5 loop
    update public.event_editions set is_active = false where is_active;
    insert into public.event_editions(name, character_options, is_active, created_at)
      values ('履歴検証' || i, '[{"id":"sena","name":"星南"},{"id":"tsubame","name":"燕"}]',
        true, '2026-01-01'::timestamptz + i * interval '1 day') returning id into event_uuid;
    insert into public.submissions (event_id, user_id, discord_username, producer_name, category, score_image_path)
      values (event_uuid, 'af000000-0000-0000-0000-000000000001', '自分', 'P', 'sena',
        'af000000-0000-0000-0000-000000000001/score/history.png') returning id into submission_uuid;
    if i <= 4 then
      insert into public.submission_reviews(submission_id, verification_status, confirmed_score, admin_note)
        values (submission_uuid, case i when 1 then 'pending' when 2 then 'invalid' else 'verified' end,
          case i when 3 then 0 when 4 then null else 98765 end, 'PRIVATE_ADMIN_NOTE');
    end if;
    if i = 5 then
      insert into public.submissions (event_id, user_id, discord_username, producer_name, category)
        values (event_uuid, 'af000000-0000-0000-0000-000000000002', '別人', '別P', 'sena');
    end if;
  end loop;
end $$;

select ok(not has_function_privilege('anon', 'public.list_my_submission_history()', 'execute'), 'anonymous execution denied');
select ok(has_function_privilege('authenticated', 'public.list_my_submission_history()', 'execute'), 'authenticated execution allowed');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'af000000-0000-0000-0000-000000000001', true);
select is(jsonb_array_length(public.list_my_submission_history()), 5, 'all five own entries returned');
select is(public.list_my_submission_history()->0->>'event_name', '履歴検証5', 'newest event first');
select is(public.list_my_submission_history()->0->>'is_active', 'true', 'current event included');
select is(public.list_my_submission_history()->0->>'verification_status', 'pending', 'missing review is pending');
select is(public.list_my_submission_history()->1->>'confirmed_score', null::text, 'verified without score remains null');
select is(public.list_my_submission_history()->2->>'confirmed_score', '0', 'verified zero is preserved');
select is(public.list_my_submission_history()->3->>'confirmed_score', null::text, 'invalid score hidden');
select is(public.list_my_submission_history()->4->>'confirmed_score', null::text, 'pending score hidden');
select ok(not exists (
  select 1 from jsonb_array_elements(public.list_my_submission_history()) item
  where item ? 'admin_note' or item ? 'verified_by' or item->>'discord_username' <> '自分'
), 'no administrative fields or other users data');
select set_config('request.jwt.claim.sub', 'af000000-0000-0000-0000-000000000003', true);
select is(public.list_my_submission_history(), '[]'::jsonb, 'admin with no own entries cannot read others through history');
select set_config('request.jwt.claim.sub', 'af000000-0000-0000-0000-000000000002', true);
select is(jsonb_array_length(public.list_my_submission_history()), 1, 'other user sees only their one entry');

select * from finish();
rollback;
