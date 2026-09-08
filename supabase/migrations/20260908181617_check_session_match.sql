create or replace function public.check_session_match(
  p_session_id uuid,
  p_movie_id bigint
)
returns table (
  is_match boolean,
  member_count bigint,
  like_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_member_count bigint;
  v_like_count bigint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.session_members
    where session_id = p_session_id
      and user_id = v_user_id
  ) then
    raise exception 'Usuário não pertence à sessão';
  end if;

  select count(*)
  into v_member_count
  from public.session_members
  where session_id = p_session_id;

  select count(*)
  into v_like_count
  from public.reactions
  where session_id = p_session_id
    and movie_id = p_movie_id
    and value = 1;

  return query
  select
    v_member_count >= 2
    and v_like_count = v_member_count,
    v_member_count,
    v_like_count;
end;
$$;

revoke all
on function public.check_session_match(uuid, bigint)
from public, anon, authenticated;

grant execute
on function public.check_session_match(uuid, bigint)
to authenticated;