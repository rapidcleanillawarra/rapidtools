export interface CustomerGroupInvoice {
  invoiceNumber: string;
  dateIssued: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  username: string;
  company: string;
  customerGroupName: string;
  status: string;
  statusColor: string;
  updated?: boolean;
  isZeroInvoice?: boolean;
}

export type InvoiceFetchResult = {
  invoices: CustomerGroupInvoice[];
}; 