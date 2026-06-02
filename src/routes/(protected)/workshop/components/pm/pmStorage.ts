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
	workshopOrderId: string;
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

// Floor Scrubber Types
export type WaterClarity = '' | 'Clear' | 'Dark';
export type WaterLevel = '' | 'Overfilled' | 'Full' | 'Low';
export type BrushPartStatus = '' | 'Good' | 'Worn' | 'Needs Replacement';
export type YesNo = '' | 'Y' | 'N';

export type BatteryCellRow = {
	label: string;
	hydrometerReading: string;
	waterClarity: WaterClarity;
	waterLevel: WaterLevel;
};

export type BrushConditionState = {
	brush1Length: string;
	rotatedBrushes: YesNo;
	femaleBrushSocket: BrushPartStatus;
	maleHub: BrushPartStatus;
	diskPadDriver: BrushPartStatus;
};

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

export type OperationFooterState = {
	comments: string;
	testTag3Month: string;
	testTag6Month: string;
	testTag12Month: string;
	technicianName: string;
	technicianDate: string;
	technicianSignature: string;
	customerName: string;
	customerDate: string;
	customerSignature: string;
};

export type FloorScrubberDraft = {
	workshopOrderId: string;
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

const PMIS_STORAGE_KEY = 'rapidtools:workshop:pmis:draft';
const FLOOR_SCRUBBER_STORAGE_KEY = 'rapidtools:workshop:pm_floor_scrubber:draft';

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

// PMIS storage
export function loadPmisDraft(): PmisDraft | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(PMIS_STORAGE_KEY);
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
		localStorage.setItem(PMIS_STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// ignore
	}
}

export function clearPmisDraft(): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.removeItem(PMIS_STORAGE_KEY);
	} catch {
		// ignore
	}
}

// Floor Scrubber storage
export function loadFloorScrubberDraft(): FloorScrubberDraft | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(FLOOR_SCRUBBER_STORAGE_KEY);
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
		localStorage.setItem(FLOOR_SCRUBBER_STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// ignore
	}
}

export function clearFloorScrubberDraft(): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.removeItem(FLOOR_SCRUBBER_STORAGE_KEY);
	} catch {
		// ignore
	}
}
