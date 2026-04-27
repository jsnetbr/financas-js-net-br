create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('entrada', 'saida')),
  color text not null default '#1971c2',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  entry_date date not null,
  category_id uuid references public.categories(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  category_id uuid references public.categories(id) on delete set null,
  day_of_month integer not null check (day_of_month between 1 and 28),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_transactions enable row level security;

drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own select" on public.profiles for select using (auth.uid() = id);
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "categories own select" on public.categories;
drop policy if exists "categories own insert" on public.categories;
drop policy if exists "categories own update" on public.categories;
drop policy if exists "categories own delete" on public.categories;
create policy "categories own select" on public.categories for select using (auth.uid() = user_id);
create policy "categories own insert" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories own update" on public.categories for update using (auth.uid() = user_id);
create policy "categories own delete" on public.categories for delete using (auth.uid() = user_id);

drop policy if exists "transactions own select" on public.transactions;
drop policy if exists "transactions own insert" on public.transactions;
drop policy if exists "transactions own update" on public.transactions;
drop policy if exists "transactions own delete" on public.transactions;
create policy "transactions own select" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions own insert" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions own update" on public.transactions for update using (auth.uid() = user_id);
create policy "transactions own delete" on public.transactions for delete using (auth.uid() = user_id);

drop policy if exists "recurring own select" on public.recurring_transactions;
drop policy if exists "recurring own insert" on public.recurring_transactions;
drop policy if exists "recurring own update" on public.recurring_transactions;
drop policy if exists "recurring own delete" on public.recurring_transactions;
create policy "recurring own select" on public.recurring_transactions for select using (auth.uid() = user_id);
create policy "recurring own insert" on public.recurring_transactions for insert with check (auth.uid() = user_id);
create policy "recurring own update" on public.recurring_transactions for update using (auth.uid() = user_id);
create policy "recurring own delete" on public.recurring_transactions for delete using (auth.uid() = user_id);

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, entry_date);
create index if not exists recurring_user_id_idx on public.recurring_transactions(user_id);
