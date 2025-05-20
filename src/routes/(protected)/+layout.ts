import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { get } from 'svelte/store';
import { currentUser, isLoadingAuth } from '$lib/firebase';

export const ssr = false;

export const load: LayoutLoad = async ({ parent }) => {
  // Wait for parent layout data
  const parentData = await parent();
  
  if (browser) {
    const user = get(currentUser);
    const loading = get(isLoadingAuth);

    if (!loading && !user) {
      throw redirect(302, base + '/');
    }
  }

  return {
    ...parentData
  };
}; 