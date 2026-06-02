import type { BatteryCellRow, BrushConditionState } from './battery-brush-data';
import type { OperationFooterState } from './operation-checklist-data';

const STORAGE_KEY = 'rapidtools:workshop:pm_floor_scrubber:draft';

export type FloorScrubberChecklistRowDraft = {
	task: string;
	inSpec: boolean;
	repair: boolean;
	problem: string;
};

export type FloorScrubberChecklistSectionDraft = {
	title: string;
	rows: FloorScrubberChecklistRowDraft[];
};

export type FloorScrubberDraft = {
	customer: string;
	email: string;
	address: string;
	phone: string;
	city: string;
	state: string;
	zip: string;
	contact: string;
	serialNumber: string;
	hourMeterKey: string;
	modelNumber: string;
	hourMeterTraction: string;
	workOrderNumber: string;
	hourMeterScrub: string;
	rechargeNumber: string;
	hourMeterVacuum: string;
	checklistSections: FloorScrubberChecklistSectionDraft[];
	battery1?: BatteryCellRow[];
	battery2?: BatteryCellRow[];
	brushCondition?: BrushConditionState;
	operationCheckPre?: FloorScrubberChecklistRowDraft[];
	operationCheckPost?: FloorScrubberChecklistRowDraft[];
	operationFooter?: OperationFooterState;
};

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

export function loadFloorScrubberDraft(): FloorScrubberDraft | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as FloorScrubberDraft;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveFloorScrubberDraft(draft: FloorScrubberDraft): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// Quota or private mode — ignore
	}
}

export function clearFloorScrubberDraft(): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
