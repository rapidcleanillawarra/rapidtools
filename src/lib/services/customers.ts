// Customer API service
export interface CustomerBillingAddress {
  BillLastName: string;
  BillStreetLine1: string;
  BillCountry: string;
  BillState: string;
  BillPhone: string;
  BillPostCode: string;
  BillStreetLine2: string;
  BillFax: string;
  BillFirstName: string;
  BillCompany: string;
  BillCity: string;
}

export interface Customer {
  BillingAddress: CustomerBillingAddress;
  Username: string;
  EmailAddress: string;
  SecondaryEmailAddress: string;
  AccountBalance?: number;
}

export interface CustomerResponse {
  Customer: Customer[];
  CurrentTime: string;
  Ack: string;
}

export interface CustomerFilter {
  Active: boolean;
  Page: number;
  Limit: number;
  OutputSelector: string[];
}

export interface CustomerRequest {
  Filter: CustomerFilter;
  action: string;
}

const CUSTOMER_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

/**
 * Fetch customers from the API
 */
export async function fetchCustomers(page: number = 0, limit: number = 50): Promise<Customer[]> {
  const requestBody: CustomerRequest = {
    Filter: {
      Active: true,
      Page: page,
      Limit: limit,
      OutputSelector: [
        "EmailAddress",
        "SecondaryEmailAddress",
        "BillingAddress",
        "AccountBalance"
      ]
    },
    action: 'GetCustomer'
  };

  try {
    const response = await fetch(CUSTOMER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: CustomerResponse = await response.json();

    if (data.Ack !== 'Success') {
      throw new Error('API response not successful');
    }

    return data.Customer || [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}

/**
 * Get display name for a customer
 */
export function getCustomerDisplayName(customer: Customer): string {
  const { BillingAddress } = customer;
  if (!BillingAddress) return customer.EmailAddress || customer.Username;
  
  const firstName = BillingAddress.BillFirstName || '';
  const lastName = BillingAddress.BillLastName || '';
  const company = BillingAddress.BillCompany || '';

  // Prefer company name if available, otherwise use first/last name
  if (company.trim()) {
    return company.trim();
  }

  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || customer.EmailAddress || customer.Username;
}

/**
 * Get customer details for display
 */
export function getCustomerDetails(customer: Customer): string {
  const { BillingAddress } = customer;
  if (!BillingAddress) return '';
  
  const parts = [];

  if (BillingAddress.BillPhone) {
    parts.push(BillingAddress.BillPhone);
  }

  if (BillingAddress.BillCity) {
    parts.push(BillingAddress.BillCity);
  }

  return parts.join(' • ');
}
