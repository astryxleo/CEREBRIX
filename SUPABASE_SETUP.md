# CEREBRIX Supabase setup

## Connected backend

The CEREBRIX Supabase project is configured in Vercel with these **public client** variables for Production, Preview, and Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never add a Supabase service-role or secret key to a `VITE_*` variable.

## Database

The live project contains the profiles, assessments, questions, separate teacher answer keys, submissions, grades, and class roster tables. Row Level Security is enabled on these tables. The assessment migration is in `supabase/migrations/`.

## Roles

New accounts are created as **Student**. Teacher access is intentionally not self-selectable in the public sign-up form. To promote a known account, open the Supabase SQL Editor and run the following after replacing the email with the intended teacher's login email:

```sql
update public.profiles p
set role = 'teacher', updated_at = now()
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('TEACHER_LOGIN_EMAIL');
```

Verify the affected row before running this query. Do not promote an unknown or shared test account.

## Auth URL configuration

In Supabase Authentication URL Configuration, set the Site URL to the production domain, and add your production and preview Vercel domains to the allowed redirect URLs. Confirm the email confirmation template redirects back to the app.

## Recommended security setting

The Supabase security advisor reports that leaked-password protection is disabled. Enable leaked-password protection in Authentication password/security settings before using this for real student accounts.

## Current product boundaries

- Assessment creation, questions, answer keys, submissions, grading, analytics, and teacher-owned roster records are wired to Supabase in the app.
- Code execution is not enabled. Python/MySQL answers are stored as text and need an isolated server-side sandbox before automatic execution or grading.
- The class roster stores teacher-entered records; adding a roster entry does not invite a student or create an Auth account.
- Server-side timing is still a follow-up hardening item; do not treat client timers as a proctoring/security boundary.
