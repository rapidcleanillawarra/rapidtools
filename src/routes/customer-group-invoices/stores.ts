import { writable, get } from 'svelte/store';
import type { CustomerGroupInvoice } from './types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

// Store for all invoices
export const invoices = writable<CustomerGroupInvoice[]>([]);

// Store for original invoices (before filtering)
export const originalInvoices = writable<CustomerGroupInvoice[]>([]);

// Store for filtered invoices
export const filteredInvoices = writable<CustomerGroupInvoice[]>([]);

// Loading states
export const loading = writable<boolean>(false);
export const filterLoading = writable<boolean>(false);
export const currentLoadingStep = writable<string>('');

// Error states
export const invoiceError = writable<string | null>(null);
export const dateError = writable<string | null>(null);
export const customerGroupError = writable<string | null>(null);
export const statusError = writable<string | null>(null);

// Selected rows
export const selectedRows = writable<Set<string>>(new Set());
export const selectAll = writable<boolean>(false);

// Pagination
export const currentPage = writable<number>(1);
export const itemsPerPage = writable<number>(10);

// Sorting
export const sortField = writable<string>('');
export const sortDirection = writable<'asc' | 'desc'>('asc');

// Filter stores
export const selectedCustomerGroup = writable<string | null>(null);
export const dateFrom = writable<Date | null>(null);
export const dateTo = writable<Date | null>(null);
export const selectedStatus = writable<{ value: string; label: string }[]>([]);

// Store for customer groups
export const customerGroups = writable<{ value: string; label: string }[]>([]);

// Function to validate all filters
export function validateFilters(): boolean {
  let isValid = true;

  // Reset all error states
  dateError.set(null);
  customerGroupError.set(null);
  statusError.set(null);

  // Validate customer group
  if (!get(selectedCustomerGroup)) {
    customerGroupError.set('Please select a customer group');
    isValid = false;
  }

  // Validate status
  if (!get(selectedStatus) || get(selectedStatus).length === 0) {
    statusError.set('Please select at least one status');
    isValid = false;
  }

  // Validate dates only if both are provided
  const fromDate = get(dateFrom);
  const toDate = get(dateTo);
  if (fromDate && toDate) {
    if (!validateDates(fromDate, toDate)) {
      isValid = false;
    }
  }

  return isValid;
}

// Function to validate dates
export function validateDates(fromDate: Date | null, toDate: Date | null): boolean {
  if (!fromDate || !toDate) return true; // Allow empty dates
  
  // Reset date error
  dateError.set(null);
  
  // Convert to start and end of day for proper comparison
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);
  
  if (to < from) {
    dateError.set('End date must be greater than or equal to start date');
    return false;
  }
  
  return true;
}

// Function to fetch customer groups from Firestore
export async function fetchCustomerGroups() {
  try {
    const querySnapshot = await getDocs(collection(db, 'maropost_customer_groups'));
    const groups = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        value: data.id,
        label: data.name
      };
    });
    customerGroups.set(groups);
  } catch (error) {
    console.error('Error fetching customer groups:', error);
    throw error;
  }
}

// Function to handle select all
export function handleSelectAll(checked: boolean) {
  if (checked) {
    const allInvoiceNumbers = get(invoices).map(inv => inv.invoiceNumber);
    selectedRows.set(new Set(allInvoiceNumbers));
  } else {
    selectedRows.set(new Set());
  }
  selectAll.set(checked);
}

// Function to get paginated invoices
export function getPaginatedInvoices(allInvoices: CustomerGroupInvoice[]): CustomerGroupInvoice[] {
  const currentPageValue = get(currentPage);
  const itemsPerPageValue = get(itemsPerPage);
  const sortFieldValue = get(sortField);
  const sortDirectionValue = get(sortDirection);

  console.log('getPaginatedInvoices input:', {
    totalInvoices: allInvoices.length,
    currentPage: currentPageValue,
    itemsPerPage: itemsPerPageValue,
    sortField: sortFieldValue,
    sortDirection: sortDirectionValue
  });

  let sortedInvoices = [...allInvoices];

  if (sortFieldValue) {
    sortedInvoices.sort((a, b) => {
      const aValue = a[sortFieldValue as keyof CustomerGroupInvoice];
      const bValue = b[sortFieldValue as keyof CustomerGroupInvoice];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirectionValue === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirectionValue === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
      
      return 0;
    });
  }

  const start = (currentPageValue - 1) * itemsPerPageValue;
  const end = start + itemsPerPageValue;
  const paginated = sortedInvoices.slice(start, end);

  console.log('getPaginatedInvoices output:', {
    start,
    end,
    paginatedLength: paginated.length
  });

  return paginated;
}

// Function to get total pages
export function getTotalPages(totalItems: number): number {
  return Math.ceil(totalItems / get(itemsPerPage));
}

// Function to apply filters via API
export async function applyFiltersViaAPI() {
  // Validate all filters before proceeding
  if (!validateFilters()) {
    const errorMessages = [
      get(dateError),
      get(customerGroupError),
      get(statusError)
    ].filter(Boolean).join(', ');
    throw new Error(errorMessages || 'Invalid filter values');
  }

  filterLoading.set(true);
  try {
    const filterParams = {
      customerGroup: get(selectedCustomerGroup),
      dateFrom: get(dateFrom)?.toISOString(),
      dateTo: get(dateTo)?.toISOString(),
      status: get(selectedStatus)
    };

    const response = await fetch('/api/customer-group-invoices/filter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filterParams)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch filtered invoices');
    }

    const data = await response.json();
    invoices.set(data.invoices);
    filteredInvoices.set(data.invoices);
    originalInvoices.set(data.invoices);
    currentPage.set(1); // Reset to first page when filters change
  } catch (error) {
    console.error('Error applying filters:', error);
    throw error;
  } finally {
    filterLoading.set(false);
  }
}

// Function to apply filters locally
export function applyFilters() {
  const allInvoices = get(originalInvoices);
  const customerGroup = get(selectedCustomerGroup);
  const fromDate = get(dateFrom);
  const toDate = get(dateTo);
  const status = get(selectedStatus);

  console.log('Applying filters with:', {
    totalInvoices: allInvoices.length,
    customerGroup,
    fromDate,
    toDate,
    status
  });

  let filtered = [...allInvoices];

  if (customerGroup) {
    filtered = filtered.filter(inv => 
      inv.customerGroupName.toLowerCase().includes(customerGroup.toLowerCase())
    );
  }

  if (fromDate) {
    filtered = filtered.filter(inv => 
      new Date(inv.dateIssued) >= fromDate
    );
  }

  if (toDate) {
    filtered = filtered.filter(inv => 
      new Date(inv.dateIssued) <= toDate
    );
  }

  // Remove status filtering for now
  // if (status && status.length > 0) {
  //   filtered = filtered.filter(inv => 
  //     status.some(s => s.value === inv.status)
  //   );
  // }

  console.log('Filtered results:', {
    beforeFilter: allInvoices.length,
    afterFilter: filtered.length
  });

  // Only update if we have results
  if (filtered.length > 0) {
    filteredInvoices.set(filtered);
    invoices.set(filtered);
    currentPage.set(1); // Reset to first page when filters change
  }
} 