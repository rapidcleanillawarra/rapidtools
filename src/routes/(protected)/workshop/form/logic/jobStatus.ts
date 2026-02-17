import type { JobStatus, JobStatusContext, JobStatusResult } from './types';

/**
 * CRITICAL: Evaluates job status and determines allowed actions
 * This function contains the core business logic for job state management.
 * All status-dependent behavior should derive from this single source of truth.
 */
export function evaluateJobStatus(context: JobStatusContext): JobStatusResult {
	const {
		existingWorkshopId,
		workshopStatus,
		existingOrderId,
		locationOfMachine,
		siteLocation,
		quoteOrRepair,
		action
	} = context;

	// ============================================
	// PRIORITY 1: PICKUP STATUS JOBS (Highest Priority)
	// ============================================
	// Jobs that are already in pickup status (delivered to workshop)
	if (existingWorkshopId && workshopStatus === 'pickup') {
		return {
			canEditMachineInfo: false, // Pickup jobs cannot modify machine info
			canEditUserInfo: false, // Pickup jobs cannot modify user info
			canEditContacts: false, // Pickup jobs cannot modify contacts
			canCreateOrder: false, // Pickup jobs never create Maropost orders
			canPickup: false, // Already picked up
			buttonText:
				action === 'Pickup'
					? 'Pickup Delivered'
					: action === 'Repair'
						? 'Repair Delivered'
						: 'Delivered to Workshop',
			statusDisplay: 'Pickup',
			priority: 1
		};
	}

	// ============================================
	// PRIORITY 2: NEW JOBS
	// ============================================
	// Brand new jobs that haven't been saved yet
	if (workshopStatus === 'new') {
		// Special case: If action is Pickup, this becomes a pickup job
		const isPickupJob = action === 'Pickup';

		return {
			canEditMachineInfo: true, // Can edit everything for new jobs
			canEditUserInfo: true,
			canEditContacts: true,
			canCreateOrder: false, // New jobs don't create orders until submitted
			canPickup: isPickupJob, // Pickup action means pickup jobs
			buttonText:
				action === 'Pickup'
					? 'Schedule Pickup'
					: action === 'Repair'
						? 'Schedule Repair'
						: 'Schedule Delivery',
			statusDisplay: 'New',
			priority: 2
		};
	}

	// ============================================
	// PRIORITY 3: BRAND NEW FORMS (No existing workshop)
	// ============================================
	// Forms that are being created from scratch (no workshop_id in URL)
	if (!existingWorkshopId) {
		// Special case: If action is Pickup, this becomes a pickup job
		const isPickupJob = action === 'Pickup';

		return {
			canEditMachineInfo: true, // Can edit everything for new forms
			canEditUserInfo: true,
			canEditContacts: true,
			canCreateOrder: false, // New forms don't create orders until submitted
			canPickup: isPickupJob, // Pickup action means pickup jobs
			buttonText:
				action === 'Pickup'
					? 'Schedule Pickup'
					: action === 'Repair'
						? 'Schedule Repair'
						: 'Schedule Delivery',
			statusDisplay: 'New',
			priority: 3
		};
	}

	// ============================================
	// PRIORITY 4: TO BE QUOTED STATUS
	// ============================================
	// Jobs that are ready for quoting/docket creation
	if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
		return {
			canEditMachineInfo: true, // Allow editing machine info for to_be_quoted jobs
			canEditUserInfo: true, // Allow editing user info for to_be_quoted jobs
			canEditContacts: true, // Can still add contacts for quoted jobs
			canCreateOrder: !existingOrderId, // Can create order if doesn't have one
			canPickup: false, // Quoted jobs aren't pickups
			buttonText: 'Docket Ready',
			statusDisplay: 'To Be Quoted',
			priority: 4
		};
	}

	// ============================================
	// PRIORITY 4.1: DOCKET READY STATUS
	// ============================================
	// Jobs that have docket information ready
	if (existingWorkshopId && workshopStatus === 'docket_ready') {
		return {
			canEditMachineInfo: true, // Allow editing machine info for docket ready jobs
			canEditUserInfo: true, // Allow editing user info for docket ready jobs
			canEditContacts: true, // Allow editing contacts for docket ready jobs
			canCreateOrder: false, // Docket ready jobs don't create new orders
			canPickup: false, // Docket ready jobs aren't pickups
			buttonText: quoteOrRepair === 'Quote' ? 'Quoted' : 'Repaired',
			statusDisplay: 'Docket Ready',
			priority: 4.1
		};
	}

	// ============================================
	// PRIORITY 4.5: COMPLETED JOBS (Quoted or Repaired)
	// ============================================
	// Jobs that have been quoted or repaired (final statuses)
	if (existingWorkshopId && (workshopStatus === 'quoted' || workshopStatus === 'repaired')) {
		return {
			canEditMachineInfo: false, // Cannot edit machine info for completed jobs
			canEditUserInfo: false, // Cannot edit user info for completed jobs
			canEditContacts: false, // Cannot edit contacts for completed jobs
			canCreateOrder: false, // Completed jobs don't create new orders
			canPickup: false, // Completed jobs aren't pickups
			buttonText: workshopStatus === 'quoted' ? 'Waiting Approval PO' : 'Update Job',
			statusDisplay: workshopStatus === 'quoted' ? 'Quoted' : 'Repaired',
			priority: 4.5
		};
	}

	// ============================================
	// PRIORITY 4.6: WAITING APPROVAL PO STATUS
	// ============================================
	// Jobs that are waiting for PO approval
	if (existingWorkshopId && workshopStatus === 'waiting_approval_po') {
		return {
			canEditMachineInfo: true, // Allow editing machine info while waiting for approval
			canEditUserInfo: true, // Allow editing user info while waiting for approval
			canEditContacts: true, // Allow editing contacts while waiting for approval
			canCreateOrder: false, // Already processed for approval
			canPickup: false, // Not a pickup job
			buttonText: 'Waiting For Parts',
			statusDisplay: 'Waiting Approval PO',
			priority: 4.6
		};
	}

	// ============================================
	// PRIORITY 4.6.5: WAITING FOR PARTS STATUS
	// ============================================
	// Jobs that are waiting for parts
	if (existingWorkshopId && workshopStatus === 'waiting_for_parts') {
		return {
			canEditMachineInfo: false, // Cannot edit machine info while waiting for parts
			canEditUserInfo: false, // Cannot edit user info while waiting for parts
			canEditContacts: false, // Cannot edit contacts while waiting for parts
			canCreateOrder: false, // Already processed
			canPickup: false, // Not a pickup job
			buttonText: 'Booked In For Repair',
			statusDisplay: 'Waiting For Parts',
			priority: 4.65
		};
	}

	// ============================================
	// PRIORITY 4.7: BOOKED IN FOR REPAIR SERVICE STATUS
	// ============================================
	// Jobs that are booked in for repair service
	if (existingWorkshopId && workshopStatus === 'booked_in_for_repair_service') {
		return {
			canEditMachineInfo: false, // Cannot edit machine info while in repair
			canEditUserInfo: false, // Cannot edit user info while in repair
			canEditContacts: false, // Cannot edit contacts while in repair
			canCreateOrder: false, // Already processed
			canPickup: false, // Not a pickup job
			buttonText: 'Repaired',
			statusDisplay: 'Booked In For Repair Service',
			priority: 4.7
		};
	}

	// ============================================
	// PRIORITY 4.8: REPAIRED STATUS
	// ============================================
	// Jobs that have been repaired
	if (existingWorkshopId && workshopStatus === 'repaired') {
		return {
			canEditMachineInfo: false, // Cannot edit machine info for repaired jobs
			canEditUserInfo: false, // Cannot edit user info for repaired jobs
			canEditContacts: false, // Cannot edit contacts for repaired jobs
			canCreateOrder: false, // Already processed
			canPickup: false, // Not a pickup job
			buttonText: 'Proceed',
			statusDisplay: 'Repaired',
			priority: 4.8
		};
	}

	// ============================================
	// PRIORITY 4.9: COMPLETED STATUS
	// ============================================
	// Jobs that have been completed and returned to customer
	if (existingWorkshopId && workshopStatus === 'completed') {
		return {
			canEditMachineInfo: false, // Cannot edit machine info for completed jobs
			canEditUserInfo: false, // Cannot edit user info for completed jobs
			canEditContacts: false, // Cannot edit contacts for completed jobs
			canCreateOrder: false, // Already processed
			canPickup: false, // Not a pickup job
			buttonText: 'Job Completed',
			statusDisplay: 'Completed',
			priority: 4.9
		};
	}

	// ============================================
	// PRIORITY 5: OTHER EXISTING JOBS (Default)
	// ============================================
	// Unknown status jobs (fallback for any unhandled statuses)
	// Special case: If workshop exists but status is null, we're still loading
	const isLoadingWorkshop = existingWorkshopId && workshopStatus === null;
	return {
		canEditMachineInfo: false, // Cannot edit machine info for active jobs
		canEditUserInfo: false, // Cannot edit user info for active jobs
		canEditContacts: false, // Cannot edit contacts for active jobs
		canCreateOrder: false, // Active jobs shouldn't create new orders
		canPickup: false, // Active jobs aren't pickups
		buttonText: isLoadingWorkshop ? 'Loading...' : 'Update Job',
		statusDisplay: isLoadingWorkshop
			? 'Loading...'
			: workshopStatus?.replace('_', ' ') || 'Unknown',
		priority: 5
	};
}