-- Run in Supabase SQL Editor when moving to production

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
  staff_id text not null references staff(id),
  staff_name text not null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  created_at timestamptz default now()
);

create index if not exists shifts_staff_id_idx on shifts(staff_id);
create index if not exists shifts_clock_in_idx on shifts(clock_in);
