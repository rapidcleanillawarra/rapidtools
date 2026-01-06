import type { Customer } from './types';

export function getSortIcon(field: string, currentField: string, direction: 'asc' | 'desc'): string {
    if (field !== currentField) {
        return '↕️';
    }
    return direction === 'asc' ? '↑' : '↓';
}

function parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove currency symbols and commas if present
        const cleaned = value.replace(/[$,]/g, '');
        return parseFloat(cleaned) || 0;
    }
    return 0;
}

export function sortData(
    data: Customer[],
    field: string,
    direction: 'asc' | 'desc'
): Customer[] {
    return [...data].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        // Get values based on field
        switch (field) {
            case 'company':
                aValue = a.company || '';
                bValue = b.company || '';
                break;
            case 'customerName':
                aValue = a.customerName || '';
                bValue = b.customerName || '';
                break;
            case 'displayName':
                aValue = a.displayName || '';
                bValue = b.displayName || '';
                break;
            case 'EmailAddress':
                aValue = a.EmailAddress || '';
                bValue = b.EmailAddress || '';
                break;
            case 'phone':
                aValue = a.BillingAddress.BillPhone || '';
                bValue = b.BillingAddress.BillPhone || '';
                break;
            case 'managerName':
                aValue = a.managerName || '';
                bValue = b.managerName || '';
                break;
            case 'Username':
                aValue = a.Username || '';
                bValue = b.Username || '';
                break;
            case 'OnCreditHold':
                aValue = a.OnCreditHold || '';
                bValue = b.OnCreditHold || '';
                break;
            case 'DefaultInvoiceTerms':
                aValue = a.DefaultInvoiceTerms || '';
                bValue = b.DefaultInvoiceTerms || '';
                break;
            case 'AccountBalance':
                aValue = parseNumber(a.AccountBalance);
                bValue = parseNumber(b.AccountBalance);
                break;
            default:
                aValue = '';
                bValue = '';
        }

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === 'asc' ? 1 : -1;
        if (bValue == null) return direction === 'asc' ? -1 : 1;

        // Handle number comparison
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
            return direction === 'asc' ? comparison : -comparison;
        }

        // Default string comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        const comparison = aStr.localeCompare(bStr);
        return direction === 'asc' ? comparison : -comparison;
    });
}

export function filterCustomers(
    customers: Customer[],
    searchFilters: Record<string, string>
): Customer[] {
    let filtered = customers;

    for (const [key, value] of Object.entries(searchFilters)) {
        if (value) {
            filtered = filtered.filter((customer) => {
                let fieldValue: string;

                switch (key) {
                    case 'company':
                        fieldValue = customer.company || '';
                        break;
                    case 'customerName':
                        fieldValue = customer.customerName || '';
                        break;
                    case 'displayName':
                        fieldValue = customer.displayName || '';
                        break;
                    case 'EmailAddress':
                        fieldValue = customer.EmailAddress || '';
                        break;
                    case 'phone':
                        fieldValue = customer.BillingAddress.BillPhone || '';
                        break;
                    case 'managerName':
                        fieldValue = customer.managerName || '';
                        break;
                    case 'Username':
                        fieldValue = customer.Username || '';
                        break;
                    case 'OnCreditHold':
                        fieldValue = customer.OnCreditHold || '';
                        break;
                    case 'DefaultInvoiceTerms':
                        fieldValue = customer.DefaultInvoiceTerms || '';
                        break;
                    case 'AccountBalance':
                        fieldValue = (customer.AccountBalance || 0).toString();
                        break;
                    default:
                        fieldValue = '';
                }

                return fieldValue.toLowerCase().includes(value.toLowerCase());
            });
        }
    }

    return filtered;
}

export function getCustomerName(customer: Customer): string {
    const { BillFirstName, BillLastName, BillCompany } = customer.BillingAddress;
    if (BillCompany) return BillCompany;
    if (BillFirstName && BillLastName) return `${BillFirstName} ${BillLastName}`;
    if (BillFirstName) return BillFirstName;
    if (BillLastName) return BillLastName;
    return 'N/A';
}

export function getCompanyName(customer: Customer): string {
    return customer.BillingAddress.BillCompany || 'N/A';
}

export function getPersonName(customer: Customer): string {
    const { BillFirstName, BillLastName } = customer.BillingAddress;
    if (BillFirstName && BillLastName) return `${BillFirstName} ${BillLastName}`;
    if (BillFirstName) return BillFirstName;
    if (BillLastName) return BillLastName;
    return 'N/A';
}

export function getAccountManagerName(accountManager: any): string {
    if (typeof accountManager === 'string') return accountManager || 'N/A';
    if (!accountManager) return 'N/A';
    return `${accountManager.FirstName} ${accountManager.LastName}`;
}
