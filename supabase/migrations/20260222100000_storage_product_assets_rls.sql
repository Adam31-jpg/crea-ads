-- Ensure the product-assets bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-assets', 'product-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing overlapping policies to ensure clean state
DROP POLICY IF EXISTS "Public read access for product-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to product-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own product-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own product-assets" ON storage.objects;

-- 1. Public Read Access (Crucial for AWS Lambda & Remotion)
CREATE POLICY "Public read access for product-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-assets');

-- 2. Authenticated Upload Access
CREATE POLICY "Authenticated users can upload to product-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-assets');

-- 3. Authenticated Update Access (if they own the file usually, but we allow authenticated here, or check owner)
CREATE POLICY "Users can update their own product-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-assets' AND auth.uid() = owner);

-- 4. Authenticated Delete Access
CREATE POLICY "Users can delete their own product-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-assets' AND auth.uid() = owner);
