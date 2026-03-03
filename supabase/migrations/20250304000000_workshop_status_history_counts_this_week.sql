-- Aggregated counts of workshop_status_history rows by user_email for the current week (UTC).
-- Used by the workshop dashboard to show "Status changes this week (by user)".
CREATE OR REPLACE FUNCTION get_workshop_status_history_counts_this_week()
RETURNS TABLE(user_email text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wsh.user_email AS user_email,
    count(*)::bigint AS count
  FROM workshop_status_history wsh
  WHERE wsh.user_email IS NOT NULL
    AND wsh.timestamp >= (date_trunc('week', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC')
    AND wsh.timestamp < (date_trunc('week', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC') + interval '1 week'
  GROUP BY wsh.user_email
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_this_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_this_week() TO anon;
