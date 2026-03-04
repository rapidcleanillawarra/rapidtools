-- Status history counts by user for a custom date range (inclusive).
-- Used by workshop dashboard "Status changes by user" when a date range is selected.
CREATE OR REPLACE FUNCTION get_workshop_status_history_counts_by_date_range(
  p_date_from timestamptz,
  p_date_to timestamptz
)
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
    AND wsh.timestamp >= p_date_from
    AND wsh.timestamp <= p_date_to
  GROUP BY wsh.user_email, u.full_name
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_by_date_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_by_date_range(timestamptz, timestamptz) TO anon;
