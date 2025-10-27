/**
 * Workshop Job Status Management Service
 *
 * Centralizes all job status evaluation logic and business rules.
 * This ensures consistent behavior across all components that need status information.
 */

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
  | 'pending_jobs'
  | null;

export interface JobStatusContext {
  existingWorkshopId: string | null;
  workshopStatus: JobStatus;
  existingOrderId: string | null;
  locationOfMachine: 'Site' | 'Workshop';
  siteLocation: string;
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

/**
 * CRITICAL: Evaluates job status and determines allowed actions
 * This function contains the core business logic for job state management.
 * All status-dependent behavior should derive from this single source of truth.
 * DO NOT MODIFY THIS WITHOUT CAREFUL CONSIDERATION OF BUSINESS IMPACT
 */
export function evaluateJobStatus(context: JobStatusContext): JobStatusResult {
  const { existingWorkshopId, workshopStatus, existingOrderId, locationOfRepair, siteLocation } = context;

  console.log('Evaluating job status:', context);

  // ============================================
  // PRIORITY 1: PICKUP STATUS JOBS (Highest Priority)
  // ============================================
  // Jobs that are already in pickup status (delivered to workshop)
  if (existingWorkshopId && workshopStatus === 'pickup') {
    return {
      canEditMachineInfo: false,  // Pickup jobs cannot modify machine info
      canEditUserInfo: false,     // Pickup jobs cannot modify user info
      canEditContacts: false,     // Pickup jobs cannot modify contacts
      canCreateOrder: false,      // Pickup jobs never create Maropost orders
      canPickup: false,          // Already picked up
      buttonText: 'Delivered/To Be Quoted',
      statusDisplay: 'Pickup',
      priority: 1
    };
  }

  // ============================================
  // PRIORITY 2: NEW JOBS
  // ============================================
  // Brand new jobs that haven't been saved yet
  if (workshopStatus === 'new') {
    // Special case: If location is Site, this becomes a pickup job
    const isPickupJob = locationOfRepair === 'Site';

    return {
      canEditMachineInfo: true,   // Can edit everything for new jobs
      canEditUserInfo: true,
      canEditContacts: true,
      canCreateOrder: false,      // New jobs don't create orders until submitted
      canPickup: isPickupJob,     // Site repairs are pickup jobs
      buttonText: isPickupJob ? 'Pickup →' : 'To be Quoted',
      statusDisplay: 'New',
      priority: 2
    };
  }

  // ============================================
  // PRIORITY 3: BRAND NEW FORMS (No existing workshop)
  // ============================================
  // Forms that are being created from scratch (no workshop_id in URL)
  if (!existingWorkshopId) {
    // Special case: If location is Site, this becomes a pickup job
    const isPickupJob = locationOfRepair === 'Site';

    return {
      canEditMachineInfo: true,   // Can edit everything for new forms
      canEditUserInfo: true,
      canEditContacts: true,
      canCreateOrder: false,      // New forms don't create orders until submitted
      canPickup: isPickupJob,     // Site repairs are pickup jobs
      buttonText: isPickupJob ? 'Pickup →' : 'Create Job',
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
      canEditMachineInfo: false,  // Cannot edit machine info once quoted
      canEditUserInfo: false,     // Cannot edit user info once quoted
      canEditContacts: true,      // Can still add contacts for quoted jobs
      canCreateOrder: !existingOrderId, // Can create order if doesn't have one
      canPickup: false,          // Quoted jobs aren't pickups
      buttonText: 'Docket Ready',
      statusDisplay: 'To Be Quoted',
      priority: 4
    };
  }

  // ============================================
  // PRIORITY 4.5: COMPLETED JOBS (Quoted or Repaired)
  // ============================================
  // Jobs that have been quoted or repaired (final statuses)
  if (existingWorkshopId && (workshopStatus === 'quoted' || workshopStatus === 'repaired')) {
    return {
      canEditMachineInfo: false,  // Cannot edit machine info for completed jobs
      canEditUserInfo: false,     // Cannot edit user info for completed jobs
      canEditContacts: false,     // Cannot edit contacts for completed jobs
      canCreateOrder: false,      // Completed jobs don't create new orders
      canPickup: false,          // Completed jobs aren't pickups
      buttonText: 'Update Job',
      statusDisplay: workshopStatus === 'quoted' ? 'Quoted' : 'Repaired',
      priority: 4.5
    };
  }

  // ============================================
  // PRIORITY 5: OTHER EXISTING JOBS (Default)
  // ============================================
  // Unknown status jobs (fallback for any unhandled statuses)
  return {
    canEditMachineInfo: false,  // Cannot edit machine info for active jobs
    canEditUserInfo: false,     // Cannot edit user info for active jobs
    canEditContacts: false,     // Cannot edit contacts for active jobs
    canCreateOrder: false,      // Active jobs shouldn't create new orders
    canPickup: false,          // Active jobs aren't pickups
    buttonText: 'Update Job',
    statusDisplay: workshopStatus?.replace('_', ' ') || 'Unknown',
    priority: 5
  };
}

/**
 * Determines if pickup schedule is required
 */
export function isPickupScheduleRequired(
  workshopStatus: JobStatus,
  existingWorkshopId: string | null,
  locationOfRepair: 'Site' | 'Workshop'
): boolean {
  return (workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site';
}

/**
 * Gets the submit button loading text based on current state
 */
export function getSubmitButtonLoadingText(
  currentJobStatus: JobStatusResult,
  existingWorkshopId: string | null,
  workshopStatus: JobStatus
): string {
  // Use status-based button text only
  if (currentJobStatus.canPickup) {
    return 'Processing...';
  }

  if (!existingWorkshopId) {
    // New workshop creation - will be set to 'to_be_quoted' status
    return 'Creating Quote...';
  }

  if (workshopStatus === 'new') {
    // Workshop with new status - will be set to 'to_be_quoted' status
    return 'Creating Quote...';
  }

  if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
    // Workshop with "to be quoted" status
    return 'Processing...';
  }

  // Default for other actions
  return 'Next...';
}
