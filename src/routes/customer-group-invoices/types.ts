export interface CustomerGroupInvoice {
  invoiceNumber: string;
  customerGroupName: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  dateIssued: string;
  updated?: boolean;
}

export type InvoiceFetchResult = {
  invoices: CustomerGroupInvoice[];
}; 