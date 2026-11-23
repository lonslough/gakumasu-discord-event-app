begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Only transaction-local fixtures; all existing data/settings are restored.
update public.event_editions set ranking_published = false, is_active = false;
insert into auth.users (id, email)
select ('ae000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'public-rank-' || i || '@app.invalid' from generate_series(1, 21) i;
insert into public.profiles (id, user_id, role)
select ('ae000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'public-rank-' || i, case when i = 21 then 'admin' else 'user' end
from generate_series(1, 21) i;
insert into public.event_editions (id, name, character_options, is_active, created_at) values
  ('ae000000-0000-0000-0001-000000000001', 'Private past', '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]', true, '2026-01-01'),
  ('ae000000-0000-0000-0001-000000000002', 'Published active', '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]', false, '2026-02-01'),
  ('ae000000-0000-0000-0001-000000000003', 'Published empty', '[{"id":"saki","name":"Saki"},{"id":"temari","name":"Temari"}]', false, '2026-03-01');

select ok(not (select bool_or(ranking_published) from public.event_editions), 'existing and new editions remain private until published');
insert into public.submissions (id, event_id, user_id, discord_username, producer_name, category)
values ('ae000000-0000-0000-0002-000000000099', 'ae000000-0000-0000-0001-000000000001',
  'ae000000-0000-0000-0000-000000000001', 'PRIVATE_OTHER_EVENT', 'P', 'sena');
insert into public.submission_reviews(submission_id, verification_status, confirmed_score, admin_note)
values ('ae000000-0000-0000-0002-000000000099', 'verified', 999999, 'PRIVATE_ADMIN_NOTE');
update public.event_editions set is_active = false where is_active;
update public.event_editions set is_active = true where id = 'ae000000-0000-0000-0001-000000000002';
insert into public.submissions(id, event_id, user_id, discord_username, producer_name, category, entry_division, updated_at)
select ('ae000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid,
  'ae000000-0000-0000-0001-000000000002',
  ('ae000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'Public name ' || i, 'Producer ' || i,
  case when i = 17 then 'tsubame' else 'sena' end,
  case when i = 18 then 'switch_off' else 'open' end,
  '2026-01-01'::timestamptz + i * interval '1 second'
from generate_series(1, 18) i;
insert into public.submission_reviews(submission_id, verification_status, confirmed_score, admin_note)
select ('ae000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid,
  case i when 13 then 'pending' when 14 then 'invalid' else 'verified' end,
  case when i = 15 then null when i = 17 then 0 when i = 18 then 123
    when i in (1, 2) then 30000 when i in (13, 14) then 999998 else 10000 + i end,
  'PRIVATE_ADMIN_NOTE'
from generate_series(1, 18) i where i <> 16;

select ok(not has_function_privilege('anon', 'public.list_public_ranking_events()', 'execute'), 'anonymous event list denied');
select ok(not has_function_privilege('anon', 'public.get_public_rankings(uuid)', 'execute'), 'anonymous rankings denied');
select ok(has_function_privilege('authenticated', 'public.list_public_ranking_events()', 'execute'), 'authenticated event list allowed');
select ok(has_function_privilege('authenticated', 'public.get_public_rankings(uuid)', 'execute'), 'authenticated rankings allowed');
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.list_public_ranking_events()$$, '42501', 'authentication required', 'event list requires caller identity');
select throws_ok($$select public.get_public_rankings('ae000000-0000-0000-0001-000000000002')$$, '42501', 'authentication required', 'rankings require caller identity');
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000001', true);
select is(public.list_public_ranking_events(), '[]'::jsonb, 'no implicit publication of current event');
select throws_ok($$select public.get_public_rankings('ae000000-0000-0000-0001-000000000002')$$, '42501', 'ranking is not published', 'unpublished active event rejected');
select throws_ok($$select public.get_public_rankings('ae000000-0000-0000-0001-000000000099')$$, '42501', 'ranking is not published', 'nonexistent event rejected');
select throws_ok($$select public.get_public_rankings(null)$$, '42501', 'ranking is not published', 'null does not default to current');
update public.event_editions set ranking_published = true where id = 'ae000000-0000-0000-0001-000000000002';
select is((select ranking_published from public.event_editions where id = 'ae000000-0000-0000-0001-000000000002'), false, 'ordinary user cannot publish via UPDATE');
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000021', true);
update public.event_editions set ranking_published = true where id in ('ae000000-0000-0000-0001-000000000002', 'ae000000-0000-0000-0001-000000000003');
select is((select count(*)::integer from public.event_editions where ranking_published), 2, 'administrator can publish editions');
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000001', true);

select is(jsonb_array_length(public.list_public_ranking_events()), 2, 'list contains only published editions');
select is(public.list_public_ranking_events()->0->>'name', 'Published empty', 'event list ordered newest first');
select is((select count(*)::integer from jsonb_object_keys(public.list_public_ranking_events()->0)), 6, 'event list returns six display fields including division settings');
select ok((public.list_public_ranking_events()->0) ?& array['id','name','is_active','character_options','division_settings','created_at'], 'event list includes required display fields only');
select is(public.get_public_rankings('ae000000-0000-0000-0001-000000000003'), '[]'::jsonb, 'published edition with no submissions returns empty array');
select is(jsonb_array_length(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')), 12, 'top ten plus other character and division');
select is((select count(*)::integer from jsonb_array_elements(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')) r where r->>'category'='sena' and r->>'entry_division'='open'), 10, 'only top ten per category and division');
select is(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')->0->>'discord_username', 'Public name 1', 'earlier update wins tie for first');
select is(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')->1->>'discord_username', 'Public name 2', 'second tied entry follows');
select is(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')->2->>'confirmed_score', '10012', 'remaining entries follow descending score');
select ok(not exists(select 1 from jsonb_array_elements(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')) r where r->>'discord_username' in ('Public name 3','Public name 4','Public name 13','Public name 14','Public name 15','Public name 16')), 'below tenth, pending, invalid, null score and missing review excluded');
select ok(exists(select 1 from jsonb_array_elements(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')) r where r->>'category'='tsubame' and r->>'confirmed_score'='0'), 'verified zero score included');
select is((select count(*)::integer from jsonb_object_keys(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')->0)), 6, 'rankings return exactly six display fields');
select ok((public.get_public_rankings('ae000000-0000-0000-0001-000000000002')->0) ?& array['category','entry_division','rank','discord_username','producer_name','confirmed_score'], 'rankings include all required display fields');
select ok(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')::text not like '%PRIVATE_%', 'other event answers and administrator notes never returned');
select is((select count(*)::integer from public.submission_reviews), 0, 'review RLS still admin only');
select is((select count(*)::integer from public.submissions where user_id <> auth.uid()), 0, 'other submissions still inaccessible directly');
select is(public.list_admin_submissions('ae000000-0000-0000-0001-000000000002'), '[]'::jsonb, 'general user cannot fetch CSV/admin data');

reset role;
update public.event_editions set submission_start_at = now() + interval '1 day' where id = 'ae000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(jsonb_array_length(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')), 12, 'published rankings available before reception');
reset role;
update public.event_editions set submission_start_at = null, submission_end_at = now() - interval '1 day', is_active = false where id = 'ae000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(jsonb_array_length(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')), 12, 'published inactive rankings available after reception');
reset role;
update public.event_editions set character_options = '[{"id":"saki","name":"Saki"},{"id":"tsubame","name":"Tsubame"}]' where id = 'ae000000-0000-0000-0001-000000000002';
set local role authenticated;
select is(jsonb_array_length(public.get_public_rankings('ae000000-0000-0000-0001-000000000002')), 1, 'obsolete character answers excluded from public payload');
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000021', true);
select is(jsonb_array_length(public.list_admin_submissions('ae000000-0000-0000-0001-000000000002')), 18, 'administrator retains all submission access');
update public.event_editions set ranking_published = false where id = 'ae000000-0000-0000-0001-000000000002';
select is(jsonb_array_length(public.list_admin_submissions('ae000000-0000-0000-0001-000000000002')), 18, 'administrator retains unpublished submissions');
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000001', true);
select is(jsonb_array_length(public.list_public_ranking_events()), 1, 'revoked edition removed on next list request');
select throws_ok($$select public.get_public_rankings('ae000000-0000-0000-0001-000000000002')$$, '42501', 'ranking is not published', 'revoked edition rejected on next ranking request');

select * from finish();
rollback;
