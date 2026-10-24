create table if not exists public.assessment_integrity_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  submission_id uuid not null references public.assessment_submissions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('tab-hidden','print-screen','devtools-shortcut','context-menu','clipboard')),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists assessment_integrity_events_submission_time_idx
  on public.assessment_integrity_events (submission_id, occurred_at desc);
alter table public.assessment_integrity_events enable row level security;
grant select, insert on public.assessment_integrity_events to authenticated;
drop policy if exists "Students log their own assessment integrity events" on public.assessment_integrity_events;
create policy "Students log their own assessment integrity events"
  on public.assessment_integrity_events for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.assessment_submissions s
      where s.id = submission_id
        and s.student_id = (select auth.uid())
        and s.assessment_id = assessment_id
    )
  );
drop policy if exists "Students read their own assessment integrity events" on public.assessment_integrity_events;
create policy "Students read their own assessment integrity events"
  on public.assessment_integrity_events for select to authenticated
  using (student_id = (select auth.uid()));
drop policy if exists "Teachers read integrity events for their assessments" on public.assessment_integrity_events;
create policy "Teachers read integrity events for their assessments"
  on public.assessment_integrity_events for select to authenticated
  using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.teacher_id = (select auth.uid())
    )
  );
