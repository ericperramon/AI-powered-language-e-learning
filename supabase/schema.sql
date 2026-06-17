-- =========================================================
-- SCHEMA.SQL - Plataforma E-learning IA B2B
-- Supabase / PostgreSQL
-- =========================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- =========================================================
-- ENUMS
-- =========================================================

create type public.user_role as enum ('admin', 'alumno', 'superadmin');
create type public.lesson_type as enum ('video', 'text', 'exercise', 'mixed', 'exam');
create type public.exercise_type as enum ('test', 'writing', 'speaking', 'fill_blank', 'audio', 'conversation');
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.enrollment_status as enum ('active', 'completed', 'expired', 'cancelled');
create type public.certificate_status as enum ('draft', 'issued', 'revoked');

-- =========================================================
-- COMMON UPDATED_AT FUNCTION
-- =========================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- COMPANIES
-- =========================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- =========================================================
-- PROFILES / EMPLOYEES
-- Linked to Supabase Auth
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  full_name text,
  -- Pending decision: enforce email-only Auth or support phone/social users without email.
  email text,
  role public.user_role not null default 'alumno',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_unique unique (email)
);

create index profiles_company_id_idx on public.profiles(company_id);
create index profiles_role_idx on public.profiles(role);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- COURSES
-- =========================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  origin_language text,
  target_language text not null,
  level text,
  is_active boolean not null default true,
  thumbnail_url text,
  estimated_duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

-- =========================================================
-- COMPANY COURSE PACKAGES / PURCHASES
-- Example: company buys 5 licenses for one course
-- =========================================================

create table public.company_course_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  purchased_licenses integer not null check (purchased_licenses > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_course_packages_company_idx on public.company_course_packages(company_id);
create index company_course_packages_course_idx on public.company_course_packages(course_id);

create trigger company_course_packages_set_updated_at
before update on public.company_course_packages
for each row execute function public.set_updated_at();

-- =========================================================
-- COURSE ACCESS KEYS
-- 1 key = 1 employee = 1 course
-- =========================================================

create table public.course_access_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  package_id uuid references public.company_course_packages(id) on delete set null,

  code text not null unique,

  expires_at timestamptz not null default (now() + interval '1 year'),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Pending decision: enforce purchased license consumption with a transactional key-generation RPC.
  constraint key_can_only_be_used_once check (
    (used_at is null and used_by is null)
    or
    (used_at is not null and used_by is not null)
  )
);

create index course_access_keys_company_idx on public.course_access_keys(company_id);
create index course_access_keys_course_idx on public.course_access_keys(course_id);
create index course_access_keys_used_by_idx on public.course_access_keys(used_by);

-- =========================================================
-- COURSE STRUCTURE
-- =========================================================

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null,
  is_locked_by_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint units_course_sort_unique unique (course_id, sort_order)
);

create index units_course_idx on public.units(course_id);

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  description text,
  lesson_type public.lesson_type not null default 'mixed',
  sort_order integer not null,

  video_url text,
  pdf_url text,
  content_json jsonb not null default '{}'::jsonb,

  requires_exam boolean not null default false,
  minimum_score_to_pass numeric(5,2) default 80,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lessons_unit_sort_unique unique (unit_id, sort_order)
);

create index lessons_unit_idx on public.lessons(unit_id);
create index lessons_content_json_idx on public.lessons using gin(content_json);

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

-- =========================================================
-- ENROLLMENTS
-- User enrolled in course through a key
-- =========================================================

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  access_key_id uuid references public.course_access_keys(id) on delete set null,

  status public.enrollment_status not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,

  progress_percentage numeric(5,2) not null default 0,
  total_time_seconds integer not null default 0,
  last_lesson_id uuid references public.lessons(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint enrollments_unique_user_course unique (employee_id, course_id)
);

create index enrollments_employee_idx on public.enrollments(employee_id);
create index enrollments_company_idx on public.enrollments(company_id);
create index enrollments_course_idx on public.enrollments(course_id);

create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

-- =========================================================
-- PROGRESS BY UNIT / LESSON
-- =========================================================

create table public.unit_progress (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,

  is_unlocked boolean not null default false,
  is_completed boolean not null default false,
  progress_percentage numeric(5,2) not null default 0,
  total_time_seconds integer not null default 0,

  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint unit_progress_unique unique (employee_id, unit_id)
);

create index unit_progress_employee_idx on public.unit_progress(employee_id);
create index unit_progress_course_idx on public.unit_progress(course_id);

