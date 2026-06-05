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
	companyName: string;
	customer: string;
	siteLocation: string;
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

const STORAGE_KEY = 'rapidtools:workshop:pm_floor_scrubber:draft';

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
		// ignore
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
