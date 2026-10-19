begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- All fixtures and active-event changes are rolled back, preserving local data.
insert into auth.users (id, email)
select ('ad000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'rank-test-' || i || '@app.invalid' from generate_series(1, 22) i;
insert into public.profiles (id, user_id, role)
select ('ad000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'rank-test-' || i, case when i = 21 then 'admin' else 'user' end
from generate_series(1, 22) i;
update public.event_editions set is_active = false where is_active;
insert into public.event_editions (id, name, character_options, is_active) values
  ('ad000000-0000-0000-0001-000000000001', 'Rank past', '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]', true),
  ('ad000000-0000-0000-0001-000000000002', 'Rank current', '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]', false);
insert into public.submissions (id, event_id, user_id, discord_username, producer_name, category)
values ('ad000000-0000-0000-0002-000000000021', 'ad000000-0000-0000-0001-000000000001',
  'ad000000-0000-0000-0000-000000000001', 'Past', 'Past', 'sena');
insert into public.submission_reviews(submission_id, verification_status, confirmed_score)
values ('ad000000-0000-0000-0002-000000000021', 'verified', 10001);
update public.event_editions set is_active = false where is_active;
update public.event_editions set is_active = true where id = 'ad000000-0000-0000-0001-000000000002';
insert into public.submissions (id, event_id, user_id, discord_username, producer_name, category, entry_division, updated_at)
select ('ad000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid,
  'ad000000-0000-0000-0001-000000000002',
  ('ad000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'PRIVATE_NAME_' || i, 'PRIVATE_PRODUCER_' || i,
  case when i = 7 then 'tsubame' else 'sena' end,
  case when i = 8 then 'switch_off' else 'open' end,
  '2026-01-01'::timestamptz + (case when i = 1 then 100 else i end) * interval '1 second'
from generate_series(1, 20) i;
insert into public.submission_reviews(submission_id, verification_status, confirmed_score, admin_note)
select ('ad000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid,
  case i when 4 then 'pending' when 5 then 'invalid' else 'verified' end,
  case i when 1 then 10000 when 2 then 12000 when 3 then 50000
    when 4 then 11000 when 5 then 11000 when 6 then null
    when 7 then 10001 when 8 then 10002 else 20000 + i end,
  'PRIVATE_ADMIN_NOTE'
from generate_series(1, 20) i;

select ok(not has_function_privilege('anon', 'public.get_my_rank_neighbor(uuid)', 'execute'), 'anonymous execution denied');
select ok(has_function_privilege('authenticated', 'public.get_my_rank_neighbor(uuid)', 'execute'), 'authenticated execution allowed');
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')$$,
  '42501', 'authentication required', 'missing caller identity is rejected');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000001', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002'),
  '{"status":"ranked","higher_score":12000}'::jsonb,
  'own rank below top ten gets immediate higher peer, ignoring other groups and unverified scores');
select is((select count(*)::integer from jsonb_object_keys(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002'))), 2, 'only status and higher_score returned');
select is((select count(*)::integer from public.submission_reviews), 0, 'ordinary user still cannot select reviews');
select is((select count(*)::integer from public.submissions where user_id <> auth.uid()), 0, 'ordinary user still cannot select other answers');
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000001')->>'status', 'closed', 'inactive event hides points');
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000099')->>'status', 'closed', 'unknown event hides points');
select is(public.get_my_rank_neighbor(null)->>'status', 'closed', 'null event does not default to a different event');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000003', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002'),
  '{"status":"first","higher_score":null}'::jsonb, 'first place is explicit');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000021', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'unranked', 'admin without own answer cannot use another participant');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000022', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'unranked', 'unsubmitted user has no rank');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000004', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'unranked', 'pending participant has no rank');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000005', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'unranked', 'invalid participant has no rank');
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000006', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'unranked', 'verified participant with null score has no rank');

reset role;
update public.submission_reviews set confirmed_score = 12000 where submission_id = 'ad000000-0000-0000-0002-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ad000000-0000-0000-0000-000000000001', true);
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'higher_score', '12000', 'earlier answer with equal score is directly above caller');
reset role;
update public.submission_reviews set confirmed_score = 0
where submission_id in (select id from public.submissions where event_id = 'ad000000-0000-0000-0001-000000000002');
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002'),
  '{"status":"ranked","higher_score":0}'::jsonb, 'zero-score caller and zero-score higher peer are ranked');
reset role;
delete from public.submission_reviews where submission_id = 'ad000000-0000-0000-0002-000000000001';
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'unranked', 'missing review has no rank');
reset role;
insert into public.submission_reviews(submission_id, verification_status, confirmed_score)
values ('ad000000-0000-0000-0002-000000000001', 'verified', 0);
update public.event_editions set submission_start_at = now() + interval '1 second'
where id = 'ad000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002'),
  '{"status":"closed","higher_score":null}'::jsonb, 'before acceptance hides the score');
reset role;
update public.event_editions set submission_start_at = now(), submission_end_at = now() + interval '1 day'
where id = 'ad000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'ranked', 'start boundary is inclusive');
reset role;
update public.event_editions set submission_start_at = now() - interval '1 day', submission_end_at = now()
where id = 'ad000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'ranked', 'end boundary is inclusive');
reset role;
update public.event_editions set submission_end_at = now() - interval '1 second'
where id = 'ad000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002'),
  '{"status":"closed","higher_score":null}'::jsonb, 'after acceptance hides the score');
reset role;
update public.event_editions set submission_start_at = null, submission_end_at = null
where id = 'ad000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')->>'status', 'ranked', 'null dates allow acceptance');
select ok(public.get_my_rank_neighbor('ad000000-0000-0000-0001-000000000002')::text not like '%PRIVATE_%', 'names and administrative notes are never returned');

select * from finish();
rollback;