create trigger unit_progress_set_updated_at
before update on public.unit_progress
for each row execute function public.set_updated_at();

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,

  is_unlocked boolean not null default false,
  video_completed boolean not null default false,
  exercises_completed boolean not null default false,
  exam_passed boolean not null default false,
  is_completed boolean not null default false,

  score numeric(5,2),
  total_time_seconds integer not null default 0,

  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint lesson_progress_unique unique (employee_id, lesson_id)
);

create index lesson_progress_employee_idx on public.lesson_progress(employee_id);
create index lesson_progress_course_idx on public.lesson_progress(course_id);
create index lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row execute function public.set_updated_at();

-- =========================================================
-- EXERCISES
-- =========================================================

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  exercise_type public.exercise_type not null,
  sort_order integer not null,

  content_json jsonb not null default '{}'::jsonb,
  correct_answer_json jsonb,
  is_ai_corrected boolean not null default false,
  minimum_score_to_pass numeric(5,2) default 80,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exercises_lesson_sort_unique unique (lesson_id, sort_order)
);

create index exercises_lesson_idx on public.exercises(lesson_id);
create index exercises_content_json_idx on public.exercises using gin(content_json);

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,

  attempt_number integer not null default 1,
  answer_json jsonb not null default '{}'::jsonb,

  score numeric(5,2),
  passed boolean not null default false,
  ai_feedback text,
  ai_analysis_json jsonb not null default '{}'::jsonb,

  time_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index exercise_attempts_employee_idx on public.exercise_attempts(employee_id);
create index exercise_attempts_exercise_idx on public.exercise_attempts(exercise_id);
create index exercise_attempts_course_idx on public.exercise_attempts(course_id);

-- =========================================================
-- AI ASSISTANT
-- Recommended MVP: store summaries, not every message forever
-- =========================================================

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,

  title text,
  summary text,
  strengths text,
  weaknesses text,
  recommendations text,
  memory_json jsonb not null default '{}'::jsonb,

  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_employee_idx on public.ai_conversations(employee_id);
create index ai_conversations_course_idx on public.ai_conversations(course_id);

create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,

  role public.message_role not null,
  content text not null,

  audio_url text,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index ai_messages_conversation_idx on public.ai_messages(conversation_id);
create index ai_messages_employee_idx on public.ai_messages(employee_id);
create index ai_messages_course_idx on public.ai_messages(course_id);

-- =========================================================
-- RAG / KNOWLEDGE BASE
-- =========================================================

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,

  title text not null,
  source_type text,
  source_url text,
  content text,

  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_documents_course_idx on public.knowledge_documents(course_id);

create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row execute function public.set_updated_at();

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,

  chunk_index integer not null,
  content text not null,

  -- Pending decision: adjust dimension depending on the selected embeddings model.
  -- 1536 is common for OpenAI text-embedding-3-small.
  embedding vector(1536),

  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index knowledge_chunks_document_idx on public.knowledge_chunks(document_id);
create index knowledge_chunks_course_idx on public.knowledge_chunks(course_id);

-- Optional vector index. Enable after having data.
-- create index knowledge_chunks_embedding_idx
-- on public.knowledge_chunks
-- using ivfflat (embedding vector_cosine_ops)
-- with (lists = 100);

-- =========================================================
-- CERTIFICATES
-- =========================================================

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,

  status public.certificate_status not null default 'draft',
  unique_code text not null unique,
  issued_at timestamptz,
  certificate_url text,
  linkedin_share_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint certificates_unique_user_course unique (employee_id, course_id)
);

create index certificates_employee_idx on public.certificates(employee_id);
create index certificates_company_idx on public.certificates(company_id);
create index certificates_course_idx on public.certificates(course_id);

create trigger certificates_set_updated_at
before update on public.certificates
for each row execute function public.set_updated_at();

-- =========================================================
-- ADMIN DASHBOARD VIEWS
-- =========================================================

create or replace view public.company_employee_progress
with (security_invoker = true)
as
select
  e.company_id,
  e.employee_id,
  p.full_name,
  p.email,
  e.course_id,
  c.title as course_title,
  e.status,
  e.progress_percentage,
  e.total_time_seconds,
  e.started_at,
  e.completed_at,
  e.updated_at
from public.enrollments e
join public.profiles p on p.id = e.employee_id
join public.courses c on c.id = e.course_id;

-- =========================================================
-- HELPER FUNCTIONS FOR RLS
-- =========================================================

