export type LocationType = 'Site' | 'Workshop';

export type QuoteOrRepairType = 'Quote' | 'Repaired';

export type PartItem = { sku: string; quantity: string };

export type JobStatus =
	| 'new'
	| 'pickup'
	| 'to_be_quoted'
	| 'docket_ready'
	| 'quoted'
	| 'repaired'
	| 'waiting_approval_po'
	| 'waiting_for_parts'
	| 'booked_in_for_repair_service'
	| 'deliver_to_workshop'
	| 'pending_jobs'
	| 'return'
	| 'completed'
	| 'to_be_scrapped'
	| 'pickup_from_workshop'
	| 'warranty_claim'
	| null;

export interface JobStatusContext {
	existingWorkshopId: string | null;
	workshopStatus: JobStatus;
	existingOrderId: string | null;
	locationOfMachine: LocationType;
	siteLocation: string;
	quoteOrRepair: QuoteOrRepairType;
	action: string;
}

export interface JobStatusResult {
	canEditMachineInfo: boolean;
	canEditUserInfo: boolean;
	canEditContacts: boolean;
	canCreateOrder: boolean;
	canPickup: boolean;
	buttonText: string;
	statusDisplay: string;
	priority: number; // Lower number = higher priority
}