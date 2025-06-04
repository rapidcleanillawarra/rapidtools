import type { PageLoad } from './$types';
import type { CustomerGroupInvoice } from './types';

export const load: PageLoad = async ({ data }) => {
  return {
    invoices: data.invoices || []
  };
}; 