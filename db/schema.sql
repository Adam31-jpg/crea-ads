-- ============================================================
-- LUMINA DATABASE SCHEMA
-- Run this in the Supabase SQL Editor to set up your project.
-- ============================================================

-- 1. Batches: Represents a user's request to generate assets
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  project_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  input_data jsonb not null, -- Product data, images[], theme, format…
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

-- Enable RLS for batches
alter table batches enable row level security;

create policy "Users can view their own batches"
  on batches for select
  using (auth.uid() = user_id);

create policy "Users can insert their own batches"
  on batches for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own batches"
  on batches for update
  using (auth.uid() = user_id);

create policy "Users can delete their own batches"
  on batches for delete
  using (auth.uid() = user_id);


-- 2. Jobs: Individual asset generation tasks (1 Batch = N Jobs)
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches on delete cascade not null,
  user_id uuid references auth.users default auth.uid(),
  status text check (status in ('pending', 'generating_assets', 'rendering', 'uploading', 'done', 'failed')),
  type text check (type in ('video', 'image')),
  template_id text not null, -- ID of the Remotion composition used
  result_url text, -- Final S3/Storage URL
  error_message text,
  metadata jsonb, -- Stores specific props used for this render
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for jobs
alter table jobs enable row level security;

create policy "Users can view their own jobs"
  on jobs for select
  using (auth.uid() = user_id);

create policy "Users can delete their own jobs"
  on jobs for delete
  using (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on jobs for update
  using (auth.uid() = user_id);
  
-- CRITICAL: Enable Realtime for Progress Tracking
alter publication supabase_realtime add table jobs;
alter table jobs replica identity full;


-- 3. Generation History: For Diversity Logic Deduplication
create table if not exists generation_history (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches not null,
  style_hash text not null, -- hash(angle + background + color)
  created_at timestamptz default now()
);

-- Enable RLS for history
alter table generation_history enable row level security;

create policy "Users can view their own history"
  on generation_history for select
  using (batch_id in (select id from batches where user_id = auth.uid()));


-- ============================================================
-- SUPABASE STORAGE: product-assets bucket
-- ============================================================

-- Create the bucket (public for serving images in renders)
insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "Users can upload product assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to read (public bucket for renders)
create policy "Public read access for product assets"
  on storage.objects for select
  to public
  using (bucket_id = 'product-assets');

-- Allow users to delete their own assets
create policy "Users can delete their own assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- ORPHANED IMAGE CLEANUP
-- Schedule this via Supabase Dashboard → pg_cron or Edge Function
-- Runs daily: deletes files from /draft/ dirs older than 24h
-- that are NOT referenced in any batch's input_data.
-- ============================================================
-- 
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- SELECT cron.schedule(
--   'cleanup-orphaned-assets',
--   '0 3 * * *',  -- Daily at 3 AM UTC
--   $$
--     DELETE FROM storage.objects
--     WHERE bucket_id = 'product-assets'
--       AND name LIKE '%/draft/%'
--       AND created_at < NOW() - INTERVAL '24 hours'
--       AND name NOT IN (
--         SELECT jsonb_array_elements_text(
--           p->'images'
--         )
--         FROM batches,
--             jsonb_array_elements(input_data->'products') AS p
--       );
--   $$
-- );
