import type {
	BatteryCellRow,
	BrushConditionState,
	OperationFooterState
} from './pmStorage';

export type PmChecklistSectionDef = {
	ariaLabel: string;
	title: string;
	taskHeader?: string;
	tasks: string[];
};

export const PMIS_CHECKLIST_SECTIONS: PmChecklistSectionDef[] = [
	{
		ariaLabel: 'Section 2',
		title: '2. Pre-Inspection Condition',
		tasks: [
			'Machine clean on arrival',
			'Visible damage (frame, tank, handles)',
			'Leaks present',
			'Customer-reported issues'
		]
	},
	{
		ariaLabel: 'Section 3',
		title: '3. Electrical System (Corded Units)',
		tasks: [
			'Power cable condition (cuts, frays, kinks)',
			'Plug integrity (pins, casing)',
			'Cable strain relief secure',
			'Switch operation (on/off)',
			'RCD / safety device (if fitted)',
			'Electrical test & tag performed',
			'Test & Tag Result (Pass/Fail)',
			'Tag applied'
		]
	},
	{
		ariaLabel: 'Section 4',
		title: '4. Battery System (Battery Units)',
		tasks: [
			'Battery condition (physical damage/swelling)',
			'Terminal connections clean/tight',
			'Charger condition & operation',
			'Charging cycle tested',
			'Battery voltage checked',
			'Runtime performance acceptable',
			'Wiring harness condition'
		]
	},
	{
		ariaLabel: 'Section 5',
		title: '5. Vacuum System',
		tasks: [
			'Vacuum motor operation',
			'Suction strength adequate',
			'Vacuum hose condition (cracks/blockages)',
			'Recovery tank lid seal/gasket',
			'Float shut-off functioning',
			'Filters clean and intact'
		]
	},
	{
		ariaLabel: 'Section 6',
		title: '6. Pump & Solution System',
		tasks: [
			'Solution pump operation',
			'Pump pressure adequate',
			'Spray jets/nozzles clear',
			'Solution lines free of leaks',
			'Trigger/spray switch operation',
			'Tank condition (cracks/contamination)'
		]
	},
	{
		ariaLabel: 'Section 7',
		title: '7. Brush / Agitation System',
		tasks: [
			'Brush motor operation',
			'Brush condition (wear, damage)',
			'Brush rotation consistent',
			'Drive belt condition (if applicable)'
		]
	},
	{
		ariaLabel: 'Section 8',
		title: '8. Recovery System',
		tasks: [
			'Recovery tank clean',
			'Drain hose condition',
			'Drain valve operation',
			'Odour or contamination present'
		]
	},
	{
		ariaLabel: 'Section 9',
		title: '9. Wheels, Frame & General Mechanics',
		tasks: [
			'Wheels/rollers condition',
			'Handle and adjustment mechanisms',
			'Fasteners secure',
			'Frame integrity'
		]
	},
	{
		ariaLabel: 'Section 10',
		title: '10. Functional Test (Post-Service)',
		taskHeader: 'Test',
		tasks: [
			'Machine powers on correctly',
			'Spray system working',
			'Vacuum recovery effective',
			'No leaks during operation',
			'Noise/vibration within normal range'
		]
	}
];

export const FLOOR_SCRUBBER_CHECKLIST_SECTIONS: PmChecklistSectionDef[] = [
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
