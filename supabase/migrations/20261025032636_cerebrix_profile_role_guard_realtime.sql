-- Prevent users from changing their own role through profile updates.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role
     and lower(coalesce((select auth.jwt()->>'email'),'')) <> 'astryxleo@gmail.com' then
    raise exception 'Profile role changes are restricted to the designated administrator';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;
