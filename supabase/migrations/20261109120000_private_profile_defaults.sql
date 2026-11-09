alter table public.profiles
  alter column is_public set default false,
  alter column show_favorites set default false,
  alter column show_reviews set default false;

