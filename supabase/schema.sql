-- =========================================
-- EXTENSION (for UUID if needed)
-- =========================================
create extension if not exists "uuid-ossp";

-- =========================================
-- 1. PROFILES TABLE
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'user' check (role in ('admin','user')),
  password_text text,
  must_change_password boolean default true,
  api_key text,
  created_at timestamp with time zone default now()
);

-- Index for faster role-based queries (Admin Dashboard)
create index profiles_role_idx on public.profiles(role);

-- =========================================
-- 2. GENERATED QUESTIONS (SMART CACHE TABLE)
-- =========================================
create table public.generated_questions (
  id uuid primary key default uuid_generate_v4(),
  input_hash text not null unique,
  input_payload_json jsonb not null,
  reference_text text,
  result_json jsonb not null,
  model_used text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Index for sorting by date
create index generated_questions_created_at_idx 
on public.generated_questions(created_at);

-- =========================================
-- 3. ACTIVITY LOG TABLE
-- =========================================
create table public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  input_hash text,
  model_used text,
  retry_count int default 0,
  cache_hit boolean default false,
  status text check (status in ('success','failed')),
  details jsonb, -- Added for extra flexibility (error messages, etc.)
  created_at timestamp with time zone default now()
);

-- Indexes for Admin Dashboard and User History
create index activity_user_idx on public.activity_log(user_id);
create index activity_created_at_idx on public.activity_log(created_at);

-- =========================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================
alter table public.profiles enable row level security;
alter table public.generated_questions enable row level security;
alter table public.activity_log enable row level security;

-- =========================================
-- POLICIES: PROFILES
-- =========================================

-- User can read their own profile
create policy "User can read own profile"
on public.profiles
for select
using (auth.uid() = id);

-- User can update their own profile (e.g. change password mirror)
create policy "User can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- Admin can read all profiles
create policy "Admin can read all profiles"
on public.profiles
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Trigger to create profile on signup (Optional but recommended)
-- This ensures a profile exists when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, password_text, must_change_password)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    '123456', -- Default password text if not provided
    true
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- POLICIES: GENERATED QUESTIONS
-- =========================================

-- All authenticated users can read cache (GLOBAL CACHE)
create policy "Authenticated can read generated_questions"
on public.generated_questions
for select
using (auth.role() = 'authenticated');

-- Authenticated users can insert new generations
create policy "Authenticated can insert generated_questions"
on public.generated_questions
for insert
with check (auth.role() = 'authenticated');

-- =========================================
-- POLICIES: ACTIVITY LOG
-- =========================================

-- User can read their own activity logs
create policy "User read own activity"
on public.activity_log
for select
using (auth.uid() = user_id);

-- Admin can read all activity logs
create policy "Admin read all activity"
on public.activity_log
for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Authenticated users can insert activity logs (logging their own actions)
create policy "Authenticated insert activity"
on public.activity_log
for insert
with check (auth.role() = 'authenticated');
