create or replace function public.list_session_matches(
  p_session_id uuid
)
returns table (
  movie_id bigint,
  tmdb_id bigint,
  title text,
  year integer,
  poster_url text,
  likes bigint,
  member_count bigint,
  latest_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_member_count bigint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- O usuário só pode consultar matches
  -- de uma sessão da qual ele participa.
  if not exists (
    select 1
    from public.session_members
    where session_id = p_session_id
      and user_id = v_user_id
  ) then
    raise exception 'Usuário não pertence à sessão';
  end if;

  -- Quantidade atual de participantes.
  select count(*)
  into v_member_count
  from public.session_members
  where session_id = p_session_id;

  -- Uma sessão com apenas uma pessoa
  -- não pode possuir match.
  if v_member_count < 2 then
    return;
  end if;

  return query
  select
    m.id as movie_id,
    m.tmdb_id,
    m.title,
    m.year,
    m.poster_url,

    count(distinct sm.user_id)::bigint as likes,

    v_member_count as member_count,

    max(r.created_at) as latest_at

  from public.reactions r

  inner join public.session_members sm
    on sm.session_id = p_session_id
   and sm.user_id = r.user_id

  inner join public.movies m
    on m.id = r.movie_id

  where r.session_id = p_session_id
    and r.value = 1

  group by
    m.id,
    m.tmdb_id,
    m.title,
    m.year,
    m.poster_url

  having
    count(distinct sm.user_id) = v_member_count

  order by
    max(r.created_at) desc,
    m.title asc;
end;
$$;

revoke all
on function public.list_session_matches(uuid)
from public, anon, authenticated;

grant execute
on function public.list_session_matches(uuid)
to authenticated;