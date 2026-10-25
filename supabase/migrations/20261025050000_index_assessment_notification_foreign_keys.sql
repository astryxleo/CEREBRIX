-- Add covering indexes for foreign keys flagged by the Supabase performance advisor.
create index if not exists assessment_grades_graded_by_idx on public.assessment_grades (graded_by);
create index if not exists assessment_integrity_events_assessment_id_idx on public.assessment_integrity_events (assessment_id);
create index if not exists assessment_integrity_events_student_id_idx on public.assessment_integrity_events (student_id);
create index if not exists class_roster_student_id_idx on public.class_roster (student_id);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists notifications_assessment_id_idx on public.notifications (assessment_id);
create index if not exists notifications_submission_id_idx on public.notifications (submission_id);
