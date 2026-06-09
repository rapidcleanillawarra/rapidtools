import { writable } from 'svelte/store';
import { createEmptyHeader } from './utils';
import type { EquipmentHeader, EquipmentTableRow } from './types';

export const equipmentHeader = writable<EquipmentHeader>(createEmptyHeader());
export const equipmentRows = writable<EquipmentTableRow[]>([]);
export const isLoading = writable(false);
