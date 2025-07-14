import { writable, derived, get } from 'svelte/store';
import { schedulesStore } from '../stores';
import type { Schedule, ScheduleFormData, ValidationErrors, FormMode } from './types';

// Current schedule being edited
export const currentSchedule = writable<ScheduleFormData | null>(null);

// Form mode (create, edit, view)
export const formMode = writable<FormMode>('view');

// Validation errors
export const validationErrors = writable<ValidationErrors>({});

// UI state
export const isModalOpen = writable(false);
export const isLoading = writable(false);
export const searchTerm = writable('');
export const sortBy = writable<'company' | 'start_month' | 'occurence'>('company');
export const sortDirection = writable<'asc' | 'desc'>('asc');

// Filtered and sorted schedules
export const filteredSchedules = derived(
  [schedulesStore, searchTerm, sortBy, sortDirection],
  ([schedules, search, sort, direction]) => {
    // Ensure schedules is always an array
    const schedulesArray = schedules || [];
    
    let filtered = schedulesArray;
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = schedulesArray.filter(schedule => 
        schedule.company.toLowerCase().includes(searchLower) ||
        schedule.information.some(info => 
          info.sub_company_name.toLowerCase().includes(searchLower) ||
          info.location.toLowerCase().includes(searchLower) ||
          info.contacts.some(contact => 
            contact.name.toLowerCase().includes(searchLower) ||
            contact.email.toLowerCase().includes(searchLower)
          )
        )
      );
    }
    
    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sort) {
        case 'company':
          aValue = a.company;
          bValue = b.company;
          break;
        case 'start_month':
          aValue = a.start_month;
          bValue = b.start_month;
          break;
        case 'occurence':
          aValue = a.occurence;
          bValue = b.occurence;
          break;
        default:
          aValue = a.company;
          bValue = b.company;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return direction === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
    
    return filtered;
  }
);

// Helper functions
export function resetForm() {
  currentSchedule.set(null);
  formMode.set('view');
  validationErrors.set({});
  isModalOpen.set(false);
}

export function setEditMode(schedule: Schedule) {
  const editSchedule: ScheduleFormData = {
    ...schedule,
    information: schedule.information.map(info => ({
      ...info,
      contacts: [...info.contacts]
    })),
    notes: [...schedule.notes]
  };
  
  currentSchedule.set(editSchedule);
  formMode.set('edit');
  validationErrors.set({});
  isModalOpen.set(true);
}

export function setCreateMode() {
  console.log('=== SETTING CREATE MODE ===');
  
  const newSchedule: ScheduleFormData = {
    company: '',
    start_month: 1,
    occurence: 1,
    color: '#3b82f6', // Default blue color
    information: [],
    notes: []
  };
  
  currentSchedule.set(newSchedule);
  formMode.set('create');
  validationErrors.set({});
  isModalOpen.set(true);
  
  console.log('Create mode set successfully');
}

export function setViewMode(schedule: Schedule) {
  currentSchedule.set(schedule);
  formMode.set('view');
  validationErrors.set({});
  isModalOpen.set(true);
} 