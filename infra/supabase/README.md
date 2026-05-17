# Supabase Setup

StudyNova will use Supabase for authentication and PostgreSQL data storage.

## First Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `infra/supabase/schema.sql`.
4. Copy the project URL and anon key into the mobile environment later.
5. Copy the project URL and service role key into the API environment.

## Auth Model

- A user signs in through Supabase Auth.
- Each user has one `profiles` row.
- `profiles.role` determines whether the app shows student, parent, teacher, or admin features.
- Parent access is controlled through `parent_student_links`.

## Security Direction

The MVP API still uses in-memory progress data. The next backend milestone is to replace that store with Supabase queries and row-level security policies.

