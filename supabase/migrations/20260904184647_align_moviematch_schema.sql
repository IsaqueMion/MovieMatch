-- Alinha o schema atual com os campos utilizados pelo frontend.

alter table public.session_filters
  add column if not exists providers integer[] not null default '{}',
  add column if not exists watch_region text not null default 'BR',
  add column if not exists monetization text[] not null default array['flatrate']::text[];

-- A data de nascimento deixou de ser persistida pelo MovieMatch.
alter table public.users
  drop column if exists birthdate;

-- Todos os membros atuais já possuem registro correspondente em public.users.
alter table public.session_members
  add constraint session_members_user_id_fkey
  foreign key (user_id)
  references public.users(id)
  on delete cascade;

-- Auxilia futuras policies de RLS e consultas por usuário.
create index if not exists session_members_user_id_idx
  on public.session_members(user_id);

-- Auxilia a contagem de likes por filme dentro da sessão.
create index if not exists reactions_session_movie_value_idx
  on public.reactions(session_id, movie_id, value);