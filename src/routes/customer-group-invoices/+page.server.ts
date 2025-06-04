import type { ServerLoad } from '@sveltejs/kit';
import type { CustomerGroupInvoice } from './types';

console.log('========== SERVER LOAD START ==========');

export const load: ServerLoad = async ({ fetch }: { fetch: typeof globalThis.fetch }) => {
  // TODO: Implement actual data fetching from the backend
  return {
    invoices: []
  };
}; 