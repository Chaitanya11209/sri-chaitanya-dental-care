-- ============================================================
-- Sri Chaitanya Dental Care — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── PATIENTS ────────────────────────────────────────────────
create table if not exists patients (
  id             bigserial primary key,
  patient_code   text unique,
  name           text not null,
  phone          text,
  email          text,
  location       text,
  age            text,
  gender         text,
  notes          text,
  patient_status text default 'Registered',
  created_at     timestamptz default now()
);

-- ── APPOINTMENTS ─────────────────────────────────────────────
create table if not exists appointments (
  id               bigserial primary key,
  patient_id       bigint references patients(id) on delete set null,
  name             text,
  phone            text,
  email            text,
  treatment        text,
  next_visit       date,
  appointment_time text,
  location         text,
  notes            text,
  status           text default 'Pending',
  visit_count      int  default 1,
  visit_type       text default 'New',
  amount_paid      numeric default 0,
  balance_amount   numeric default 0,
  payment_mode     text default 'Cash',
  payment_notes    text,
  created_at       timestamptz default now()
);

-- ── TREATMENTS ───────────────────────────────────────────────
create table if not exists treatments (
  id                 bigserial primary key,
  patient_name       text,
  phone              text,
  treatment_type     text,
  stage              text default 'Assessment',
  start_date         date,
  expected_end_date  date,
  total_sessions     int,
  sessions_done      int  default 0,
  treatment_notes    text,
  doctor_notes       text,
  created_at         timestamptz default now()
);

-- ── STAFF ROLES (for Supabase Auth) ──────────────────────────
-- After creating users in Supabase Auth dashboard, insert their
-- UUID here to assign a role. Roles: 'admin' | 'staff'
--
-- Example:
--   insert into staff_roles (user_id, role, name)
--   values ('uuid-from-auth-dashboard', 'admin', 'Dr. Admin');
--
create table if not exists staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'staff' check (role in ('admin', 'staff')),
  name    text not null,
  created_at timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_appointments_next_visit  on appointments(next_visit);
create index if not exists idx_appointments_status      on appointments(status);
create index if not exists idx_appointments_patient_id  on appointments(patient_id);
create index if not exists idx_appointments_phone       on appointments(phone);
create index if not exists idx_patients_phone           on patients(phone);
create index if not exists idx_patients_name            on patients(name);
create index if not exists idx_patients_status          on patients(patient_status);

-- ── MIGRATIONS (safe to re-run) ───────────────────────────────
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='patients' and column_name='patient_status'
  ) then
    alter table patients add column patient_status text default 'Registered';
  end if;
end $$;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table patients     enable row level security;
alter table appointments enable row level security;
alter table treatments   enable row level security;
alter table staff_roles  enable row level security;

drop policy if exists "anon full access - patients"     on patients;
drop policy if exists "anon full access - appointments" on appointments;
drop policy if exists "anon full access - treatments"   on treatments;
drop policy if exists "auth users read staff_roles"     on staff_roles;

create policy "anon full access - patients"
  on patients for all to anon using (true) with check (true);

create policy "anon full access - appointments"
  on appointments for all to anon using (true) with check (true);

create policy "anon full access - treatments"
  on treatments for all to anon using (true) with check (true);

-- Staff roles readable only by authenticated users (for role lookup after login)
create policy "auth users read staff_roles"
  on staff_roles for select to authenticated using (true);
