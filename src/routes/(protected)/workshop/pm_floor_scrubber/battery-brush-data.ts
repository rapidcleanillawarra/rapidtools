export const BATTERY_CELL_LABELS = [
	'Cell A',
	'Cell B',
	'Cell C',
	'Cell D',
	'Cell E',
	'Cell F'
] as const;

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

export function createBatteryCells(): BatteryCellRow[] {
	return BATTERY_CELL_LABELS.map((label) => ({
		label,
		hydrometerReading: '',
		waterClarity: '',
		waterLevel: ''
	}));
}

export function createBrushCondition(): BrushConditionState {
	return {
		brush1Length: '',
		rotatedBrushes: '',
		femaleBrushSocket: '',
		maleHub: '',
		diskPadDriver: ''
	};
}
