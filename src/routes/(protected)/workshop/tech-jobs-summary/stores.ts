import { writable, derived, get } from 'svelte/store';
import type { TechJobsSummaryRow, WorkshopTechJobType } from '$lib/services/workshop';
import type { AssignmentStatusFilter, SortField, ViewMode } from './types';
import {
  buildSummaryStats,
  filterTechJobs,
  groupJobsByTech,
  isIncompleteTodayJob,
  isOverdueJob,
  sortData,
  sydneyToday,
  uniqueTechs
} from './utils';

const VIEW_MODE_KEY = 'rapidtools-tech-jobs-view-mode';

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'simple';
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

export const viewMode = writable<ViewMode>(loadViewMode());

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

export function setViewMode(mode: ViewMode) {
  if (get(viewMode) === mode) return;
  viewMode.set(mode);
  currentPage.set(1);
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

export const simpleJobs = derived([originalData, searchQuery], ([$originalData, $searchQuery]) => {
  const today = sydneyToday();
  const incomplete = $originalData.filter((row) => isIncompleteTodayJob(row, today));
  const filtered = filterTechJobs(incomplete, {
    searchQuery: $searchQuery,
    selectedTech: '',
    selectedJobType: '',
    assignmentStatus: 'all',
    dateFrom: '',
    dateTo: ''
  });
  return sortData(filtered, 'schedule', 'asc');
});

export const simpleJobsByTech = derived(simpleJobs, ($simpleJobs) => groupJobsByTech($simpleJobs));

export const simpleOverdueCount = derived(simpleJobs, ($simpleJobs) => {
  const today = sydneyToday();
  return $simpleJobs.filter((row) => isOverdueJob(row, today)).length;
});
