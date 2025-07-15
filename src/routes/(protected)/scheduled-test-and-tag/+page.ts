import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { base } from '$app/paths';

export const ssr = false;

export const load: PageLoad = async ({ url }) => {
  // Always redirect to /schedules using the base path
  throw redirect(307, `${base}/scheduled-test-and-tag/schedules`);
}; 