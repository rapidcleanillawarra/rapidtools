/**
 * Workshop Form Service
 *
 * Handles form validation, submission logic, and business rules for workshop forms.
 */

import { validateWorkshopForm } from '$lib/utils/validation';
import type { PhotoItem, Contact } from '$lib/types/workshop';
import type { Customer } from '$lib/services/customers';
import type { JobStatus, JobStatusContext } from './workshop-status.service';

export interface WorkshopFormData {
  locationOfMachine: 'Site' | 'Workshop';
  productName: string;
  clientsWorkOrder: string;
  makeModel: string;
  serialNumber: string;
  siteLocation: string;
  schedules: any;
  faultDescription: string;
  customerName: string;
  contactEmail: string;
  contactNumber: string;
  selectedCustomer: Customer | null;
  optionalContacts: Contact[];
  photos: File[];
  existingPhotoUrls: string[];
  startedWith: 'form' | 'camera';
  quoteOrRepaired: 'Quote' | 'Repaired';
  status?: string;
  quoteDescription?: string;
  additionalInformation?: string;
  stockOnHand?: string;
  labour?: string;
  travelTime?: string;
  callOut?: string;
  parts?: Array<{ sku: string; quantity: string }>;
  docket_info?: {
    quoteOrRepair: 'Quote' | 'Repair';
    quoteDescription: string;
    additionalInformation: string;
    stockOnHand: string;
    labour: string;
    travelTime: string;
    callOut: string;
    parts: Array<{ sku: string; quantity: string }>;
  };
  customerApiData?: any;
  orderApiData?: any;
  order_id?: string | null;
  status?: JobStatus;
  comments?: Array<{
    id: string;
    text: string;
    author: string;
    created_at: string;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates the workshop form based on current status and context
 */
export function validateForm(
  formData: Partial<WorkshopFormData>,
  context: JobStatusContext
): ValidationResult {
  const { workshopStatus, existingWorkshopId, locationOfRepair, siteLocation, schedules } = context;

  const isNewPickupJob = (workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site';

  return validateWorkshopForm({
    productName: formData.productName || '',
    customerName: formData.customerName || '',
    locationOfRepair,
    siteLocation,
    pickupSchedule: schedules?.pickup_schedule || '',
    isNewPickupJob
  });
}

/**
 * Determines the status to set when submitting the form
 */
export function determineSubmissionStatus(
  existingWorkshopId: string | null,
  workshopStatus: JobStatus,
  locationOfRepair: 'Site' | 'Workshop',
  wasPickupJob: boolean
): JobStatus {
  // Simple logic: if current status is new and location is Site, set to pickup
  if ((workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site') {
    return 'pickup';
  }

  // For existing pickup jobs being submitted, update to "to_be_quoted"
  if (existingWorkshopId && workshopStatus === 'pickup') {
    return 'to_be_quoted';
  }

  // For existing "to_be_quoted" jobs, change status to docket_ready
  if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
    return 'docket_ready';
  }

  // Default: set to "to_be_quoted"
  return 'to_be_quoted';
}

/**
 * Prepares form data for submission by filtering and organizing fields
 */
export function prepareFormData(
  rawFormData: Partial<WorkshopFormData>,
  photos: PhotoItem[],
  existingWorkshopId: string | null,
  workshopStatus: JobStatus,
  generatedOrderId?: string
): WorkshopFormData {
  // Separate new photos from existing photos
  const newPhotos = photos.filter(p => !p.isExisting).map(p => p.file);
  const existingPhotoUrls = photos.filter(p => p.isExisting).map(p => p.url);

  const formData: WorkshopFormData = {
    locationOfRepair: rawFormData.locationOfRepair || 'Site',
    productName: rawFormData.productName || '',
    clientsWorkOrder: rawFormData.clientsWorkOrder || '',
    makeModel: rawFormData.makeModel || '',
    serialNumber: rawFormData.serialNumber || '',
    siteLocation: rawFormData.siteLocation || '',
    schedules: rawFormData.schedules,
    faultDescription: rawFormData.faultDescription || '',
    customerName: rawFormData.customerName || '',
    contactEmail: rawFormData.contactEmail || '',
    contactNumber: rawFormData.contactNumber || '',
    selectedCustomer: rawFormData.selectedCustomer || null,
    optionalContacts: rawFormData.optionalContacts || [],
    photos: newPhotos,
    existingPhotoUrls,
    startedWith: rawFormData.startedWith || 'form',
    quoteOrRepaired: rawFormData.quoteOrRepaired || 'Quote'
  };

  // Include docket info when submitting from "to_be_quoted" status
  if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
    formData.docket_info = {
      quoteOrRepair: rawFormData.quoteOrRepaired || 'Quote',
      quoteDescription: rawFormData.quoteDescription || '',
      additionalInformation: rawFormData.additionalInformation || '',
      stockOnHand: rawFormData.stockOnHand || '',
      labour: rawFormData.labour || '',
      travelTime: rawFormData.travelTime || '',
      callOut: rawFormData.callOut || '',
      parts: (rawFormData.parts || []).filter(part => part.sku.trim() || part.quantity.trim())
    };
  }

  // Include order data for existing workshops
  if (existingWorkshopId) {
    formData.customerApiData = rawFormData.customerApiData;
    formData.orderApiData = rawFormData.orderApiData;
    formData.order_id = generatedOrderId || null;
  }

  return formData;
}

/**
 * Determines the appropriate success message based on the submission context
 */
export function getSuccessMessage(
  existingWorkshopId: string | null,
  workshopStatus: JobStatus,
  locationOfRepair: 'Site' | 'Workshop',
  wasPickupJob: boolean,
  quoteOrRepair: 'Quote' | 'Repaired'
): string {
  // For new pickup submissions
  if ((workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site') {
    return 'Workshop created successfully as a pickup job!';
  }

  // For pickup job submissions
  if (wasPickupJob) {
    return 'Pickup job submitted successfully and moved to "To Be Quoted" status!';
  }

  // For existing "to_be_quoted" jobs
  if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
    return 'Workshop docket information saved successfully and status updated to "Docket Ready"!';
  }

  // Default success messages for updates
  if (existingWorkshopId) {
    const wasToBeQuoted = workshopStatus === 'to_be_quoted';
    const hadExistingOrder = !generatedOrderId; // This would need to be passed in

    if (wasToBeQuoted) {
      return `Workshop updated successfully and marked as ${quoteOrRepair === 'Quote' ? 'Quoted' : 'Repaired'}!`;
    } else {
      // This logic would need the order creation status
      return `Workshop updated successfully!`;
    }
  }

  // For new job creation
  return 'Workshop created successfully and ready to be quoted!';
}

/**
 * Determines which modal to show after successful submission
 */
export type SuccessModalType =
  | 'pickup_status_change'  // New pickup jobs
  | 'pickup_submission'     // Pickup job submissions
  | 'success'              // Regular updates
  | 'post_submission';     // New job creation

export function determineSuccessModal(
  existingWorkshopId: string | null,
  workshopStatus: JobStatus,
  locationOfRepair: 'Site' | 'Workshop',
  wasPickupJob: boolean
): SuccessModalType {
  // For new pickup submissions
  if ((workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site') {
    return 'pickup_status_change';
  }

  // For pickup job submissions
  if (wasPickupJob) {
    return 'pickup_submission';
  }

  // For regular updates
  if (existingWorkshopId) {
    return 'success';
  }

  // For new job creation
  return 'post_submission';
}

/**
 * Handles customer selection from dropdown
 */
export function handleCustomerSelect(
  customer: Customer
): {
  selectedCustomer: Customer;
  customerName: string;
  contactEmail: string;
  contactNumber: string;
} {
  return {
    selectedCustomer: customer,
    customerName: customer.BillingAddress.BillFirstName + ' ' + customer.BillingAddress.BillLastName,
    contactEmail: customer.EmailAddress,
    contactNumber: customer.BillingAddress.BillPhone || ''
  };
}

/**
 * Handles customer clearing
 */
export function handleCustomerClear(): {
  selectedCustomer: Customer | null;
  customerName: string;
  contactEmail: string;
  contactNumber: string;
} {
  return {
    selectedCustomer: null,
    customerName: '',
    contactEmail: '',
    contactNumber: ''
  };
}

/**
 * Checks if there are incomplete contacts that need to be completed before submission
 */
export function hasIncompleteContacts(contactsManager: any): boolean {
  return contactsManager && contactsManager.hasIncompleteContact();
}

/**
 * Validates form data and prepares for submission
 */
export interface SubmissionValidationResult {
  isValid: boolean;
  errors?: string[];
  shouldShowIncompleteContactModal?: boolean;
}

/**
 * Core submission logic that handles both update and create operations
 */
export interface SubmissionOptions {
  existingWorkshopId: string | null;
  workshopStatus: JobStatus;
  existingOrderId: string | null;
  locationOfMachine: 'Site' | 'Workshop';
  siteLocation: string;
  pickupSchedule: string;
  isPickupScheduleRequired: boolean;
  productName: string;
  customerName: string;
  schedules: any;
  photos: PhotoItem[];
  selectedCustomer: Customer | null;
  optionalContacts: Contact[];
  startedWith: 'form' | 'camera';
  quoteOrRepair: 'Quote' | 'Repaired';
  quoteDescription?: string;
  additionalInformation?: string;
  stockOnHand?: string;
  labour?: string;
  travelTime?: string;
  callOut?: string;
  parts?: Array<{ sku: string; quantity: string }>;
  customerApiData?: any;
  orderApiData?: any;
}

export interface SubmissionResult {
  success: boolean;
  error?: string;
  workshop?: any;
  generatedOrderId?: string | null;
}

/**
 * Validates and prepares form data for submission
 */
export function validateAndPrepareSubmission(
  options: SubmissionOptions,
  contactsManager: any
): SubmissionValidationResult {
  // Check for incomplete contacts
  if (hasIncompleteContacts(contactsManager)) {
    return {
      isValid: false,
      shouldShowIncompleteContactModal: true
    };
  }

  // Validate form
  const validation = validateForm({
    productName: options.productName,
    customerName: options.customerName,
    locationOfRepair: options.locationOfRepair,
    siteLocation: options.siteLocation,
    pickupSchedule: options.pickupSchedule,
    isNewPickupJob: options.isPickupScheduleRequired
  }, {
    existingWorkshopId: options.existingWorkshopId,
    workshopStatus: options.workshopStatus,
    existingOrderId: options.existingOrderId,
    locationOfRepair: options.locationOfRepair,
    siteLocation: options.siteLocation
  });

  if (!validation.isValid) {
    return {
      isValid: false,
      errors: validation.errors
    };
  }

  return { isValid: true };
}
