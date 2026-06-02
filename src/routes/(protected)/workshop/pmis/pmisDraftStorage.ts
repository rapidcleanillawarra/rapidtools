const STORAGE_KEY = 'rapidtools:workshop:pmis:draft';

export type ChecklistStatus = '' | 'pass' | 'fail';

export type PmisChecklistRowDraft = {
	task: string;
	status: ChecklistStatus;
	notes: string;
};

export type PmisChecklistSectionDraft = {
	title: string;
	rows: PmisChecklistRowDraft[];
};

export type PmisPartRowDraft = {
	part: string;
	qty: string;
	notes: string;
};

export type PmisDraft = {
	customerName: string;
	siteLocation: string;
	contactPerson: string;
	technicianName: string;
	inspectionDate: string;
	machineModel: string;
	serialNumber: string;
	assetId: string;
	hoursRun: string;
	checklistSections: PmisChecklistSectionDraft[];
	parts: PmisPartRowDraft[];
	recNone: boolean;
	recMinor: boolean;
	recMajor: boolean;
	recReplace: boolean;
	recDetails: string;
	outcomeCompleted: boolean;
	outcomePartial: boolean;
	outcomeUnsafe: boolean;
	techSignature: string;
	customerRep: string;
};

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

export function loadPmisDraft(): PmisDraft | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PmisDraft;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function savePmisDraft(draft: PmisDraft): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// Quota or private mode — ignore
	}
}

export function clearPmisDraft(): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
