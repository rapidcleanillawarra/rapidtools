import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { base } from '$app/paths';

export const ssr = false;

export const load: PageLoad = async () => {
  throw redirect(307, `${base}/workshop/completed?status=to_be_scrapped`);
};
