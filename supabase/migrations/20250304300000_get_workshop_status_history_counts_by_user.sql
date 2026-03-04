-- Status history counts by status for a single user in a date range (inclusive).
-- Used by workshop dashboard "Status breakdown by user" bar chart.
CREATE OR REPLACE FUNCTION get_workshop_status_history_counts_by_user(
  p_user_email text,
  p_date_from timestamptz,
  p_date_to timestamptz
)
RETURNS TABLE(status text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wsh.status AS status,
    count(*)::bigint AS count
  FROM workshop_status_history wsh
  WHERE wsh.user_email = p_user_email
    AND wsh.timestamp >= p_date_from
    AND wsh.timestamp <= p_date_to
  GROUP BY wsh.status
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_by_user(text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workshop_status_history_counts_by_user(text, timestamptz, timestamptz) TO anon;
