import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ url }) => {
  // Always redirect to /schedules
  throw redirect(307, '/scheduled-test-and-tag/schedules');
}; 