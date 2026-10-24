create table if not exists public.class_roster (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  email text not null check (char_length(trim(email)) <= 254),
  class_name text not null default 'Unassigned' check (char_length(trim(class_name)) between 1 and 80),
  added_at timestamptz not null default now()
);
create unique index if not exists class_roster_teacher_email_unique
  on public.class_roster (teacher_id, lower(email))
  where trim(email) <> '';
create index if not exists class_roster_teacher_added_idx
  on public.class_roster (teacher_id, added_at desc);
alter table public.class_roster enable row level security;
grant select, insert, update, delete on public.class_roster to authenticated;
drop policy if exists "Teachers manage their own class roster" on public.class_roster;
create policy "Teachers manage their own class roster"
  on public.class_roster for all to authenticated
  using (
    teacher_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher')
  )
  with check (
    teacher_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher')
  );
