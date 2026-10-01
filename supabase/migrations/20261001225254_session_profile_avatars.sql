-- Public profiles only; invoker permissions/RLS also apply to this homepage sample.
create function public.community_profiles() returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from (
    select id,handle,display_name,bio,avatar_path,cover_path
    from public.profiles where is_public order by random() limit 3
  ) p;
$$;
revoke all on function public.community_profiles() from public;
grant execute on function public.community_profiles() to anon,authenticated;

-- The private user_id join needs definer access, but never returns auth identifiers.
create function public.session_participants(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.session_members m join public.sessions s on s.id=m.session_id
    where m.session_id=p_session_id and m.user_id=auth.uid() and m.left_at is null and s.expires_at>now()
  ) then raise insufficient_privilege using message='Active room membership required'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(member) order by member.member_key), '[]'::jsonb) from (
    select row_number() over(order by m.joined_at,m.user_id) as member_key,
      coalesce(m.last_seen_at>=now()-interval '90 seconds',false) as online,
      case when p.is_public or m.user_id=auth.uid() then p.id end as id,
      case when p.is_public or m.user_id=auth.uid() then p.handle end as handle,
      case when p.is_public or m.user_id=auth.uid() then p.display_name when p.id is not null then 'Perfil privado' else 'Convidado' end as display_name,
      case when p.is_public or m.user_id=auth.uid() then p.bio end as bio,
      case when p.is_public or m.user_id=auth.uid() then p.avatar_path end as avatar_path,
      case when p.is_public or m.user_id=auth.uid() then p.cover_path end as cover_path
    from public.session_members m left join public.profiles p on p.user_id=m.user_id
    where m.session_id=p_session_id and m.left_at is null
  ) member);
end;
$$;
revoke all on function public.session_participants(uuid) from public,anon;
grant execute on function public.session_participants(uuid) to authenticated;
