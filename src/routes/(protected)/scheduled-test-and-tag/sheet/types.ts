export type SheetFrequency = '3 monthly' | '6 monthly' | '12 monthly';

export type SheetHeader = {
	company: string;
	location: string;
	serviceDate: string;
	frequency: SheetFrequency | '';
};

export type SheetRow = {
	id: string;
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

export const SHEET_COLUMNS = [
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
