-- Run once in Supabase → SQL Editor (café Wi-Fi IP can then be updated from Manager panel)

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;
