-- Restrict assessment question formats to the four supported types.
-- Normalize legacy unsupported formats before enforcing the constraint.
update public.assessment_questions
set kind = 'Theory'
where kind not in ('Python', 'MySQL', 'MCQ', 'Theory');

alter table public.assessment_questions
  drop constraint if exists assessment_questions_kind_check;

alter table public.assessment_questions
  add constraint assessment_questions_kind_check
  check (kind = any (array['Python'::text, 'MySQL'::text, 'MCQ'::text, 'Theory'::text]));
