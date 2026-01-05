export interface BillingAddress {
    BillFirstName: string;
    BillLastName: string;
    BillCompany: string;
    BillStreetLine1: string;
    BillStreetLine2: string;
    BillCity: string;
    BillState: string;
    BillPostCode: string;
    BillCountry: string;
    BillPhone: string;
    BillFax: string;
}

export interface AccountManager {
    FirstName: string;
    LastName: string;
    Username: string;
    Email: string;
}

export interface Customer {
    Username: string;
    EmailAddress: string;
    BillingAddress: BillingAddress;
    AccountManager: AccountManager | string;
    OnCreditHold: string;
    DefaultInvoiceTerms: string;
    // Computed fields for display
    company?: string;
    customerName?: string;
    displayName?: string;
    managerName?: string;
}

export interface ApiResponse {
    Customer: Customer[];
    CurrentTime: string;
    Ack: string;
}
