import { writable } from 'svelte/store';
import { createEmptyHeader } from './utils';
import type { SheetHeader, SheetRow } from './types';

export const sheetHeader = writable<SheetHeader>(createEmptyHeader());
export const sheetRows = writable<SheetRow[]>([]);
export const inactiveSheetRows = writable<SheetRow[]>([]);
export const isLoading = writable(false);
