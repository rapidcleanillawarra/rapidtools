import type { PageLoad } from './$types';
import type { CustomerGroupInvoice } from './types';

export const load: PageLoad = async () => {
  return {
    invoices: [] as CustomerGroupInvoice[]
  };
}; 