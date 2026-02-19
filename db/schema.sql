-- 1. Batches: Represents a user's request to generate assets
create table batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  project_name text not null,
  input_data jsonb not null, -- The original product data/selling points
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


-- 2. Jobs: Individual asset generation tasks (1 Batch = 10 Jobs)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches not null,
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

-- Policies for jobs (linked via batch_id -> user_id, or if we denormalize user_id to jobs)
-- For simplicity and performance, we often verify via the batch relation, but RLS on joins can be tricky.
-- Ideally we add user_id to jobs or use a join policy. 
-- Let's add user_id to jobs for cleaner RLS.
alter table jobs add column user_id uuid references auth.users default auth.uid();

create policy "Users can view their own jobs"
  on jobs for select
  using (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on jobs for update
  using (auth.uid() = user_id);
  
-- CRITICAL: Enable Realtime for Progress Tracking
alter publication supabase_realtime add table jobs;
alter table jobs replica identity full; -- Required for extracting 'old' vs 'new' states


-- 3. Generation History: For Diversity Logic Deduplication
create table generation_history (
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
