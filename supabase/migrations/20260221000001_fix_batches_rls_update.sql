-- Ensure the RLS policy allows the user to update their own batches, specifically for archiving
-- We use a safe DO block to check if the policy exists and drop it to replace it, or just CREATE POLICY IF NOT EXISTS

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'batches' AND policyname = 'Users can update their own batches'
    ) THEN
        CREATE POLICY "Users can update their own batches"
        ON public.batches
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;
