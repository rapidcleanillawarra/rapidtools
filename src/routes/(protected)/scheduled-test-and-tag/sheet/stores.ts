import { writable } from 'svelte/store';
import { createEmptyHeader, createEmptyRow } from './utils';
import type { SheetHeader, SheetRow } from './types';

export const sheetHeader = writable<SheetHeader>(createEmptyHeader());
export const sheetRows = writable<SheetRow[]>([createEmptyRow()]);
export const isLoading = writable(false);
