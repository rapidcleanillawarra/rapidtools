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
  locationOfRepair: string;
  siteLocation?: string;
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

  if (locationOfRepair === 'Site' && siteLocation && !siteLocation.trim()) {
    errors.push('Please enter a valid site location or leave empty');
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

  return {
    isValid: requiredValidation.isValid && siteLocationValidation.isValid,
    errors: [...requiredValidation.errors, ...siteLocationValidation.errors]
  };
}
