-- 1. Create the background-assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
    'background-assets',
    'background-assets',
    true,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow Public Read Access
CREATE POLICY "Public Read Access for Backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'background-assets');

-- 3. Configure 15-Day TTL using pg_cron (if available, requires pg_cron extension)
-- Supabase Cloud enables pg_cron by default. This will run daily at midnight
-- and delete background-assets objects older than 15 days to manage storage costs.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Schedule a daily job at midnight (UTC)
    PERFORM cron.schedule(
      'cleanup-background-assets-ttl',
      '0 0 * * *',
      $$
        DELETE FROM storage.objects 
        WHERE bucket_id = 'background-assets' 
        AND created_at < NOW() - INTERVAL '15 days';
      $$
    );
  END IF;
END $$;
