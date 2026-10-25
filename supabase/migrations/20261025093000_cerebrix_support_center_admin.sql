-- CEREBRIX private support tickets and designated administrator access.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['student'::text,'teacher'::text,'admin'::text]));

update public.profiles
set role='admin', display_name=coalesce(nullif(display_name,''),'Leo'), updated_at=now()
where id='e82cff56-e81d-46da-b73f-5136c5201293'
  and lower((select email from auth.users where id='e82cff56-e81d-46da-b73f-5136c5201293'))='astryxleo@gmail.com';

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  requester_name text not null default '',
  requester_role text not null check (requester_role in ('student','teacher')),
  category text not null check (category in ('Account & login','Assessment / submission','Grades & feedback','Technical issue','Classroom / roster','Other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  subject text not null check (char_length(trim(subject)) between 4 and 140),
  message text not null check (char_length(trim(message)) between 10 and 6000),
  attachment_paths text[] not null default '{}',
  status text not null default 'open' check (status in ('open','in_progress','waiting_for_user','resolved','closed')),
  admin_reply text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_tickets_created_at_idx on public.support_tickets(created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id,created_at desc);
alter table public.support_tickets enable row level security;
create policy "Users create their own support tickets" on public.support_tickets for insert to authenticated
with check (requester_id=(select auth.uid()) and lower(requester_email)=lower((select auth.jwt()->>'email')) and requester_role in ('student','teacher'));
create policy "Requesters and designated administrator read tickets" on public.support_tickets for select to authenticated
using (requester_id=(select auth.uid()) or lower((select auth.jwt()->>'email'))='astryxleo@gmail.com');
create policy "Only designated administrator updates tickets" on public.support_tickets for update to authenticated
using (lower((select auth.jwt()->>'email'))='astryxleo@gmail.com')
with check (lower((select auth.jwt()->>'email'))='astryxleo@gmail.com');
grant select, insert, update on public.support_tickets to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-screenshots','support-screenshots',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
create policy "Support users upload their own screenshots" on storage.objects for insert to authenticated
with check (bucket_id='support-screenshots' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Support users and administrator read screenshots" on storage.objects for select to authenticated
using (bucket_id='support-screenshots' and ((storage.foldername(name))[1]=(select auth.uid())::text or lower((select auth.jwt()->>'email'))='astryxleo@gmail.com'));
create policy "Support users delete their own screenshots" on storage.objects for delete to authenticated
using (bucket_id='support-screenshots' and (storage.foldername(name))[1]=(select auth.uid())::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
