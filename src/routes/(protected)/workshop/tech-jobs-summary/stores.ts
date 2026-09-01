import { writable, derived, get } from 'svelte/store';
import type { TechJobsSummaryRow, WorkshopTechJobType } from '$lib/services/workshop';
import type { AssignmentStatusFilter, SimpleDay, SortField, ViewMode } from './types';
import {
  buildSummaryStats,
  filterTechJobs,
  groupJobsByTech,
  isCancelledTodayJob,
  isCompletedTodayJob,
  isOverdueJob,
  isRemainingJobForDay,
  sortData,
  sydneyDateForSimpleDay,
  sydneyToday,
  uniqueTechs
} from './utils';

const VIEW_MODE_KEY = 'rapidtools-tech-jobs-view-mode';
const SIMPLE_DAY_KEY = 'rapidtools-tech-jobs-simple-day';

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'simple';
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

function loadSimpleDay(): SimpleDay {
  if (typeof window === 'undefined') return 'today';
  try {
    const stored = localStorage.getItem(SIMPLE_DAY_KEY);
    if (stored === 'overdue' || stored === 'yesterday' || stored === 'tomorrow') return stored;
  } catch {
    /* ignore */
  }
  return 'today';
}

export const viewMode = writable<ViewMode>(loadViewMode());
export const simpleDay = writable<SimpleDay>(loadSimpleDay());

export const originalData = writable<TechJobsSummaryRow[]>([]);
export const isLoading = writable<boolean>(true);
export const tableError = writable<string | null>(null);

export const currentPage = writable<number>(1);
export const itemsPerPage = writable<number>(25);

export const sortField = writable<SortField>('schedule');
export const sortDirection = writable<'asc' | 'desc'>('desc');

export const searchQuery = writable<string>('');
export const selectedTech = writable<string>('');
export const selectedJobType = writable<WorkshopTechJobType | ''>('');
export const assignmentStatus = writable<AssignmentStatusFilter>('active');
export const dateFrom = writable<string>('');
export const dateTo = writable<string>('');
export const dateError = writable<string | null>(null);

export function validateFilters(): boolean {
  dateError.set(null);
  const from = get(dateFrom);
  const to = get(dateTo);
  if (from && to && to < from) {
    dateError.set('The end date cannot be before the start date.');
    return false;
  }
  return true;
}

export function resetFilters() {
  searchQuery.set('');
  selectedTech.set('');
  selectedJobType.set('');
  assignmentStatus.set('active');
  dateFrom.set('');
  dateTo.set('');
  dateError.set(null);
  currentPage.set(1);
}

searchQuery.subscribe(() => currentPage.set(1));
selectedTech.subscribe(() => currentPage.set(1));
selectedJobType.subscribe(() => currentPage.set(1));
assignmentStatus.subscribe(() => currentPage.set(1));
dateFrom.subscribe(() => currentPage.set(1));
dateTo.subscribe(() => currentPage.set(1));

viewMode.subscribe((mode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
});

simpleDay.subscribe((day) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIMPLE_DAY_KEY, day);
  } catch {
    /* ignore quota / private mode */
  }
});

export function setViewMode(mode: ViewMode) {
  if (get(viewMode) === mode) return;
  viewMode.set(mode);
  currentPage.set(1);
}

export function setSimpleDay(day: SimpleDay) {
  if (get(simpleDay) === day) return;
  simpleDay.set(day);
}

export const tableData = derived(
  [
    originalData,
    searchQuery,
    selectedTech,
    selectedJobType,
    assignmentStatus,
    dateFrom,
    dateTo,
    sortField,
    sortDirection
  ],
  ([
    $originalData,
    $searchQuery,
    $selectedTech,
    $selectedJobType,
    $assignmentStatus,
    $dateFrom,
    $dateTo,
    $sortField,
    $sortDirection
  ]) => {
    const datesInvalid = Boolean($dateFrom && $dateTo && $dateTo < $dateFrom);
    const filtered = filterTechJobs($originalData, {
      searchQuery: $searchQuery,
      selectedTech: $selectedTech,
      selectedJobType: $selectedJobType,
      assignmentStatus: $assignmentStatus,
      dateFrom: datesInvalid ? '' : $dateFrom,
      dateTo: datesInvalid ? '' : $dateTo
    });
    if (!$sortField) return filtered;
    return sortData(filtered, $sortField, $sortDirection);
  }
);

export const paginatedData = derived(
  [tableData, currentPage, itemsPerPage],
  ([$tableData, $currentPage, $itemsPerPage]) => {
    const start = ($currentPage - 1) * $itemsPerPage;
    return $tableData.slice(start, start + $itemsPerPage);
  }
);

export const totalPages = derived([tableData, itemsPerPage], ([$tableData, $itemsPerPage]) =>
  Math.max(1, Math.ceil($tableData.length / $itemsPerPage))
);

export const summaryStats = derived(tableData, ($tableData) => buildSummaryStats($tableData));

export const techOptions = derived(originalData, ($originalData) => uniqueTechs($originalData));

export const simpleJobs = derived(
  [originalData, searchQuery, simpleDay],
  ([$originalData, $searchQuery, $simpleDay]) => {
    const today = sydneyToday();
    const now = Date.now();
    let combined: TechJobsSummaryRow[] = [];

    if ($simpleDay === 'overdue') {
      const overdue = $originalData.filter((row) => isOverdueJob(row, now));
      combined = sortData(overdue, 'schedule', 'asc');
    } else {
      const day = sydneyDateForSimpleDay($simpleDay);
      const remaining = $originalData.filter((row) => isRemainingJobForDay(row, day, today));
      const completed = $originalData.filter((row) => isCompletedTodayJob(row, day));
      const cancelled = $originalData.filter((row) => isCancelledTodayJob(row, day));
      combined = [
        ...sortData(remaining, 'schedule', 'asc'),
        ...sortData(completed, 'schedule', 'asc'),
        ...sortData(cancelled, 'schedule', 'asc')
      ];
    }

    return filterTechJobs(combined, {
      searchQuery: $searchQuery,
      selectedTech: '',
      selectedJobType: '',
      assignmentStatus: 'all',
      dateFrom: '',
      dateTo: ''
    });
  }
);

export const simpleJobsByTech = derived(simpleJobs, ($simpleJobs) => groupJobsByTech($simpleJobs));

export const simpleOverdueCount = derived(originalData, ($originalData) => {
  const now = Date.now();
  return $originalData.filter((row) => isOverdueJob(row, now)).length;
});
