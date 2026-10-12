begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Test fixtures and changes to the active event are rolled back.
insert into auth.users (id, email) values
  ('ae000000-0000-0000-0000-000000000001', 'activation-admin@app.invalid'),
  ('ae000000-0000-0000-0000-000000000002', 'activation-user@app.invalid');
insert into public.profiles (id, user_id, role) values
  ('ae000000-0000-0000-0000-000000000001', 'activation-admin', 'admin'),
  ('ae000000-0000-0000-0000-000000000002', 'activation-user', 'user');
update public.event_editions set is_active = false where is_active;
insert into public.event_editions (id, name, character_options, is_active) values
  ('ae000000-0000-0000-0000-000000000003', 'Activation previous', '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]', true),
  ('ae000000-0000-0000-0000-000000000004', 'Activation target', '[{"id":"sena","name":"Sena"},{"id":"tsubame","name":"Tsubame"}]', false);

select ok(not has_function_privilege('anon', 'public.set_active_event(uuid)', 'execute'), 'anonymous execution denied');
select ok(has_function_privilege('authenticated', 'public.set_active_event(uuid)', 'execute'), 'authenticated execution allowed with internal admin check');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000002', true);
select throws_ok($$select public.set_active_event('ae000000-0000-0000-0000-000000000004')$$,
  'P0001', 'administrator required', 'ordinary user cannot activate an event');
select is((select is_active from public.event_editions where id = 'ae000000-0000-0000-0000-000000000003'), true, 'failed activation leaves the previous event active');

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$select public.set_active_event('ae000000-0000-0000-0000-000000000004')$$,
  'P0001', 'administrator required', 'service_role without the caller identity is rejected');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.set_active_event('ae000000-0000-0000-0000-000000000004')$$, 'verified admin can activate the target');
select is((select is_active from public.event_editions where id = 'ae000000-0000-0000-0000-000000000004'), true, 'target event becomes active');
select is((select count(*)::integer from public.event_editions where is_active), 1, 'exactly one event is active');
select lives_ok($$select public.set_active_event('ae000000-0000-0000-0000-000000000003')$$, 'verified admin can restore the previous event');
select is((select is_active from public.event_editions where id = 'ae000000-0000-0000-0000-000000000003'), true, 'previous event is active after restoration');
select throws_ok($$select public.set_active_event('ae000000-0000-0000-0000-000000000005')$$,
  'P0001', 'event not found', 'admin still cannot activate a nonexistent event');

select * from finish();
rollback;
