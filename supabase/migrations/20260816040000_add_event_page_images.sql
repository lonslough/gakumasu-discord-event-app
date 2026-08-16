alter table public.event_editions
  add column page_images_path text null;

alter table public.event_editions
  add constraint event_page_images_path check (
    page_images_path is null
    or page_images_path = id::text || '/page-images.zip'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-images', 'page-images', false, 5242880, array['application/zip'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "page images admin read"
on storage.objects for select to authenticated
using (bucket_id = 'page-images' and public.is_admin());

create policy "page images admin insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'page-images'
  and public.is_admin()
  and (storage.foldername(name))[1] in (
    select id::text from public.event_editions
  )
  and (storage.filename(name)) = 'page-images.zip'
);

create policy "page images admin update"
on storage.objects for update to authenticated
using (bucket_id = 'page-images' and public.is_admin())
with check (bucket_id = 'page-images' and public.is_admin());

revoke execute on function public.set_active_event(uuid) from authenticated;
grant execute on function public.set_active_event(uuid) to service_role;

comment on column public.event_editions.page_images_path is
  'Private Storage ZIP containing the GitHub Pages images and site-config.json for this event.';
