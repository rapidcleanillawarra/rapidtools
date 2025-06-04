export interface CustomerGroupInvoice {
  invoiceNumber: string;
  dateIssued: string;
  dueDate: string;
  totalAmount: number;
  username: string;
  company: string;
  customerGroupName: string;
  status: 'pending' | 'paid' | 'overdue';
  updated?: boolean;
}

export type InvoiceFetchResult = {
  invoices: CustomerGroupInvoice[];
}; 