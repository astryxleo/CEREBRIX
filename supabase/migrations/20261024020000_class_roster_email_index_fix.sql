drop index if exists public.class_roster_teacher_email_unique;
create unique index class_roster_teacher_email_unique
  on public.class_roster (teacher_id, lower(email))
  where trim(email) <> '';
