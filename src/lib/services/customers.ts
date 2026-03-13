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
}

export interface CustomerResponse {
  Customer: Customer[];
  CurrentTime: string;
  Ack: string;
}

export interface CustomerFilter {
  Active: boolean;
  OutputSelector: string[];
}

export interface CustomerRequest {
  Filter: CustomerFilter;
  action: string;
}

const CUSTOMER_API_URL = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

/**
 * Fetch customers from the API
 */
export async function fetchCustomers(): Promise<Customer[]> {
  const requestBody: CustomerRequest = {
    Filter: {
      Active: true,
      OutputSelector: ['EmailAddress', 'BillingAddress']
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
  const firstName = BillingAddress.BillFirstName || '';
  const lastName = BillingAddress.BillLastName || '';
  const company = BillingAddress.BillCompany || '';

  // Prefer company name if available, otherwise use first/last name
  if (company.trim()) {
    return company.trim();
  }

  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || customer.EmailAddress;
}

/**
 * Get customer details for display
 */
export function getCustomerDetails(customer: Customer): string {
  const { BillingAddress } = customer;
  const parts = [];

  if (BillingAddress.BillPhone) {
    parts.push(BillingAddress.BillPhone);
  }

  if (BillingAddress.BillCity) {
    parts.push(BillingAddress.BillCity);
  }

  return parts.join(' • ');
}
