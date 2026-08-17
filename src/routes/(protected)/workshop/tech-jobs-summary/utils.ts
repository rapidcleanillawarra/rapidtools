import { DateTime } from 'luxon';
import type { TechJobsSummaryRow } from '$lib/services/workshop';
import type { SortField, TechJobGroup, TechJobsFilters, TechJobsSummaryStats } from './types';

const SYDNEY_ZONE = 'Australia/Sydney';
/** Remaining jobs scheduled for today become overdue from this Sydney hour (24h). */
export const OVERDUE_CUTOFF_HOUR_SYDNEY = 14;

export function getSortIcon(
  field: SortField,
  currentSortField: SortField,
  direction: 'asc' | 'desc'
): string {
  if (currentSortField !== field) return '↕';
  return direction === 'asc' ? '↑' : '↓';
}

export function sortData(
  data: TechJobsSummaryRow[],
  field: keyof TechJobsSummaryRow,
  direction: 'asc' | 'desc'
): TechJobsSummaryRow[] {
  return [...data].sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];

    if (field === 'schedule' || field === 'created_at' || field === 'updated_at') {
      const timeA = valueA ? new Date(String(valueA)).getTime() : 0;
      const timeB = valueB ? new Date(String(valueB)).getTime() : 0;
      if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
      if (Number.isNaN(timeA)) return direction === 'asc' ? 1 : -1;
      if (Number.isNaN(timeB)) return direction === 'asc' ? -1 : 1;
      return direction === 'asc' ? timeA - timeB : timeB - timeA;
    }

    const strA = String(valueA ?? '').toLowerCase();
    const strB = String(valueB ?? '').toLowerCase();
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatSydneyDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) return iso;
  return dt.setZone(SYDNEY_ZONE).toFormat('d LLL yyyy, h:mm a');
}

export function sydneyToday(): string {
  return DateTime.now().setZone(SYDNEY_ZONE).toFormat('yyyy-LL-dd');
}

export function formatSydneyTodayLabel(millis = Date.now()): string {
  return DateTime.fromMillis(millis).setZone(SYDNEY_ZONE).toFormat('cccc, d LLL yyyy');
}

export function formatSydneyNowTime(millis = Date.now()): string {
  return DateTime.fromMillis(millis).setZone(SYDNEY_ZONE).toFormat('h:mm a');
}

export function scheduleDateInSydney(iso: string | null): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) return null;
  return dt.setZone(SYDNEY_ZONE).toFormat('yyyy-LL-dd');
}

function sydneyDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) return null;
  return dt.setZone(SYDNEY_ZONE).toFormat('yyyy-LL-dd');
}

export function isJobCompleted(row: TechJobsSummaryRow): boolean {
  return row.current_workshop_status === 'completed' || row.assignment_status === 'completed';
}

/** Active jobs due today or earlier (including unscheduled), excluding completed workshops. */
export function isIncompleteTodayJob(row: TechJobsSummaryRow, today = sydneyToday()): boolean {
  if (isJobCompleted(row)) return false;
  if (row.assignment_status !== 'active') return false;
  const scheduleDate = scheduleDateInSydney(row.schedule);
  if (!scheduleDate) return true;
  return scheduleDate <= today;
}

/** Completed jobs scheduled for today, or completed today. */
export function isCompletedTodayJob(row: TechJobsSummaryRow, today = sydneyToday()): boolean {
  if (!isJobCompleted(row)) return false;
  const scheduleDate = scheduleDateInSydney(row.schedule);
  if (scheduleDate === today) return true;
  return sydneyDateFromIso(row.updated_at) === today;
}

export function isOverdueJob(row: TechJobsSummaryRow, nowMillis = Date.now()): boolean {
  if (isJobCompleted(row)) return false;
  const now = DateTime.fromMillis(nowMillis).setZone(SYDNEY_ZONE);
  if (!now.isValid) return false;

  const today = now.toFormat('yyyy-LL-dd');
  const scheduleDate = scheduleDateInSydney(row.schedule);

  if (scheduleDate && scheduleDate < today) return true;
  if (now.hour < OVERDUE_CUTOFF_HOUR_SYDNEY) return false;
  return !scheduleDate || scheduleDate === today;
}

