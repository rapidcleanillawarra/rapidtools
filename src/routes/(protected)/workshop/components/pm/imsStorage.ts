export type OperatingHoursTotal = {
	controlOn: string;
	detergentBottles: string;
	gunSwitchings: string;
	burner: string;
	pump: string;
};

export type OperatingHoursSinceMaintenance = {
	gunSwitchings: string;
	burner: string;
	pump: string;
};

export type ImsSignatures = {
	testerSignature: string;
	customerSignature: string;
};

export type ImsDraft = {
	workshopOrderId: string;
	inspectionDate: string;
	orderNo: string;
	customerNo: string;
	machineType: string;
	typeNo: string;
	serialNumber: string;
	yearOfManufacture: string;
	purchaseDate: string;
	testerName: string;
	customerName: string;
	operatingHoursTotal: OperatingHoursTotal;
	operatingHoursSinceMaintenance: OperatingHoursSinceMaintenance;
	signatures: ImsSignatures;
};

const IMS_STORAGE_KEY = 'rapidtools:workshop:ims:draft';

function hasLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

export function createEmptyOperatingHoursTotal(): OperatingHoursTotal {
	return {
		controlOn: '',
		detergentBottles: '',
		gunSwitchings: '',
		burner: '',
		pump: ''
	};
}

export function createEmptyOperatingHoursSinceMaintenance(): OperatingHoursSinceMaintenance {
	return {
		gunSwitchings: '',
		burner: '',
		pump: ''
	};
}

export function createEmptyImsSignatures(): ImsSignatures {
	return {
		testerSignature: '',
		customerSignature: ''
	};
}

export function loadImsDraft(): ImsDraft | null {
	if (!hasLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(IMS_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ImsDraft;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveImsDraft(draft: ImsDraft): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.setItem(IMS_STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// ignore
	}
}

export function clearImsDraft(): void {
	if (!hasLocalStorage()) return;
	try {
		localStorage.removeItem(IMS_STORAGE_KEY);
	} catch {
		// ignore
	}
}
