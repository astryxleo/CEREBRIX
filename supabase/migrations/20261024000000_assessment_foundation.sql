-- CEREBRIX assessment foundation.
-- Review and apply only to the dedicated CEREBRIX Supabase project.
-- This migration is committed to the repository; it is NOT applied to a database by GitHub.

create extension if not exists pgcrypto;

-- A profile row is not an authorization source until its role is assigned by a trusted operator.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert on public.profiles to authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists "Users create student profiles" on public.profiles;
create policy "Users create student profiles"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and role = 'student');
drop policy if exists "Users update their profile details" on public.profiles;
create policy "Users update their profile details"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  subject text not null default 'Mixed',
  instructions text not null default '',
  duration_minutes integer not null default 45 check (duration_minutes between 1 and 600),
  opens_at timestamptz,
  closes_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_window_valid check (
    opens_at is null or closes_at is null or closes_at > opens_at
  )
);

create index if not exists assessments_teacher_created_idx
  on public.assessments (teacher_id, created_at desc);
create index if not exists assessments_status_window_idx
  on public.assessments (status, opens_at, closes_at);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  position integer not null check (position > 0),
  kind text not null check (kind in ('Python', 'MySQL', 'CSV', 'TXT', 'Binary', 'Theory')),
  title text not null default '',
  prompt text not null check (char_length(trim(prompt)) > 0),
  marks numeric(8,2) not null default 5 check (marks > 0),
  starter_content text not null default '',
  dataset text not null default '',
  created_at timestamptz not null default now(),
  unique (assessment_id, position)
);

create index if not exists assessment_questions_assessment_idx
  on public.assessment_questions (assessment_id, position);

-- Keep answer keys in a separate table: RLS is row-level and cannot hide a column
-- from students who are allowed to read the corresponding question row.
create table if not exists public.assessment_question_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  reference_answer text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  started_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (assessment_id, student_id),
  constraint submission_timestamp_valid check (
    (status = 'in_progress' and submitted_at is null)
    or (status = 'submitted' and submitted_at is not null)
  )
);

create index if not exists assessment_submissions_assessment_idx
  on public.assessment_submissions (assessment_id, status, submitted_at);
create index if not exists assessment_submissions_student_idx
  on public.assessment_submissions (student_id, last_saved_at desc);

-- Grades are separate so student submission policies cannot grant access to scores.
create table if not exists public.assessment_grades (
  submission_id uuid primary key references public.assessment_submissions(id) on delete cascade,
  graded_by uuid not null references auth.users(id),
  score numeric(8,2) not null check (score >= 0),
  feedback text not null default '',
  graded_at timestamptz not null default now()
);

alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_question_keys enable row level security;
alter table public.assessment_submissions enable row level security;
alter table public.assessment_grades enable row level security;

-- Teachers can manage only assessments they own.
drop policy if exists "Teachers manage their assessments" on public.assessments;
create policy "Teachers manage their assessments"
  on public.assessments for all to authenticated
  using (
    (select auth.uid()) = teacher_id
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher')
  )
  with check (
    (select auth.uid()) = teacher_id
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'teacher')
  );

-- Students may see only currently available assessments. Teachers can see their own
-- assessments, including drafts and reference answers via the separate question policy.
drop policy if exists "Students read available assessments" on public.assessments;
create policy "Students read available assessments"
  on public.assessments for select to authenticated
  using (
    status in ('scheduled', 'published')
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at > now())
  );

drop policy if exists "Teachers manage their assessment questions" on public.assessment_questions;
create policy "Teachers manage their assessment questions"
  on public.assessment_questions for all to authenticated
  using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.teacher_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.teacher_id = (select auth.uid())
  ));

-- Students see question prompts only while the parent assessment is available.
-- Reference answers are stored separately in assessment_question_keys.
drop policy if exists "Students read available question prompts" on public.assessment_questions;
create policy "Students read available question prompts"
  on public.assessment_questions for select to authenticated
  using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id
      and a.status in ('scheduled', 'published')
      and (a.opens_at is null or a.opens_at <= now())
      and (a.closes_at is null or a.closes_at > now())
  ));

drop policy if exists "Teachers manage answer keys for their assessments" on public.assessment_question_keys;
create policy "Teachers manage answer keys for their assessments"
  on public.assessment_question_keys for all to authenticated
  using (exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = question_id and a.teacher_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = question_id and a.teacher_id = (select auth.uid())
  ));

-- Submissions are visible to their student and to the assessment's owning teacher.
drop policy if exists "Students read their submissions" on public.assessment_submissions;
create policy "Students read their submissions"
  on public.assessment_submissions for select to authenticated
  using (student_id = (select auth.uid()));

drop policy if exists "Teachers read submissions for their assessments" on public.assessment_submissions;
create policy "Teachers read submissions for their assessments"
  on public.assessment_submissions for select to authenticated
  using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.teacher_id = (select auth.uid())
  ));

drop policy if exists "Students start submissions for available assessments" on public.assessment_submissions;
create policy "Students start submissions for available assessments"
  on public.assessment_submissions for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'in_progress'
    and submitted_at is null
    and exists (
      select 1 from public.assessments a
      where a.id = assessment_id
        and a.status in ('scheduled', 'published')
        and (a.opens_at is null or a.opens_at <= now())
        and (a.closes_at is null or a.closes_at > now())
    )
  );

-- Keep student edits to answer content only; score/feedback live in a separate table.
-- Prevent a student from moving an attempt to another assessment or forging its timestamps.
create or replace function public.guard_assessment_submission_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $
begin
  if new.student_id <> old.student_id
     or new.assessment_id <> old.assessment_id
     or new.started_at <> old.started_at then
    raise exception 'Submission identity fields cannot be changed';
  end if;
  if old.status = 'in_progress' and new.status = 'submitted' then
    new.submitted_at := now();
  else
    new.submitted_at := null;
  end if;
  new.last_saved_at := now();
  return new;
end;
$;

drop trigger if exists guard_assessment_submission_update on public.assessment_submissions;
create trigger guard_assessment_submission_update
  before update on public.assessment_submissions
  for each row execute function public.guard_assessment_submission_update();

drop policy if exists "Students save their in progress answers" on public.assessment_submissions;
create policy "Students save their in progress answers"
  on public.assessment_submissions for update to authenticated
  using (
    student_id = (select auth.uid())
    and status = 'in_progress'
    and submitted_at is null
  )
  with check (
    student_id = (select auth.uid())
    and status in ('in_progress', 'submitted')
    and (status <> 'submitted' or submitted_at is not null)
  );

drop policy if exists "Teachers manage grades for their assessments" on public.assessment_grades;
create policy "Teachers manage grades for their assessments"
  on public.assessment_grades for all to authenticated
  using (exists (
    select 1
    from public.assessment_submissions s
    join public.assessments a on a.id = s.assessment_id
    where s.id = submission_id and a.teacher_id = (select auth.uid())
  ))
  with check (
    graded_by = (select auth.uid())
    and exists (
      select 1
      from public.assessment_submissions s
      join public.assessments a on a.id = s.assessment_id
      where s.id = submission_id and a.teacher_id = (select auth.uid())
    )
  );

-- No student policy exists for grades, so grade rows remain teacher-only.
