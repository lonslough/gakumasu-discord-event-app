-- Edge Functions use the service role to verify administrator profiles and
-- create the profile associated with a newly provisioned Auth user.
grant select, insert on table public.profiles to service_role;
