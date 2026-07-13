-- Run once in Supabase → SQL Editor → New query → Run

create table if not exists staff (
  id text primary key,
  name text not null,
  phone text not null unique,
  created_at timestamptz default now()
);

create table if not exists pending (
  id text primary key,
  name text not null,
  phone text not null,
  code text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists shifts (
  id text primary key,
  staff_id text not null references staff(id) on delete cascade,
  staff_name text not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  created_at timestamptz default now()
);

create index if not exists shifts_staff_id_idx on shifts(staff_id);
create index if not exists shifts_clock_in_idx on shifts(clock_in);
create index if not exists pending_phone_idx on pending(phone);

-- Only one open (clocked-in) shift per staff member
create unique index if not exists shifts_one_open_per_staff
  on shifts (staff_id) where clock_out is null;

alter table staff enable row level security;
alter table pending enable row level security;
alter table shifts enable row level security;
