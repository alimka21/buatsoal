-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles Table
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  role text default 'user' check (role in ('admin', 'user')),
  password_text text, -- Mirror field (Security Risk Accepted per requirements)
  must_change_password boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Admin can do everything (simplified for this context, usually requires custom claims or separate admin table)
create policy "Admins can view all profiles" on profiles
  for select using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all profiles" on profiles
  for update using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Generated Questions Table
create table generated_questions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  input_hash text not null,
  input_payload jsonb not null,
  result_json jsonb not null,
  model_used text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for cache lookup
create index idx_questions_input_hash on generated_questions(input_hash);

alter table generated_questions enable row level security;

create policy "Users can view own questions" on generated_questions
  for select using (auth.uid() = user_id);

create policy "Users can insert own questions" on generated_questions
  for insert with check (auth.uid() = user_id);

create policy "Admins can view all questions" on generated_questions
  for select using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Activity Log Table
create table activity_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table activity_log enable row level security;

create policy "Users can view own logs" on activity_log
  for select using (auth.uid() = user_id);

create policy "Users can insert own logs" on activity_log
  for insert with check (auth.uid() = user_id);

create policy "Admins can view all logs" on activity_log
  for select using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, password_text, must_change_password)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    coalesce(new.raw_user_meta_data->>'password_text', '123456'),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
