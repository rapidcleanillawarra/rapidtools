/**
 * Workshop Form Store
 *
 * Centralized state management for the workshop form.
 * Manages form data, UI state, and submission state.
 */

import { writable, derived } from 'svelte/store';
import type { PhotoItem, Contact } from '$lib/types/workshop';
import type { Customer } from '$lib/services/customers';
import type { JobStatus } from './workshop-status.service';

// Form data stores
export const locationOfMachine = writable<'Site' | 'Workshop'>('Site');
export const productName = writable('');
export const clientsWorkOrder = writable('');
export const makeModel = writable('');
export const serialNumber = writable('');
export const siteLocation = writable('');
export const schedules = writable<any>(null);
export const faultDescription = writable('');
export const customerName = writable('');
export const contactEmail = writable('');
export const contactNumber = writable('');
export const selectedCustomer = writable<Customer | null>(null);
export const optionalContacts = writable<Contact[]>([]);
export const photos = writable<PhotoItem[]>([]);
export const startedWith = writable<'form' | 'camera'>('form');
export const quoteOrRepair = writable<'Quote' | 'Repaired'>('Quote');

// Docket info stores
export const quoteDescription = writable('');
export const additionalInformation = writable('');
export const stockOnHand = writable('');
export const labour = writable('');
export const travelTime = writable('');
export const callOut = writable('');
export const parts = writable<Array<{ sku: string; quantity: string }>>([
  { sku: '', quantity: '' }
]);

// UI state stores
export const isMachineInfoExpanded = writable(true);
export const isUserInfoExpanded = writable(true);
export const isOptionalContactsExpanded = writable(false);

// Submission state stores
export const isSubmitting = writable(false);
export const showSuccessModal = writable(false);
export const showPostSubmissionModal = writable(false);
export const showIncompleteContactModal = writable(false);
export const showPickupSubmissionModal = writable(false);
export const showPickupStatusChangeModal = writable(false);
export const successMessage = writable('');
export const generatedOrderId = writable('');

// Photo viewer state
export const showPhotoViewer = writable(false);
export const currentPhotoIndex = writable(0);

// Error states
export const photoError = writable('');
export const contactError = writable('');

// Workshop context stores
export const existingWorkshopId = writable<string | null>(null);
export const workshopStatus = writable<JobStatus>(null);
export const existingOrderId = writable<string | null>(null);
export const wasPickupJob = writable(false);

// API data stores
export const customerApiData = writable<any>(null);
export const orderApiData = writable<any>(null);

// Derived stores
export const pickupSchedule = derived(schedules, $schedules => $schedules?.pickup_schedule || '');
export const photoUrls = derived(photos, $photos => $photos.map(p => p.url));

// Computed minimum date/time for pickup schedule
export const minDateTime = derived([], () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
});

// Summary items for collapsed sections
export const machineInfoSummaryItems = derived(
  [productName, locationOfMachine, makeModel, serialNumber, siteLocation, pickupSchedule, faultDescription],
  ([$productName, $locationOfMachine, $makeModel, $serialNumber, $siteLocation, $pickupSchedule, $faultDescription]) => {
    const items = [];
    if ($productName.trim()) items.push({ label: 'Product', value: $productName, priority: 1 });
    if ($locationOfMachine) items.push({ label: 'Location', value: $locationOfMachine, priority: 2 });
    if ($makeModel.trim()) items.push({ label: 'Make/Model', value: $makeModel, priority: 3 });
    if ($serialNumber.trim()) items.push({ label: 'Serial', value: $serialNumber, priority: 4 });
    if ($siteLocation.trim()) items.push({ label: 'Site', value: $siteLocation, priority: 5 });
    if ($pickupSchedule.trim()) items.push({ label: 'Pickup Schedule', value: formatPickupSchedule($pickupSchedule), priority: 6 });
    if ($faultDescription.trim()) items.push({ label: 'Fault Description', value: $faultDescription, priority: 7 });
    return items.sort((a, b) => a.priority - b.priority);
  }
);

