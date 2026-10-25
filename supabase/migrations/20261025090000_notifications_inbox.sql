create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('submission_received','grade_published','workspace_update')),
  title text not null,
  message text not null,
  assessment_id uuid references public.assessments(id) on delete cascade,
  submission_id uuid references public.assessment_submissions(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(recipient_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.notify_teacher_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_user_id uuid;
  assessment_title text;
begin
  if new.status <> 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  select a.teacher_id, a.title
    into teacher_user_id, assessment_title
    from public.assessments a
   where a.id = new.assessment_id;

  if teacher_user_id is not null and teacher_user_id <> new.student_id then
    insert into public.notifications(recipient_id, actor_id, kind, title, message, assessment_id, submission_id)
    values (
      teacher_user_id, new.student_id, 'submission_received',
      'New student submission',
      'A student submitted "' || coalesce(assessment_title, 'an assessment') || '". It is ready for review.',
      new.assessment_id, new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_submission_notification on public.assessment_submissions;
create trigger assessment_submission_notification
  after insert or update of status on public.assessment_submissions
  for each row execute function public.notify_teacher_on_submission();

create or replace function public.notify_student_on_grade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_user_id uuid;
  assessment_title text;
begin
  select s.student_id, a.title
    into student_user_id, assessment_title
    from public.assessment_submissions s
    join public.assessments a on a.id = s.assessment_id
   where s.id = new.submission_id;

  if student_user_id is not null and student_user_id <> new.graded_by then
    insert into public.notifications(recipient_id, actor_id, kind, title, message, assessment_id, submission_id)
    values (
      student_user_id, new.graded_by, 'grade_published',
      'Your assessment has been graded',
      'Your score for "' || coalesce(assessment_title, 'your assessment') || '" is ' || new.score::text || ' marks. Open My analytics to review your teacher feedback.',
      (select s.assessment_id from public.assessment_submissions s where s.id = new.submission_id),
      new.submission_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_grade_notification on public.assessment_grades;
create trigger assessment_grade_notification
  after insert or update of score, feedback on public.assessment_grades
  for each row execute function public.notify_student_on_grade();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
