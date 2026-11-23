begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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


-- Rank coverage: all fixtures roll back, including active/publication settings.
reset role;
update public.event_editions set is_active = false where is_active;
insert into auth.users(id,email)
select ('bf000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'history-rank-'||i||'@app.invalid' from generate_series(1,21) i;
insert into public.profiles(id,user_id,role)
select ('bf000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'history-rank-'||i, case when i=21 then 'admin' else 'user' end
from generate_series(1,21) i;
insert into public.event_editions(id,name,character_options,is_active,created_at)
values ('bf000000-0000-0000-0001-000000000002','History alternate',
 '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]',true,'2026-02-01');
insert into public.submissions(id,event_id,user_id,discord_username,producer_name,category)
values ('bf000000-0000-0000-0002-000000000099','bf000000-0000-0000-0001-000000000002',
 'bf000000-0000-0000-0000-000000000001','Self alternate','P','sena');
insert into public.submission_reviews(submission_id,verification_status,confirmed_score)
values ('bf000000-0000-0000-0002-000000000099','verified',999999);
update public.event_editions set is_active=false where is_active;
insert into public.event_editions(id,name,character_options,is_active,created_at)
values ('bf000000-0000-0000-0001-000000000001','History rank',
 '[{"id":"sena","name":"Sena"},{"id":"saki","name":"Saki"}]',true,'2026-03-01');
insert into public.submissions(id,event_id,user_id,discord_username,producer_name,category)
values ('bf000000-0000-0000-0002-000000000020','bf000000-0000-0000-0001-000000000001',
 'bf000000-0000-0000-0000-000000000020','Old character','P','saki');
insert into public.submission_reviews(submission_id,verification_status,confirmed_score)
values ('bf000000-0000-0000-0002-000000000020','verified',999999);
update public.event_editions set character_options='[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]'
where id='bf000000-0000-0000-0001-000000000001';
insert into public.submissions(id,event_id,user_id,discord_username,producer_name,category,entry_division,
 beginner_proof_image_path,login_days_proof_image_path,updated_at)
select ('bf000000-0000-0000-0002-'||lpad(i::text,12,'0'))::uuid,
 'bf000000-0000-0000-0001-000000000001',
 ('bf000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'History name '||i, 'P '||i, case when i=17 then 'tsubame' else 'sena' end,
 case when i=18 then 'switch_off' when i=19 then 'beginner' else 'open' end,
 case when i=19 then 'bf000000-0000-0000-0000-000000000019/beginner-proof/a.png' end,
 case when i=19 then 'bf000000-0000-0000-0000-000000000019/login-days-proof/a.png' end,
 '2026-03-01'::timestamptz+i*interval '1 second'
from generate_series(1,21) i where i<>20;
insert into public.submission_reviews(submission_id,verification_status,confirmed_score,admin_note)
select ('bf000000-0000-0000-0002-'||lpad(i::text,12,'0'))::uuid,
 case when i=13 then 'pending' when i=14 then 'invalid' else 'verified' end,
 case when i=15 then null when i=17 then 0 when i in (13,14,18,19) then 999999
 when i in (1,2) then 30000 else 20003-i end, 'PRIVATE_RANK_NOTE'
from generate_series(1,21) i where i not in (16,20);

create function pg_temp.my_history_rank() returns text language sql as $$
 select item->>'rank' from jsonb_array_elements(public.list_my_submission_history()) item
 where item->>'event_id'='bf000000-0000-0000-0001-000000000001'
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000001',true);
select is(pg_temp.my_history_rank(),'1','private active edition returns own first place');
select is(jsonb_array_length(public.list_my_submission_history()),2,'ranks include only two own editions');
select is(public.list_my_submission_history()->1->>'rank','1','other edition ranked independently');
select ok(not exists(select 1 from jsonb_array_elements(public.list_my_submission_history()) item
 where item ? 'admin_note' or item ? 'verified_by' or item ? 'user_id'
 or item->>'discord_username' not in ('History name 1','Self alternate')),
 'rank response never includes other participants or administrative fields');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000002',true);
select is(pg_temp.my_history_rank(),'2','tie is broken by earlier submission update');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000003',true);
select is(pg_temp.my_history_rank(),'3','third place after two tied scores');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000004',true);
select is(pg_temp.my_history_rank(),'4','fourth place available for outside-top-three label');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000011',true);
select is(pg_temp.my_history_rank(),'11','ranks are not limited to public top ten');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000013',true);
select is(pg_temp.my_history_rank(),null::text,'pending has no rank');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000014',true);
select is(pg_temp.my_history_rank(),null::text,'invalid has no rank');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000015',true);
select is(pg_temp.my_history_rank(),null::text,'verified score missing has no rank');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000016',true);
select is(pg_temp.my_history_rank(),null::text,'missing review has no rank');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000017',true);
select is(pg_temp.my_history_rank(),'1','zero score ranked in independent character');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000018',true);
select is(pg_temp.my_history_rank(),'1','switch-off division ranked independently');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000019',true);
select is(pg_temp.my_history_rank(),'1','beginner division ranked independently');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000020',true);
select is(pg_temp.my_history_rank(),null::text,'character removed from edition has no rank');
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000021',true);
select is(jsonb_array_length(public.list_my_submission_history()),1,'admin also receives only own entry');
select is(pg_temp.my_history_rank(),'13','pending/invalid/null/missing reviews excluded from admin rank');
reset role;
update public.event_editions set ranking_published=true,is_active=false,
 submission_end_at='2026-04-01' where id='bf000000-0000-0000-0001-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','bf000000-0000-0000-0000-000000000001',true);
select is(pg_temp.my_history_rank(),'1','published inactive and ended edition keeps same own rank');
reset role;
update public.submission_reviews set confirmed_score=40000
where submission_id='bf000000-0000-0000-0002-000000000002';
set local role authenticated;
select is(pg_temp.my_history_rank(),'2','fresh request reflects updated review rather than frozen final rank');
select set_config('request.jwt.claim.sub','',true);
select is(public.list_my_submission_history(),'[]'::jsonb,'missing caller identity reveals no history or rank');
reset role;
set local role anon;
select throws_ok($$select public.list_my_submission_history()$$,'42501',
 'permission denied for function list_my_submission_history','anonymous RPC execution rejected');
reset role;

select * from finish();
rollback;
