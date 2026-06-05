export type CustomerInfoFields = {
	email: string;
	address: string;
	phone: string;
	city: string;
	state: string;
	zip: string;
	contact: string;
};

export type MachineHourMeterFields = {
	hourMeterKey: string;
	hourMeterTraction: string;
	hourMeterScrub: string;
	hourMeterVacuum: string;
	rechargeNumber: string;
	workOrderNumber: string;
};

export function createEmptyCustomerInfoFields(): CustomerInfoFields {
	return { email: '', address: '', phone: '', city: '', state: '', zip: '', contact: '' };
}

export function createEmptyMachineHourMeterFields(): MachineHourMeterFields {
	return {
		hourMeterKey: '',
		hourMeterTraction: '',
		hourMeterScrub: '',
		hourMeterVacuum: '',
		rechargeNumber: '',
		workOrderNumber: ''
	};
}
