import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async () => {
  // No need to fetch JSON since we're using the store
  return {};
}; 