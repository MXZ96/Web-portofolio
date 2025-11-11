-- Supabase SQL: create tables for the portfolio app

-- Enable the pgcrypto extension for uuid generation (if not enabled)
create extension if not exists pgcrypto;

-- ABOUT: single row table
create table if not exists about (
  id int primary key default 1,
  content text,
  updated_at timestamptz default now()
);

-- SKILLS
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- EXPERIENCE
create table if not exists experiences (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text,
  description text,
  created_at timestamptz default now()
);

-- PROJECTS
create table if not exists projects (
  id text primary key,
  title text not null,
  description text,
  image_url text,
  link text,
  created_at timestamptz default now()
);

-- OPTIONAL: simple RLS policies (only if you enable RLS)
-- To enable RLS and allow authenticated users to insert/update/delete, run below:
-- alter table skills enable row level security;
-- create policy "authenticated_modify" on skills
--   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Repeat policy creation per table as needed.

-- Storage: create a bucket named 'assets' using the Supabase Storage UI. Set public or use signed URLs.

-- Seed a default about row
insert into about (id, content) values (1, 'Tulis tentang dirimu di sini — ganti lewat UI setelah deploy.') on conflict (id) do nothing;
