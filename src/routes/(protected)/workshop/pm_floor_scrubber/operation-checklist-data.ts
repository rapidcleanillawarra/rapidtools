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