create or replace function public.current_user_company_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  )
$$;

create or replace function public.current_company_has_course(p_course_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_course_packages p
    where p.company_id = public.current_user_company_id()
      and p.course_id = p_course_id
      and p.is_active = true
      and p.starts_at <= now()
      and p.expires_at >= now()
  )
$$;

-- =========================================================
-- REDEEM COURSE KEY
-- User redeems a key and gets enrolled
-- =========================================================

create or replace function public.redeem_course_key(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.course_access_keys;
  v_profile public.profiles;
  v_enrollment_id uuid;
begin
  select *
  into v_profile
  from public.profiles
  where id = auth.uid();

  if v_profile.id is null then
    raise exception 'User profile not found';
  end if;

  if not v_profile.is_active then
    raise exception 'User profile is inactive';
  end if;

  select *
  into v_key
  from public.course_access_keys
  where code = p_code
  for update;

  if v_key.id is null then
    raise exception 'Invalid key';
  end if;

  if v_key.used_at is not null then
    raise exception 'Key already used';
  end if;

  if v_key.expires_at < now() then
    raise exception 'Key expired';
  end if;

  if not exists (
    select 1
    from public.company_course_packages p
    where p.id = v_key.package_id
      and p.company_id = v_key.company_id
      and p.course_id = v_key.course_id
      and p.is_active = true
      and p.starts_at <= now()
      and p.expires_at >= now()
  ) then
    raise exception 'Course package is not active';
  end if;

  if v_profile.company_id is not null and v_profile.company_id <> v_key.company_id then
    raise exception 'Key belongs to another company';
  end if;

  update public.profiles
  set company_id = v_key.company_id,
      updated_at = now()
  where id = auth.uid()
    and company_id is null;

  update public.course_access_keys
  set used_at = now(),
      used_by = auth.uid()
  where id = v_key.id;

  insert into public.enrollments (
    employee_id,
    company_id,
    course_id,
    access_key_id,
    expires_at
  )
  values (
    auth.uid(),
    v_key.company_id,
    v_key.course_id,
    v_key.id,
    v_key.expires_at
  )
  returning id into v_enrollment_id;

  return v_enrollment_id;
end;
$$;

-- =========================================================
-- RLS
-- Supabase Auth + RLS
-- =========================================================

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.company_course_packages enable row level security;
alter table public.course_access_keys enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.unit_progress enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_attempts enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.certificates enable row level security;

-- PROFILES
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Company admins can read company profiles"
on public.profiles for select
to authenticated
using (
  public.is_company_admin()
  and company_id = public.current_user_company_id()
);

create policy "Users can update own limited profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- COMPANIES
create policy "Company admins can read own company"
on public.companies for select
to authenticated
using (
  public.is_company_admin()
  and id = public.current_user_company_id()
);

-- COURSES
-- Pending decision: keep the catalog global for all authenticated users or scope it by company.
create policy "Authenticated users can read active courses"
on public.courses for select
to authenticated
using (is_active = true);

-- COMPANY PACKAGES
create policy "Company admins can read own packages"
on public.company_course_packages for select
to authenticated
using (
  public.is_company_admin()
  and company_id = public.current_user_company_id()
);

-- ACCESS KEYS
create policy "Company admins can read own keys"
on public.course_access_keys for select
to authenticated
using (
  public.is_company_admin()
  and company_id = public.current_user_company_id()
);

create policy "Company admins can create keys"
on public.course_access_keys for insert
to authenticated
with check (
  public.is_company_admin()
  and company_id = public.current_user_company_id()
  and public.current_company_has_course(course_id)
  and package_id is not null
  and exists (
    select 1
    from public.company_course_packages p
    where p.id = package_id
      and p.company_id = course_access_keys.company_id
      and p.course_id = course_access_keys.course_id
      and p.is_active = true
      and p.starts_at <= now()
      and p.expires_at >= now()
  )
  and created_by = auth.uid()
);

-- COURSE CONTENT
create policy "Enrolled users can read units"
on public.units for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    where e.employee_id = auth.uid()
      and e.course_id = units.course_id
      and e.status = 'active'
  )
  or (
    public.is_company_admin()
    and public.current_company_has_course(units.course_id)
  )
);

create policy "Enrolled users can read lessons"
on public.lessons for select
to authenticated
using (
  exists (
    select 1
    from public.units u
    join public.enrollments e on e.course_id = u.course_id
    where u.id = lessons.unit_id
      and e.employee_id = auth.uid()
      and e.status = 'active'
  )
  or (
    public.is_company_admin()
    and exists (
      select 1
      from public.units u
      where u.id = lessons.unit_id
        and public.current_company_has_course(u.course_id)
    )
  )
);

