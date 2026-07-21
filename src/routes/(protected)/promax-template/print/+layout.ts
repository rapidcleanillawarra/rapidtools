import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { waitForAuth } from '$lib/firebase';

export const ssr = false;

export const load: LayoutLoad = async () => {
  // Don't call parent() - this breaks the layout chain
  // Handle authentication directly
  if (browser) {
    const user = await waitForAuth();
    if (!user) {
      throw redirect(302, base + '/');
    }
  }

  return {};
};
