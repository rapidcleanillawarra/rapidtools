/**
 * Form validation utilities for workshop forms
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface WorkshopFormData {
  productName: string;
  customerName: string;
  locationOfMachine: string;
  siteLocation?: string;
  pickupSchedule?: string;
  isNewPickupJob?: boolean;
}

/**
 * Validates required fields for workshop creation/update
 */
export function validateRequiredFields(formData: WorkshopFormData): ValidationResult {
  const errors: string[] = [];

  if (!formData.productName.trim()) {
    errors.push('Product Name is required');
  }

  if (!formData.customerName.trim()) {
    errors.push('Customer Name is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates site location when repair location is 'Site'
 */
export function validateSiteLocation(locationOfRepair: string, siteLocation?: string): ValidationResult {
  const errors: string[] = [];

  if (locationOfRepair === 'Site' && (!siteLocation || !siteLocation.trim())) {
    errors.push('Site Location is required when Location of Repair is Site');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates pickup schedule when it's a new pickup job
 */
export function validatePickupSchedule(isNewPickupJob: boolean, pickupSchedule?: string): ValidationResult {
  const errors: string[] = [];

  if (isNewPickupJob && (!pickupSchedule || !pickupSchedule.trim())) {
    errors.push('Pickup Schedule is required for new pickup jobs');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Comprehensive form validation combining all validation rules
 */
export function validateWorkshopForm(formData: WorkshopFormData): ValidationResult {
  const requiredValidation = validateRequiredFields(formData);
  const siteLocationValidation = validateSiteLocation(formData.locationOfRepair, formData.siteLocation);
  const pickupScheduleValidation = validatePickupSchedule(
    formData.isNewPickupJob || false,
    formData.pickupSchedule
  );

  return {
    isValid: requiredValidation.isValid && siteLocationValidation.isValid && pickupScheduleValidation.isValid,
    errors: [...requiredValidation.errors, ...siteLocationValidation.errors, ...pickupScheduleValidation.errors]
  };
}
