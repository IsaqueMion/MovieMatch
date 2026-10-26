-- Apply before the frontend that preserves PNG output from canvas encoders.
begin;

alter table public.profiles
  drop constraint profiles_check,
  drop constraint profiles_check1,
  add constraint profiles_avatar_path_check check (
    avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar-[a-f0-9-]+\.(webp|png)$')
  ),
  add constraint profiles_cover_path_check check (
    cover_path is null or cover_path ~ ('^' || id::text || '/cover-[a-f0-9-]+\.(webp|png)$')
  );

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/png']
where id = 'profile-media';

alter policy profile_media_insert on storage.objects
with check (
  bucket_id = 'profile-media'
  and (select private.has_account())
  and name ~ '^[a-f0-9-]+/(avatar|cover)-[a-f0-9-]+\.(webp|png)$'
  and exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1]
      and private.owns_profile(p.id)
  )
);

commit;
