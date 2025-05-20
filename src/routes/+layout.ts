import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';
import { currentUser, isLoadingAuth } from '$lib/firebase';
import { get } from 'svelte/store';

export const load: LayoutLoad = async () => {
  if (!browser) {
    return {
      currentUser: null,
      isLoadingAuth: false
    };
  }

  return {
    currentUser: get(currentUser),
    isLoadingAuth: get(isLoadingAuth)
  };
};

export const ssr = false;
export const prerender = false;
export const trailingSlash = 'always'; 