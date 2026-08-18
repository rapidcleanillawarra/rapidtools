import type {
  TechJobsSummaryRow,
  WorkshopTechAssignmentStatus,
  WorkshopTechJobType
} from '$lib/services/workshop';

export type { TechJobsSummaryRow, WorkshopTechAssignmentStatus, WorkshopTechJobType };

export type SortField = keyof TechJobsSummaryRow | '';

export type ViewMode = 'simple' | 'advanced';

export type SimpleDay = 'yesterday' | 'today' | 'tomorrow';

export const SIMPLE_DAY_OPTIONS: { value: SimpleDay; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' }
];

export type AssignmentStatusFilter = WorkshopTechAssignmentStatus | 'all';

export interface TechJobsFilters {
  searchQuery: string;
  selectedTech: string;
  selectedJobType: WorkshopTechJobType | '';
  assignmentStatus: AssignmentStatusFilter;
  dateFrom: string;
  dateTo: string;
}

export interface TechCount {
  name: string;
  email: string | null;
  count: number;
}

export interface JobTypeCount {
  type: string;
  count: number;
}

export interface TechJobsSummaryStats {
  total: number;
  active: number;
  uniqueTechs: number;
  byJobType: JobTypeCount[];
  byTech: TechCount[];
}

export interface TechJobGroup {
  name: string;
  email: string | null;
  jobs: TechJobsSummaryRow[];
}

export const ASSIGNMENT_STATUS_OPTIONS: { value: AssignmentStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];
