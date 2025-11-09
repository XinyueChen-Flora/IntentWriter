-- Create documents table
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create document_collaborators table
create table if not exists public.document_collaborators (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('owner', 'editor', 'viewer')) not null default 'editor',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(document_id, user_id)
);

-- Create profiles table for user information
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.documents enable row level security;
alter table public.document_collaborators enable row level security;
alter table public.profiles enable row level security;

-- Policies for documents
create policy "Users can view documents they own"
  on public.documents for select
  using (auth.uid() = owner_id);

create policy "Users can create their own documents"
  on public.documents for insert
  with check (auth.uid() = owner_id);

create policy "Users can update documents they own"
  on public.documents for update
  using (auth.uid() = owner_id);

create policy "Users can delete documents they own"
  on public.documents for delete
  using (auth.uid() = owner_id);

-- Policies for document_collaborators
create policy "Users can view collaborators of documents they have access to"
  on public.document_collaborators for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.documents
      where id = document_id
      and owner_id = auth.uid()
    )
  );

create policy "Document owners can add collaborators"
  on public.document_collaborators for insert
  with check (
    exists (
      select 1 from public.documents
      where id = document_id
      and owner_id = auth.uid()
    )
  );

create policy "Document owners can remove collaborators"
  on public.document_collaborators for delete
  using (
    exists (
      select 1 from public.documents
      where id = document_id
      and owner_id = auth.uid()
    )
  );

-- Policies for profiles
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user creation
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger set_updated_at
  before update on public.documents
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
