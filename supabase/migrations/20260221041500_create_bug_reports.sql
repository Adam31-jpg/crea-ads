-- Create the bug_submissions table
CREATE TABLE IF NOT EXISTS public.bug_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    category TEXT NOT NULL,
    stripe_id TEXT,
    batch_id TEXT,
    urgency TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    steps TEXT NOT NULL,
    file_url TEXT,
    browser_version TEXT NOT NULL,
    operating_system TEXT NOT NULL,
    current_url TEXT NOT NULL
);

-- Turn on row level security for bug_submissions
ALTER TABLE public.bug_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone (authenticated or anon) to insert bug reports
CREATE POLICY "Allow public inserts for bug reports" ON public.bug_submissions
    FOR INSERT TO public, authenticated, anon
    WITH CHECK (true);

-- Allow admins to view bug reports (or just lock it down so only service role can read via API)
CREATE POLICY "Only service role can select bug submissions" ON public.bug_submissions
    FOR SELECT TO service_role
    USING (true);

-- Create the bug_reports storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bug_reports', 'bug_reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload a bug report file
CREATE POLICY "Allow public uploads to bug_reports" ON storage.objects
    FOR INSERT TO public, authenticated, anon
    WITH CHECK (bucket_id = 'bug_reports');

-- Allow anyone to view bug report files
CREATE POLICY "Allow public read access to bug_reports" ON storage.objects
    FOR SELECT TO public, authenticated, anon
    USING (bucket_id = 'bug_reports');
