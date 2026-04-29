create unique index if not exists categories_user_type_name_unique_idx
  on public.categories(user_id, type, lower(btrim(name)));

drop function if exists public.ponto_touch_updated_at();
