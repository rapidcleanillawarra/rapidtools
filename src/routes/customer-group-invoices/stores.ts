import { writable, get } from 'svelte/store';
import type { CustomerGroupInvoice } from './types';

// Store for all invoices
export const invoices = writable<CustomerGroupInvoice[]>([]);

// Store for original invoices (before filtering)
export const originalInvoices = writable<CustomerGroupInvoice[]>([]);

// Store for filtered invoices
export const filteredInvoices = writable<CustomerGroupInvoice[]>([]);

// Loading states
export const loading = writable<boolean>(false);
export const submitLoading = writable<boolean>(false);

// Error state
export const invoiceError = writable<string | null>(null);

// Selected rows
export const selectedRows = writable<Set<string>>(new Set());
export const selectAll = writable<boolean>(false);

// Pagination
export const currentPage = writable<number>(1);
export const itemsPerPage = writable<number>(10);

// Sorting
export const sortField = writable<string | null>(null);
export const sortDirection = writable<'asc' | 'desc'>('asc');

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

  let sortedInvoices = [...allInvoices];

  if (sortFieldValue) {
    sortedInvoices.sort((a, b) => {
      const aValue = a[sortFieldValue as keyof CustomerGroupInvoice];
      const bValue = b[sortFieldValue as keyof CustomerGroupInvoice];
      
      if (sortDirectionValue === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return bValue < aValue ? -1 : bValue > aValue ? 1 : 0;
      }
    });
  }

  const start = (currentPageValue - 1) * itemsPerPageValue;
  const end = start + itemsPerPageValue;
  return sortedInvoices.slice(start, end);
}

// Function to get total pages
export function getTotalPages(totalItems: number): number {
  return Math.ceil(totalItems / get(itemsPerPage));
}

// Function to handle submit checked rows
export async function handleSubmitChecked() {
  submitLoading.set(true);
  try {
    const selectedInvoices = get(invoices).filter(inv => get(selectedRows).has(inv.invoiceNumber));

    if (selectedInvoices.length === 0) {
      return { success: false, message: 'No invoices selected' };
    }

    // Mock successful update
    invoices.update(invs => {
      return invs.map(inv => {
        if (get(selectedRows).has(inv.invoiceNumber)) {
          return { ...inv, updated: true };
        }
        return inv;
      });
    });

    return { success: true, message: 'Invoices updated successfully' };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to update invoices' };
  } finally {
    submitLoading.set(false);
  }
} 