import type {
	BatteryCellRow,
	BrushConditionState,
	OperationFooterState
} from './floor_scrubber_storage';

export type ChecklistSectionDef = {
	ariaLabel: string;
	title: string;
	taskHeader?: string;
	tasks: string[];
};

export const FLOOR_SCRUBBER_CHECKLIST_SECTIONS: ChecklistSectionDef[] = [
	{
		ariaLabel: 'Clean and inspect',
		title: 'Clean & Inspect',
		taskHeader: 'Clean & Inspect',
		tasks: [
			'Drain / Rinse Recovery Tank',
			'Drain Hose & Plug',
			'Drain / Flush Solution Tank',
			'White Vacuum Box Filter',
			'Vacuum Float Ball Screen',
			'Drain Saver Basket',
			'Recovery Tank Lid & Gasket',
			'Solution Filter',
			'Squeegee Blades / Flip To New Edge',
			'Squeegee Wheels',
			'Blade Retainers & Hardware',
			'Vacuum Hoses',
			'Wheel Condition',
			'Brush Deck Skirts'
		]
	},
	{
		ariaLabel: 'Clean and lubricate',
		title: 'Clean & Lubricate',
		taskHeader: 'Clean & Lubricate',
		tasks: [
			'Squeegee Pivot Points & Knobs',
			'Scrub Deck Linkage',
			'Grease Caster Swivel'
		]
	}
];

export const BATTERY_CELL_LABELS = [
	'Cell A',
	'Cell B',
	'Cell C',
	'Cell D',
	'Cell E',
	'Cell F'
] as const;

export const OPERATION_CHECK_PRE_TASKS = [
	'Key Switch',
	'Battery Gauge',
	'Reverse & E-Stop Switch',
	'Battery Charger Connectors & Function',
	'Pitch of Scrub Deck (Must be level)'
] as const;

export const OPERATION_CHECK_POST_TASKS = [
	'Brush Switch',
	'Brush Deck Lift System',
	'Solution Switch',
	'Solution +/- Lever',
	'Solution Solenoid Valve',
	'Solution Hoses',
	'Brush Motors',
	'Vacuum Switch',
	'Squeegee Lift System',
	'Vacuum Motor Performance',
	'Squeegee Adjustment – Pitch & Height',
	'Spray Jet/Wand Pump, Hose, & Nozzle'
] as const;

export const FILL_SOLUTION_TANK_NOTE =
	'NOTE: Fill Solution Tank Before Continuing';

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

export function createOperationFooter(): OperationFooterState {
	return {
		comments: '',
		testTag3Month: '',
		testTag6Month: '',
		testTag12Month: '',
		technicianName: '',
		technicianDate: '',
		technicianSignature: '',
		customerName: '',
		customerDate: '',
		customerSignature: ''
	};
}
