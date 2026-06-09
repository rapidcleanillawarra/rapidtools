export type EquipmentHeader = {
	companyId: string;
	company: string;
};

export type EquipmentTableRow = {
	id: string;
	rciTag: string;
	tag: string;
	name: string;
	typeOfMachine: string;
	serialNumber: string;
	sku: string;
	size: string;
	active: boolean;
	startMonth: number;
	frequency: number;
};

export const MACHINE_TYPE_OPTIONS = [
	'Floor Scrubber',
	'Pressure Washer',
	'Carpet Extractors',
	'Other'
] as const;

export const SIZE_OPTIONS = ['SERV-SM', 'SERV-MD', 'SERV-LRG', 'SERV-PRESSLARG'] as const;

export const FREQUENCY_MONTH_OPTIONS = [3, 6, 12] as const;

export const MONTH_OPTIONS = [
	{ value: 1, label: 'Jan' },
	{ value: 2, label: 'Feb' },
	{ value: 3, label: 'Mar' },
	{ value: 4, label: 'Apr' },
	{ value: 5, label: 'May' },
	{ value: 6, label: 'Jun' },
	{ value: 7, label: 'Jul' },
	{ value: 8, label: 'Aug' },
	{ value: 9, label: 'Sep' },
	{ value: 10, label: 'Oct' },
	{ value: 11, label: 'Nov' },
	{ value: 12, label: 'Dec' }
] as const;

/** Columns that support multi-row paste from Excel / Google Sheets */
export const PASTEABLE_COLUMNS = [
	'rciTag',
	'tag',
	'name',
	'typeOfMachine',
	'serialNumber',
	'sku',
	'size'
] as const;

export type PasteableColumnKey = (typeof PASTEABLE_COLUMNS)[number];

/** Text columns that accept single-cell or column-down Excel paste */
export const TEXT_PASTE_COLUMNS = [...PASTEABLE_COLUMNS] as const;

export type TextPasteColumnKey = (typeof TEXT_PASTE_COLUMNS)[number];

export const EQUIPMENT_COLUMNS = [
	{ key: 'rciTag' as const, label: 'RCI Tag' },
	{ key: 'tag' as const, label: 'Customer Tag' },
	{ key: 'name' as const, label: 'Name' },
	{ key: 'typeOfMachine' as const, label: 'Type' },
	{ key: 'serialNumber' as const, label: 'Serial #' },
	{ key: 'sku' as const, label: 'SKU' },
	{ key: 'size' as const, label: 'Size' },
	{ key: 'active' as const, label: 'Active' },
	{ key: 'startMonth' as const, label: 'Start Month' },
	{ key: 'frequency' as const, label: 'Frequency' }
] as const;

export type EquipmentColumnKey = (typeof EQUIPMENT_COLUMNS)[number]['key'];
