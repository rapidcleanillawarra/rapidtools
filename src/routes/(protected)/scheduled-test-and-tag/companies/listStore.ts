import { writable } from 'svelte/store';
import type { CompanyListItem } from './types';

export const companiesListStore = writable<CompanyListItem[]>([]);
