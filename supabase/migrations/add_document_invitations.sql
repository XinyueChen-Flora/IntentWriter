-- Document invitations table
create table public.document_invitations (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  email text not null,
  role text check (role in ('editor', 'viewer')) not null default 'editor',
  token uuid default gen_random_uuid() not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  status text check (status in ('pending', 'accepted', 'expired')) not null default 'pending',
  created_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '7 days') not null,
  unique(document_id, email)
);

alter table public.document_invitations enable row level security;

-- RLS: document owners can select invitations for their documents
create policy "Owners can view invitations"
  on public.document_invitations for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_invitations.document_id
        and documents.owner_id = auth.uid()
    )
  );

-- RLS: document owners can insert invitations
create policy "Owners can create invitations"
  on public.document_invitations for insert
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_invitations.document_id
        and documents.owner_id = auth.uid()
    )
  );

-- RLS: document owners can update invitations
create policy "Owners can update invitations"
  on public.document_invitations for update
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_invitations.document_id
        and documents.owner_id = auth.uid()
    )
  );

-- RLS: document owners can delete invitations
create policy "Owners can delete invitations"
  on public.document_invitations for delete
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_invitations.document_id
        and documents.owner_id = auth.uid()
    )
  );

-- RLS fix: allow users to add themselves as collaborators
create policy "Users can add themselves as collaborators"
  on public.document_collaborators for insert
  with check (user_id = auth.uid());

-- Trigger: when a new profile is created, auto-accept any matching pending invitations
create or replace function public.handle_pending_invitations()
returns trigger as $$
begin
  -- Find all pending, non-expired invitations for this email
  -- and insert the user as a collaborator
  insert into public.document_collaborators (document_id, user_id, role)
  select di.document_id, new.id, di.role
  from public.document_invitations di
  where di.email = new.email
    and di.status = 'pending'
    and di.expires_at > now()
  on conflict (document_id, user_id) do nothing;

  -- Mark those invitations as accepted
  update public.document_invitations
  set status = 'accepted'
  where email = new.email
    and status = 'pending'
    and expires_at > now();

  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created_check_invitations
  after insert on public.profiles
  for each row execute procedure public.handle_pending_invitations();
