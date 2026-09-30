-- ============================================================
-- MovieMatch - Segurança do Data API
-- RPCs controladas + grants mínimos + Row Level Security
-- ============================================================

-- ------------------------------------------------------------
-- 1. RPC: criar sessão
-- ------------------------------------------------------------

create or replace function public.create_session()
returns table (
  id uuid,
  code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  loop
    -- Mantém o padrão atual de 6 caracteres em maiúsculas.
    v_code := '';

    for i in 1..6 loop
    v_code := v_code || substr(
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32),
        1
    );
    end loop;

    begin
      insert into public.sessions (code)
      values (v_code)
      returning sessions.id into v_session_id;

      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  insert into public.session_members (session_id, user_id)
  values (v_session_id, v_user_id)
  on conflict (session_id, user_id) do nothing;

  return query
  select v_session_id, v_code;
end;
$$;


-- ------------------------------------------------------------
-- 2. RPC: entrar em sessão
-- ------------------------------------------------------------

create or replace function public.join_session(p_code text)
returns table (
  id uuid,
  code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Invalid session code'
      using errcode = '22023';
  end if;

  select s.id
  into v_session_id
  from public.sessions as s
  where s.code = v_code
  limit 1;

  if v_session_id is null then
    raise exception 'Session not found'
      using errcode = 'P0002';
  end if;

  insert into public.session_members (session_id, user_id)
  values (v_session_id, v_user_id)
  on conflict (session_id, user_id) do nothing;

  return query
  select v_session_id, v_code;
end;
$$;


-- As funções são endpoints intencionais apenas para usuários autenticados.
revoke all on function public.create_session() from public, anon, authenticated;
revoke all on function public.join_session(text) from public, anon, authenticated;

grant execute on function public.create_session() to authenticated;
grant execute on function public.join_session(text) to authenticated;


-- ------------------------------------------------------------
-- 3. Remover privilégios excessivos atuais
-- ------------------------------------------------------------

revoke all on table
  public.users,
  public.sessions,
  public.session_members,
  public.movies,
  public.reactions,
  public.session_filters
from anon, authenticated;


-- Usuários não autenticados não precisam acessar nenhuma dessas tabelas.

-- Perfil
grant select on table public.users to authenticated;
grant update (display_name, is_adult)
  on table public.users
  to authenticated;

-- Sessões: criação/entrada ocorre pelas RPCs.
grant select on table public.sessions to authenticated;

-- Associação: criação ocorre pelas RPCs.
grant select on table public.session_members to authenticated;

-- Filmes: metadados públicos provenientes do TMDB.
grant select, insert on table public.movies to authenticated;

-- Reações
grant select, insert, update, delete
  on table public.reactions
  to authenticated;

-- Filtros compartilhados
grant select, insert, update
  on table public.session_filters
  to authenticated;

-- Necessário para INSERT em movies.id (bigserial).
revoke all on sequence public.movies_id_seq from anon, authenticated;
grant usage on sequence public.movies_id_seq to authenticated;


-- ------------------------------------------------------------
-- 4. Habilitar RLS
-- ------------------------------------------------------------

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.movies enable row level security;
alter table public.reactions enable row level security;
alter table public.session_filters enable row level security;


-- ------------------------------------------------------------
-- 5. USERS
-- ------------------------------------------------------------

drop policy if exists "user-can-update-self" on public.users;

create policy "users_select_self"
on public.users
for select
to authenticated
using (
  (select auth.uid()) = id
);

create policy "users_update_self"
on public.users
for update
to authenticated
using (
  (select auth.uid()) = id
)
with check (
  (select auth.uid()) = id
);


-- ------------------------------------------------------------
-- 6. SESSION_MEMBERS
-- Cada usuário enxerga somente suas próprias associações.
-- ------------------------------------------------------------

create policy "session_members_select_self"
on public.session_members
for select
to authenticated
using (
  user_id = (select auth.uid())
);


-- ------------------------------------------------------------
-- 7. SESSIONS
-- Só pode consultar sessões das quais participa.
-- ------------------------------------------------------------

create policy "sessions_select_member"
on public.sessions
for select
to authenticated
using (
  id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- 8. MOVIES
-- Metadados não são privados, mas usuários não podem alterar
-- nem excluir registros já existentes.
-- ------------------------------------------------------------

create policy "movies_select_authenticated"
on public.movies
for select
to authenticated
using (true);

create policy "movies_insert_authenticated"
on public.movies
for insert
to authenticated
with check (
  tmdb_id > 0
  and length(trim(title)) between 1 and 500
  and (
    year is null
    or year between 1888 and extract(year from current_date)::integer + 2
  )
);


-- ------------------------------------------------------------
-- 9. REACTIONS
-- ------------------------------------------------------------

create policy "reactions_select_session_member"
on public.reactions
for select
to authenticated
using (
  session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);

create policy "reactions_insert_self"
on public.reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);

create policy "reactions_update_self"
on public.reactions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);

create policy "reactions_delete_self"
on public.reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- 10. SESSION_FILTERS
-- ------------------------------------------------------------

create policy "session_filters_select_member"
on public.session_filters
for select
to authenticated
using (
  session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);

create policy "session_filters_insert_member"
on public.session_filters
for insert
to authenticated
with check (
  updated_by = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);

create policy "session_filters_update_member"
on public.session_filters
for update
to authenticated
using (
  session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
)
with check (
  updated_by = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- 11. Evitar exposição automática excessiva em objetos futuros
-- ------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete
  on tables
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute
  on functions
  from anon, authenticated, public;

alter default privileges for role postgres in schema public
  revoke usage, select
  on sequences
  from anon, authenticated;