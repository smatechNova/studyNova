create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'studynova_role') then
    create type public.studynova_role as enum ('student', 'parent', 'teacher', 'admin');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.studynova_role not null,
  full_name text not null,
  school_name text default 'SMATECH High School',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  class_level text,
  exam_date date,
  available_daily_minutes integer not null default 180 check (available_daily_minutes between 30 and 720),
  created_at timestamptz not null default now()
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (parent_profile_id, student_profile_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  pages integer not null check (pages > 0),
  priority integer not null default 3 check (priority between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  exam_date date not null,
  metadata jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid references public.study_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  kind text not null check (kind in ('study', 'revision')),
  scheduled_date date not null,
  planned_minutes integer not null check (planned_minutes > 0),
  completed_minutes integer not null default 0 check (completed_minutes >= 0),
  status text not null default 'planned' check (status in ('planned', 'completed', 'missed')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_check_ins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  study_date date not null,
  minutes_completed integer not null default 0 check (minutes_completed >= 0),
  sessions_completed integer not null default 0 check (sessions_completed >= 0),
  sessions_planned integer not null default 0 check (sessions_planned >= 0),
  note text default '',
  created_at timestamptz not null default now(),
  unique (student_id, study_date)
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_check_ins enable row level security;

create policy "profiles can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "students can read their own student row"
  on public.students for select
  using (auth.uid() = profile_id);

create policy "students can manage their subjects"
  on public.subjects for all
  using (
    exists (
      select 1 from public.students
      where students.id = subjects.student_id
      and students.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students
      where students.id = subjects.student_id
      and students.profile_id = auth.uid()
    )
  );

create policy "students can manage their topics"
  on public.topics for all
  using (
    exists (
      select 1
      from public.subjects
      join public.students on students.id = subjects.student_id
      where subjects.id = topics.subject_id
      and students.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.subjects
      join public.students on students.id = subjects.student_id
      where subjects.id = topics.subject_id
      and students.profile_id = auth.uid()
    )
  );

create policy "linked parents can read student check-ins"
  on public.study_check_ins for select
  using (
    exists (
      select 1
      from public.students
      join public.parent_student_links links on links.student_profile_id = students.profile_id
      where students.id = study_check_ins.student_id
      and links.parent_profile_id = auth.uid()
      and links.status = 'active'
    )
  );

