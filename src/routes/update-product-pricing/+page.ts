import type { PageLoad } from './$types';

export const prerender = true;
export const ssr = false;

export const load: PageLoad = async ({ data }) => {
  return {
    products: data.products || []
  };
}; 