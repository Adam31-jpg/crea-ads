-- Ensure credits column defaults to 0
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 0;

-- Create an RPC to atomically increment credits
CREATE OR REPLACE FUNCTION increment_credits(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run as database owner to ensure access
SET search_path = public
AS $$
BEGIN
  -- Update the profiles table by adding the amount to the existing credits
  -- This inherently prevents race conditions compared to reading and writing back from the client.
  UPDATE public.profiles
  SET credits = COALESCE(credits, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;
