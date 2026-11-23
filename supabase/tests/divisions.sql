begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.division(label text, proof boolean, sort_position integer) returns jsonb language sql as $$
 select jsonb_build_object('name',label,'description','','eligibility','','requiresProof',proof,'order',sort_position);
$$;
insert into auth.users(id,email) values
 ('ba000000-0000-0000-0000-000000000001','division-user@app.invalid'),
 ('ba000000-0000-0000-0000-000000000002','division-proof@app.invalid'),
 ('ba000000-0000-0000-0000-000000000003','division-admin@app.invalid');
insert into public.profiles(id,user_id,role) values
 ('ba000000-0000-0000-0000-000000000001','division-user','user'),
 ('ba000000-0000-0000-0000-000000000002','division-proof','user'),
 ('ba000000-0000-0000-0000-000000000003','division-admin','admin');
update public.event_editions set is_active=false where is_active;
insert into public.event_editions(id,name,character_options,is_active) values
 ('ba000000-0000-0000-0001-000000000001','Division fixture','[{"id":"sena","name":"星南"},{"id":"tsubame","name":"燕"}]',true);
select is((select division_settings->'open'->>'name' from public.event_editions where id='ba000000-0000-0000-0001-000000000001'),'無差別部門','default existing names');
select is((select division_settings->'beginner'->>'requiresProof' from public.event_editions where id='ba000000-0000-0000-0001-000000000001'),'true','default beginner proof remains required');
select throws_ok($$update public.event_editions set division_settings='{}' where id='ba000000-0000-0000-0001-000000000001'$$,'23514','division count must be between 1 and 10','zero divisions rejected');
select throws_ok($$update public.event_editions set division_settings='[]' where id='ba000000-0000-0000-0001-000000000001'$$,'23514','divisions must be an object','non-object rejected');
select throws_ok($$update public.event_editions set division_settings=(select jsonb_object_agg('d'||i,pg_temp.division('部門'||i,false,i)) from generate_series(0,10)i) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','division count must be between 1 and 10','eleven divisions rejected');
select lives_ok($$update public.event_editions set division_settings=(select jsonb_object_agg('d'||i,pg_temp.division('部門'||i,false,i)) from generate_series(0,9)i) where id='ba000000-0000-0000-0001-000000000001'$$,'ten divisions accepted');
select throws_ok($$update public.event_editions set division_settings=jsonb_build_object('a',pg_temp.division('同名',false,0),'b',pg_temp.division(' 同名 ',false,1)) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','trimmed duplicate names rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_build_object('a',pg_temp.division('　',false,0)) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','Unicode whitespace-only name rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_build_object('a',pg_temp.division(repeat('😀',51),false,0)) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','51 Unicode characters rejected');
select lives_ok($$update public.event_editions set division_settings=jsonb_build_object('a',pg_temp.division(repeat('😀',50),false,0)||jsonb_build_object('description',repeat('あ',200),'eligibility',repeat('い',500))) where id='ba000000-0000-0000-0001-000000000001'$$,'50/200/500 characters accepted');
select throws_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{a,description}',to_jsonb(repeat('あ',201))) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','201 description rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{a,eligibility}',to_jsonb(repeat('あ',501))) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','501 conditions rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{a,requiresProof}','"true"') where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','proof must be boolean');
select throws_ok($$update public.event_editions set division_settings=jsonb_build_object('a',pg_temp.division('A',false,0),'b',pg_temp.division('B',false,0)) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','duplicate order rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_build_object('a',pg_temp.division('A',false,2)) where id='ba000000-0000-0000-0001-000000000001'$$,'23514','invalid division settings','out of range order rejected');
update public.event_editions set division_settings=jsonb_build_object('alpha',pg_temp.division('　自由枠　',false,1)||jsonb_build_object('eligibility',E' \n条件\nを確認 \n'),'beta',pg_temp.division('証明枠',true,0)) where id='ba000000-0000-0000-0001-000000000001';
select is((select division_settings->'alpha'->>'name' from public.event_editions where id='ba000000-0000-0000-0001-000000000001'),'自由枠','server normalizes Unicode trim');
select is((select division_settings->'alpha'->>'eligibility' from public.event_editions where id='ba000000-0000-0000-0001-000000000001'),E'条件\nを確認','internal newline preserved');
select is((select division_settings->'beta'->>'order' from public.event_editions where id='ba000000-0000-0000-0001-000000000001'),'0','explicit display order survives JSONB key order');
select ok(not has_function_privilege('anon','public.get_event_division_usage(uuid)','execute'),'anonymous usage denied');
select ok(not has_function_privilege('authenticated','public.validate_event_divisions()','execute'),'internal trigger not exposed as RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub','','true');
select throws_ok($$select public.get_event_division_usage('ba000000-0000-0000-0001-000000000001')$$,'42501','administrator required','identity required for counts');
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.get_event_division_usage('ba000000-0000-0000-0001-000000000001')$$,'42501','administrator required','ordinary user cannot see counts');
update public.event_editions set division_settings=jsonb_set(division_settings,'{alpha,name}','"不正変更"') where id='ba000000-0000-0000-0001-000000000001';
select is((public.get_event_settings()->'division_settings'->'alpha'->>'name'),'自由枠','ordinary update rejected by RLS');
select throws_ok($$insert into public.submissions(event_id,user_id,discord_username,producer_name,category,entry_division) values('ba000000-0000-0000-0001-000000000001','ba000000-0000-0000-0000-000000000001','User','P','sena','unknown')$$,'23514','selected division is not configured for this event','unknown division rejected');
select lives_ok($$insert into public.submissions(id,event_id,user_id,discord_username,producer_name,category,entry_division) values('ba000000-0000-0000-0002-000000000001','ba000000-0000-0000-0001-000000000001','ba000000-0000-0000-0000-000000000001','User','P','sena','alpha')$$,'custom division without proofs accepted');
select throws_ok($$update public.submissions set entry_division='beta',beginner_proof_image_path='ba000000-0000-0000-0000-000000000001/beginner-proof/a.jpg',login_days_proof_image_path='ba000000-0000-0000-0000-000000000001/login-days-proof/a.jpg' where id='ba000000-0000-0000-0002-000000000001'$$,'P0001','entry division cannot be changed after submission','saved division remains immutable');
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000002',true);
select throws_ok($$insert into public.submissions(event_id,user_id,discord_username,producer_name,category,entry_division) values('ba000000-0000-0000-0001-000000000001','ba000000-0000-0000-0000-000000000002','Proof user','P','sena','beta')$$,'23514','division requires both proof images','custom proof division missing both rejected');
select throws_ok($$insert into public.submissions(event_id,user_id,discord_username,producer_name,category,entry_division,beginner_proof_image_path) values('ba000000-0000-0000-0001-000000000001','ba000000-0000-0000-0000-000000000002','Proof user','P','sena','beta','ba000000-0000-0000-0000-000000000002/beginner-proof/a.jpg')$$,'23514','division requires both proof images','one proof alone rejected');
select lives_ok($$insert into public.submissions(id,event_id,user_id,discord_username,producer_name,category,entry_division,beginner_proof_image_path,login_days_proof_image_path) values('ba000000-0000-0000-0002-000000000002','ba000000-0000-0000-0001-000000000001','ba000000-0000-0000-0000-000000000002','Proof user','P','sena','beta','ba000000-0000-0000-0000-000000000002/beginner-proof/a.jpg','ba000000-0000-0000-0000-000000000002/login-days-proof/a.jpg')$$,'custom proof division accepts both proofs');
select throws_ok($$update public.submissions set login_days_proof_image_path=null where id='ba000000-0000-0000-0002-000000000002'$$,'23514','division requires both proof images','required proof cannot be removed');
select is(jsonb_array_length(public.list_my_submission_history()),1,'history remains caller-only');
select is((public.list_my_submission_history()->0->'division_settings'->'beta'->>'name'),'証明枠','history returns edition-specific custom settings');
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000003',true);
select is(public.get_event_division_usage('ba000000-0000-0000-0001-000000000001'),' {"alpha":1,"beta":1}'::jsonb,'admin sees counts per dynamic division');
select throws_ok($$select public.get_event_division_usage('ba000000-0000-0000-0001-000000000099')$$,'22023','event not found','usage invalid event rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_set(division_settings-'alpha','{beta,order}','0') where id='ba000000-0000-0000-0001-000000000001'$$,'23514','answered division cannot be removed or change proof requirements','answered division deletion rejected');
select throws_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{alpha,requiresProof}','true') where id='ba000000-0000-0000-0001-000000000001'$$,'23514','answered division cannot be removed or change proof requirements','answered optional proof cannot become required');
select throws_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{beta,requiresProof}','false') where id='ba000000-0000-0000-0001-000000000001'$$,'23514','answered division cannot be removed or change proof requirements','answered required proof cannot become optional');
select lives_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{alpha,name}','"改名した部門"'),ranking_published=true where id='ba000000-0000-0000-0001-000000000001'$$,'answered division may be renamed');
select lives_ok($$update public.event_editions set division_settings=division_settings||jsonb_build_object('extra',pg_temp.division('追加枠',false,2)) where id='ba000000-0000-0000-0001-000000000001'$$,'add third custom division');
select lives_ok($$update public.event_editions set division_settings=jsonb_set(division_settings,'{extra,requiresProof}','true') where id='ba000000-0000-0000-0001-000000000001'$$,'unanswered proof setting change allowed');
select lives_ok($$update public.event_editions set division_settings=division_settings-'extra' where id='ba000000-0000-0000-0001-000000000001'$$,'unanswered division deletion allowed');
insert into public.submission_reviews(submission_id,confirmed_score,verification_status) values('ba000000-0000-0000-0002-000000000001',999,'verified'),('ba000000-0000-0000-0002-000000000002',500,'verified');
select set_config('request.jwt.claim.sub','ba000000-0000-0000-0000-000000000001',true);
select is((public.list_my_submission_history()->0->'division_settings'->'alpha'->>'name'),'改名した部門','existing history reflects renamed division');
select is((public.list_my_submission_history()->0->>'rank'),'1','custom division participates in own ranking');
select is((public.list_public_ranking_events()->0->'division_settings'->'alpha'->>'name'),'改名した部門','public event returns custom names');
select is(jsonb_array_length(public.get_public_rankings('ba000000-0000-0000-0001-000000000001')),2,'public rankings group custom divisions independently');
select ok(not (public.get_public_rankings('ba000000-0000-0000-0001-000000000001')->0 ? 'user_id'),'custom rankings do not expose auth identity');
select * from finish();
rollback;
