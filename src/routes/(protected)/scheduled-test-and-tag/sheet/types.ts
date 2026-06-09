export type SheetFrequency = '3 monthly' | '6 monthly' | '12 monthly';

export type SheetHeader = {
	companyId: string;
	company: string;
	location: string;
	serviceDate: string;
	frequency: SheetFrequency | '';
	sheetId?: string;
};

export type SheetRow = {
	id: string;
	rciTag: string;
	tag: string;
	machines: string;
	typeOfMachine: string;
	serialNumber: string;
	sku: string;
	size: string;
	active: boolean;
	results: string;
	workshopId: string;
	service: string;
	parts: string;
	notes: string;
};

export const FREQUENCY_OPTIONS: SheetFrequency[] = ['3 monthly', '6 monthly', '12 monthly'];

export const MACHINE_TYPE_OPTIONS = [
	'Floor Scrubber',
	'Pressure Washer',
	'Carpet Extractors',
	'Other'
] as const;

export type MachineType = (typeof MACHINE_TYPE_OPTIONS)[number];

export const SIZE_OPTIONS = ['SERV-SM', 'SERV-MD', 'SERV-LRG', 'SERV-PRESSLARG'] as const;

export type MachineSize = (typeof SIZE_OPTIONS)[number];

export const RESULT_OPTIONS = ['pass', 'fail'] as const;

export type ResultValue = (typeof RESULT_OPTIONS)[number] | '';

/** Columns that support multi-row paste from Excel / Google Sheets */
export const PASTEABLE_COLUMNS = [
	'tag',
	'machines',
	'typeOfMachine',
	'serialNumber',
	'sku',
	'size'
] as const;

export type PasteableColumnKey = (typeof PASTEABLE_COLUMNS)[number];

/** Text columns that accept single-cell or column-down Excel paste */
export const TEXT_PASTE_COLUMNS = [
	'tag',
	'machines',
	'typeOfMachine',
	'serialNumber',
	'sku',
	'size',
	'workshopId',
	'service',
	'parts',
	'notes'
] as const;

export type TextPasteColumnKey = (typeof TEXT_PASTE_COLUMNS)[number];

export const SHEET_COLUMNS = [
	{ key: 'tag' as const, label: 'Tag' },
	{ key: 'machines' as const, label: 'Machines' },
	{ key: 'typeOfMachine' as const, label: 'Type of Machine' },
	{ key: 'serialNumber' as const, label: 'Serial #' },
	{ key: 'sku' as const, label: 'SKU' },
	{ key: 'size' as const, label: 'Size' },
	{ key: 'active' as const, label: 'Active' },
	{ key: 'results' as const, label: 'Results' },
	{ key: 'workshopId' as const, label: 'Workshop ID' },
	{ key: 'service' as const, label: 'Service' },
	{ key: 'parts' as const, label: 'Parts' },
	{ key: 'notes' as const, label: 'Notes' }
] as const;

export type SheetColumnKey = (typeof SHEET_COLUMNS)[number]['key'];
