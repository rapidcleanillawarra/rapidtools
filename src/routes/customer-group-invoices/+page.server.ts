import type { ServerLoad } from '@sveltejs/kit';
import type { CustomerGroupInvoice } from './types';

console.log('========== SERVER LOAD START ==========');

export const load: ServerLoad = async ({ fetch }: { fetch: typeof globalThis.fetch }) => {
  console.log('🔄 Loading customer group invoices...');
  
  // Mock data for demonstration
  const mockInvoices: CustomerGroupInvoice[] = [
    {
      invoiceNumber: 'INV-2024-001',
      customerGroupName: 'Premium Clients',
      totalAmount: 1250.00,
      status: 'pending',
      dateIssued: '2024-03-15'
    },
    {
      invoiceNumber: 'INV-2024-002',
      customerGroupName: 'Standard Clients',
      totalAmount: 750.50,
      status: 'paid',
      dateIssued: '2024-03-14'
    },
    {
      invoiceNumber: 'INV-2024-003',
      customerGroupName: 'Enterprise Clients',
      totalAmount: 2500.00,
      status: 'overdue',
      dateIssued: '2024-03-10'
    }
  ];

  console.log('✨ Final invoices array length:', mockInvoices.length);
  if (mockInvoices.length > 0) {
    console.log('📝 Sample invoice:', JSON.stringify(mockInvoices[0], null, 2));
  }
  console.log('========== SERVER LOAD END ==========\n');

  return {
    invoices: mockInvoices
  };
}; 