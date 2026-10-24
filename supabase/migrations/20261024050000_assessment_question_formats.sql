alter table public.assessments
  add column if not exists negative_marking numeric not null default 0
  check (negative_marking >= 0 and negative_marking <= 1000);
alter table public.assessment_questions
  add column if not exists options jsonb not null default '[]'::jsonb;
do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'assessment_questions'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%kind%'
  limit 1;
  if constraint_name is not null then
    execute format('alter table public.assessment_questions drop constraint %I', constraint_name);
  end if;
end $$;
alter table public.assessment_questions
  add constraint assessment_questions_kind_check
  check (kind = any (array['Python','MySQL','CSV','TXT','Binary','Theory','MCQ','Debugging']));
