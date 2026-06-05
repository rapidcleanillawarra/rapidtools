export type ChecklistStatus = '' | 'pass' | 'fail';

export type CarpetExtractorChecklistRowDraft = {
	task: string;
	status: ChecklistStatus;
	notes: string;
};

export type CarpetExtractorChecklistSectionDraft = {
	title: string;
	rows: CarpetExtractorChecklistRowDraft[];
};

export type CarpetExtractorPartRowDraft = {
	part: string;
	qty: string;
	notes: string;
};

export type CarpetExtractorDraft = {
	workshopOrderId: string;
	companyName: string;
	customerName: string;
	siteLocation: string;
	contactPerson: string;
	technicianName: string;
	inspectionDate: string;
	machineModel: string;
	serialNumber: string;
	assetId: string;
	hoursRun: string;
	email: string;
	address: string;
	phone: string;
	city: string;
	state: string;
	zip: string;
	contact: string;
	hourMeterKey: string;
	hourMeterTraction: string;
	hourMeterScrub: string;
	hourMeterVacuum: string;
	rechargeNumber: string;
	workOrderNumber: string;
	checklistSections: CarpetExtractorChecklistSectionDraft[];
	parts: CarpetExtractorPartRowDraft[];
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

const STORAGE_KEY = 'rapidtools:workshop:pmis:draft';

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

export function loadCarpetExtractorDraft(): CarpetExtractorDraft | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CarpetExtractorDraft;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveCarpetExtractorDraft(draft: CarpetExtractorDraft): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// ignore
	}
}

export function clearCarpetExtractorDraft(): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