export const userInfoSummaryItems = derived(
  [customerName, contactEmail, contactNumber, optionalContacts],
  ([$customerName, $contactEmail, $contactNumber, $optionalContacts]) => {
    const items = [];
    if ($customerName.trim()) items.push({ label: 'Customer', value: $customerName, priority: 1 });
    if ($contactEmail.trim()) items.push({ label: 'Email', value: $contactEmail, priority: 2 });
    if ($contactNumber.trim()) items.push({ label: 'Phone', value: $contactNumber, priority: 3 });
    if ($optionalContacts.length > 0) items.push({ label: 'Contacts', value: `${$optionalContacts.length} additional`, priority: 4 });
    return items.sort((a, b) => a.priority - b.priority);
  }
);

export const optionalContactsSummaryItems = derived(optionalContacts, $optionalContacts => {
  const items: Array<{
    label: string;
    value: string;
    phone: string;
    email: string;
    priority: number;
  }> = [];
  $optionalContacts.forEach((contact, index) => {
    if (contact.name.trim()) items.push({
      label: `Contact ${index + 1}`,
      value: contact.name,
      phone: contact.number,
      email: contact.email,
      priority: index + 1
    });
  });
  return items.sort((a, b) => a.priority - b.priority);
});

// Utility functions
function formatPickupSchedule(datetimeString: string): string {
  if (!datetimeString) return '';

  try {
    const date = new Date(datetimeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Error formatting pickup schedule:', error);
    return datetimeString;
  }
}

// Form reset function
export function resetForm() {
  // Reset all form fields
  locationOfMachine.set('Site');
  productName.set('');
  clientsWorkOrder.set('');
  makeModel.set('');
  serialNumber.set('');
  siteLocation.set('');
  schedules.set(null);
  faultDescription.set('');
  customerName.set('');
  contactEmail.set('');
  contactNumber.set('');
  selectedCustomer.set(null);
  optionalContacts.set([]);
  workshopStatus.set(null);
  existingOrderId.set(null);

  // Clear photos - only revoke URLs for new photos created with URL.createObjectURL
  photos.update($photos => {
    $photos.forEach(p => {
      if (!p.isExisting) {
        URL.revokeObjectURL(p.url);
      }
    });
    return [];
  });

  // Clear errors
  photoError.set('');
  contactError.set('');

  // Clear success modal state
  showSuccessModal.set(false);
  successMessage.set('');
  generatedOrderId.set('');
}

// Export all stores for easy access
export const formStores = {
  // Form data
  locationOfMachine,
  productName,
  clientsWorkOrder,
  makeModel,
  serialNumber,
  siteLocation,
  schedules,
  faultDescription,
  customerName,
  contactEmail,
  contactNumber,
  selectedCustomer,
  optionalContacts,
  photos,
  startedWith,
  quoteOrRepair,

  // Docket info
  quoteDescription,
  additionalInformation,
  stockOnHand,
  labour,
  travelTime,
  callOut,
  parts,

  // UI state
  isMachineInfoExpanded,
  isUserInfoExpanded,
  isOptionalContactsExpanded,

  // Submission state
  isSubmitting,
  showSuccessModal,
  showPostSubmissionModal,
  showIncompleteContactModal,
  showPickupSubmissionModal,
  showPickupStatusChangeModal,
  successMessage,
  generatedOrderId,

  // Photo viewer
  showPhotoViewer,
  currentPhotoIndex,

  // Errors
  photoError,
  contactError,

  // Workshop context
  existingWorkshopId,
  workshopStatus,
  existingOrderId,
  wasPickupJob,

  // API data
  customerApiData,
  orderApiData,

  // Derived
  pickupSchedule,
  photoUrls,
  minDateTime,
  machineInfoSummaryItems,
  userInfoSummaryItems,
  optionalContactsSummaryItems
};
