import type { CustomerGroupInvoice } from '../types';

export function getSortIcon(field: string, currentSortField: string, sortDirection: 'asc' | 'desc'): string {
  if (!currentSortField || currentSortField !== field) return '↕️';
  return sortDirection === 'asc' ? '↑' : '↓';
}

export function handleSort(
  invoices: CustomerGroupInvoice[],
  field: keyof CustomerGroupInvoice,
  currentSortField: string,
  currentSortDirection: 'asc' | 'desc'
): { sortedInvoices: CustomerGroupInvoice[], newSortField: string, newSortDirection: 'asc' | 'desc' } {
  let newSortField = field;
  let newSortDirection: 'asc' | 'desc' = 'asc';

  if (currentSortField === field) {
    newSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  }

  const sortedInvoices = [...invoices].sort((a, b) => {
    const valueA = a[field] ?? '';
    const valueB = b[field] ?? '';

    // Handle date fields
    if (field === 'dateIssued' || field === 'dueDate') {
      const dateA = new Date(valueA as string).getTime();
      const dateB = new Date(valueB as string).getTime();
      return newSortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    // Handle numeric fields
    if (field === 'totalAmount' || field === 'amountPaid' || field === 'balance') {
      const numA = parseFloat(valueA as string) || 0;
      const numB = parseFloat(valueB as string) || 0;
      return newSortDirection === 'asc' ? numA - numB : numB - numA;
    }

    // Handle string fields
    const strA = String(valueA).toLowerCase();
    const strB = String(valueB).toLowerCase();
    return newSortDirection === 'asc' 
      ? strA.localeCompare(strB)
      : strB.localeCompare(strA);
  });

  return { sortedInvoices, newSortField, newSortDirection };
}

export function getPaginatedInvoices(
  invoices: CustomerGroupInvoice[],
  currentPage: number,
  itemsPerPage: number
): CustomerGroupInvoice[] {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return invoices.slice(startIndex, endIndex);
}

export function getTotalPages(totalItems: number, itemsPerPage: number): number {
  return Math.ceil(totalItems / itemsPerPage);
}

export function getCurrentPageItems(
  currentPage: number,
  itemsPerPage: number,
  totalItems: number
): { start: number; end: number; total: number } {
  return {
    start: (currentPage - 1) * itemsPerPage + 1,
    end: Math.min(currentPage * itemsPerPage, totalItems),
    total: totalItems
  };
} 