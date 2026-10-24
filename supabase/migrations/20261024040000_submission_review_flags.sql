alter table public.assessment_submissions
  add column if not exists reviewed_questions jsonb not null default '[]'::jsonb;