create policy "Enrolled users can read exercises"
on public.exercises for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.units u on u.id = l.unit_id
    join public.enrollments e on e.course_id = u.course_id
    where l.id = exercises.lesson_id
      and e.employee_id = auth.uid()
      and e.status = 'active'
  )
  or (
    public.is_company_admin()
    and exists (
      select 1
      from public.lessons l
      join public.units u on u.id = l.unit_id
      where l.id = exercises.lesson_id
        and public.current_company_has_course(u.course_id)
    )
  )
);

-- ENROLLMENTS
create policy "Users can read own enrollments"
on public.enrollments for select
to authenticated
using (employee_id = auth.uid());

create policy "Company admins can read company enrollments"
on public.enrollments for select
to authenticated
using (
  public.is_company_admin()
  and company_id = public.current_user_company_id()
);

-- PROGRESS
create policy "Users can manage own unit progress"
on public.unit_progress for all
to authenticated
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

create policy "Users can manage own lesson progress"
on public.lesson_progress for all
to authenticated
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

create policy "Company admins can read unit progress"
on public.unit_progress for select
to authenticated
using (
  public.is_company_admin()
  and exists (
    select 1
    from public.profiles p
    where p.id = unit_progress.employee_id
      and p.company_id = public.current_user_company_id()
  )
);

create policy "Company admins can read lesson progress"
on public.lesson_progress for select
to authenticated
using (
  public.is_company_admin()
  and exists (
    select 1
    from public.profiles p
    where p.id = lesson_progress.employee_id
      and p.company_id = public.current_user_company_id()
  )
);

-- EXERCISE ATTEMPTS
create policy "Users can manage own exercise attempts"
on public.exercise_attempts for all
to authenticated
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

create policy "Company admins can read exercise attempts"
on public.exercise_attempts for select
to authenticated
using (
  public.is_company_admin()
  and exists (
    select 1
    from public.profiles p
    where p.id = exercise_attempts.employee_id
      and p.company_id = public.current_user_company_id()
  )
);

-- AI
-- Pending decision: whether company admins may inspect employee AI conversations or only aggregate metrics.
create policy "Users can manage own AI conversations"
on public.ai_conversations for all
to authenticated
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

create policy "Users can manage own AI messages"
on public.ai_messages for all
to authenticated
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

-- KNOWLEDGE BASE
-- RAG writes are intentionally left to service_role/server-side ingestion until an admin workflow exists.
create policy "Enrolled users can read course knowledge documents"
on public.knowledge_documents for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    where e.employee_id = auth.uid()
      and e.course_id = knowledge_documents.course_id
      and e.status = 'active'
  )
  or (
    public.is_company_admin()
    and public.current_company_has_course(knowledge_documents.course_id)
  )
);

create policy "Enrolled users can read course knowledge chunks"
on public.knowledge_chunks for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    where e.employee_id = auth.uid()
      and e.course_id = knowledge_chunks.course_id
      and e.status = 'active'
  )
  or (
    public.is_company_admin()
    and public.current_company_has_course(knowledge_chunks.course_id)
  )
);

-- CERTIFICATES
create policy "Users can read own certificates"
on public.certificates for select
to authenticated
using (employee_id = auth.uid());

create policy "Company admins can read company certificates"
on public.certificates for select
to authenticated
using (
  public.is_company_admin()
  and company_id = public.current_user_company_id()
);

-- =========================================================
-- GRANTS
-- =========================================================

grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- =========================================================
-- COURSE REQUESTS (public landing — no auth required)
-- =========================================================

create table public.course_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  sector text not null,
  created_at timestamptz not null default now()
);

alter table public.course_requests enable row level security;

-- Only service_role (admin client) can read; inserts are done server-side via admin client.

-- =========================================================
-- GRANTS
-- =========================================================

grant select on all tables in schema public to authenticated;
grant insert on public.course_access_keys to authenticated;
grant insert, update, delete on public.unit_progress to authenticated;
grant insert, update, delete on public.lesson_progress to authenticated;
grant insert, update, delete on public.exercise_attempts to authenticated;
grant insert, update, delete on public.ai_conversations to authenticated;
grant insert, update, delete on public.ai_messages to authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name, last_login_at) on public.profiles to authenticated;

grant execute on all functions in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
