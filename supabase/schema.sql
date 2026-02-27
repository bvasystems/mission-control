create extension if not exists pgcrypto;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null check (status in ('pending','done','blocked')) default 'pending',
  priority text not null check (priority in ('low','medium','high','critical')) default 'medium',
  created_at timestamptz not null default now(),
  due_date timestamptz,
  assigned_to text
);

create table if not exists memory_events (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  category text not null check (category in ('decision','lesson','insight')),
  content text not null,
  source text not null check (source in ('main','heartbeat','cron'))
);

create table if not exists cron_jobs (
  id text primary key,
  name text not null,
  schedule text not null,
  last_run timestamptz,
  next_run timestamptz,
  status text not null check (status in ('active','paused','error')) default 'active',
  last_result text
);

create table if not exists health_checks (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null check (status in ('healthy','degraded','down')),
  last_check timestamptz not null default now(),
  uptime_pct numeric(5,2)
);

create table if not exists agent_stats (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  messages_sent int not null default 0,
  skills_used int not null default 0,
  errors int not null default 0,
  model_tokens_used int not null default 0,
  uptime_hours numeric(6,2) not null default 0,
  unique(date)
);
