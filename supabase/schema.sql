create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 1 and 120),
  title text not null check (char_length(title) between 1 and 120),
  location text not null check (char_length(location) between 1 and 120),
  employment_type text not null check (
    employment_type in ('Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship')
  ),
  salary_range text check (salary_range is null or char_length(salary_range) <= 100),
  description text not null check (char_length(description) between 1 and 5000),
  requirements text check (requirements is null or char_length(requirements) <= 3000),
  application_email text not null check (char_length(application_email) <= 254),
  application_url text check (application_url is null or char_length(application_url) <= 500),
  status text not null default 'pending_review' check (
    status in ('pending_review', 'published', 'rejected', 'closed')
  ),
  created_at timestamptz not null default now()
);

create index if not exists job_postings_public_order_idx
  on public.job_postings (status, created_at desc);

create index if not exists job_postings_email_created_idx
  on public.job_postings (application_email, created_at desc);

alter table public.job_postings enable row level security;

revoke all on public.job_postings from anon, authenticated;
grant all on public.job_postings to service_role;
