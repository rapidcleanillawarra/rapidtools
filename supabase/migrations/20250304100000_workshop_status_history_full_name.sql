-- Return full_name from public.users for "Status changes this week (by user)".
-- Replaces get_workshop_status_history_counts_this_week to join users on email.
CREATE OR REPLACE FUNCTION get_workshop_status_history_counts_this_week()
RETURNS TABLE(user_email text, full_name text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wsh.user_email AS user_email,
    u.full_name AS full_name,
    count(*)::bigint AS count
  FROM workshop_status_history wsh
  LEFT JOIN users u ON u.email = wsh.user_email
  WHERE wsh.user_email IS NOT NULL
    AND wsh.timestamp >= (date_trunc('week', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC')
    AND wsh.timestamp < (date_trunc('week', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC') + interval '1 week'
  GROUP BY wsh.user_email, u.full_name
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_this_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_this_week() TO anon;
