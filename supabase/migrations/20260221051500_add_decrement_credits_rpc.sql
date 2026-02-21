-- Function to securely decrement user credits
CREATE OR REPLACE FUNCTION decrement_credits(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  -- We strictly decrement if they have enough balance
  UPDATE profiles
  SET credits = credits - p_amount
  WHERE id = p_user_id AND credits >= p_amount;

  -- Raise an exception if the row wasn't updated (either user not found or insufficient credits)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
