-- Run this once in Supabase SQL Editor (safe if already applied)

create unique index if not exists shifts_one_open_per_staff
  on shifts (staff_id) where clock_out is null;
