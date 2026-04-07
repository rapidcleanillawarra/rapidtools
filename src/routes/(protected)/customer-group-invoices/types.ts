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
  /** From API CompleteStatus: typically Approved or Incomplete */
  approval: string;
  updated?: boolean;
  userGroupMismatch?: boolean;
}

export type InvoiceFetchResult = {
  invoices: CustomerGroupInvoice[];
}; 