export function formatSimpleSchedule(iso: string | null | undefined, today = sydneyToday()): string {
  if (!iso) return 'Unscheduled';
  const scheduleDate = scheduleDateInSydney(iso);
  if (!scheduleDate) return 'Unscheduled';
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) return iso;
  const sydney = dt.setZone(SYDNEY_ZONE);
  if (scheduleDate === today) return sydney.toFormat('h:mm a');
  return sydney.toFormat('d LLL, h:mm a');
}

export function groupJobsByTech(rows: TechJobsSummaryRow[]): TechJobGroup[] {
  const groups = new Map<string, TechJobGroup>();
  for (const row of rows) {
    const email = row.assigned_tech ?? '';
    const name = row.assigned_tech_name || email || 'Unassigned';
    const key = email || name;
    const existing = groups.get(key);
    if (existing) {
      existing.jobs.push(row);
    } else {
      groups.set(key, { name, email: row.assigned_tech, jobs: [row] });
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterTechJobs(
  data: TechJobsSummaryRow[],
  filters: TechJobsFilters
): TechJobsSummaryRow[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return data.filter((row) => {
    if (filters.assignmentStatus !== 'all' && row.assignment_status !== filters.assignmentStatus) {
      return false;
    }

    if (filters.selectedTech && (row.assigned_tech ?? '') !== filters.selectedTech) {
      return false;
    }

    if (filters.selectedJobType && row.job_type !== filters.selectedJobType) {
      return false;
    }

    if (filters.dateFrom || filters.dateTo) {
      const scheduleDate = scheduleDateInSydney(row.schedule);
      if (!scheduleDate) return false;
      if (filters.dateFrom && scheduleDate < filters.dateFrom) return false;
      if (filters.dateTo && scheduleDate > filters.dateTo) return false;
    }

    if (!query) return true;

    return (
      (row.assigned_tech_name ?? '').toLowerCase().includes(query) ||
      (row.assigned_tech ?? '').toLowerCase().includes(query) ||
      (row.customer_name ?? '').toLowerCase().includes(query) ||
      (row.product_name ?? '').toLowerCase().includes(query) ||
      (row.order_id ?? '').toLowerCase().includes(query) ||
      (row.clients_work_order ?? '').toLowerCase().includes(query) ||
      (row.serial_number ?? '').toLowerCase().includes(query) ||
      (row.make_model ?? '').toLowerCase().includes(query) ||
      (row.site_location ?? '').toLowerCase().includes(query) ||
      (row.job_type ?? '').toLowerCase().includes(query)
    );
  });
}

export function buildSummaryStats(data: TechJobsSummaryRow[]): TechJobsSummaryStats {
  const byTechMap = new Map<string, { name: string; email: string | null; count: number }>();
  const byJobTypeMap = new Map<string, number>();
  let active = 0;

  for (const row of data) {
    if (row.assignment_status === 'active') active += 1;

    const email = row.assigned_tech ?? '';
    const name = row.assigned_tech_name || email || 'Unassigned';
    const key = email || name;
    const existing = byTechMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byTechMap.set(key, { name, email: row.assigned_tech, count: 1 });
    }

    const jobType = row.job_type || 'Unspecified';
    byJobTypeMap.set(jobType, (byJobTypeMap.get(jobType) ?? 0) + 1);
  }

  return {
    total: data.length,
    active,
    uniqueTechs: byTechMap.size,
    byJobType: [...byJobTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    byTech: [...byTechMap.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name)
    )
  };
}

export function uniqueTechs(
  data: TechJobsSummaryRow[]
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const row of data) {
    if (!row.assigned_tech) continue;
    if (!seen.has(row.assigned_tech)) {
      seen.set(row.assigned_tech, row.assigned_tech_name || row.assigned_tech);
    }
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function assignmentStatusClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'superseded':
      return 'bg-amber-100 text-amber-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function jobTypeClass(jobType: string | null): string {
  switch (jobType) {
    case 'Quote':
      return 'bg-purple-100 text-purple-800';
    case 'Repair':
      return 'bg-orange-100 text-orange-800';
    case 'Service':
      return 'bg-cyan-100 text-cyan-800';
    case 'Warranty':
      return 'bg-pink-100 text-pink-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
