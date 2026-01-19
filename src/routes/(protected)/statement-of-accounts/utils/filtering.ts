import type { ColumnKey, StatementAccount, NumericFilter } from '../statementAccounts';

const UNKNOWN_DATE_PLACEHOLDER = '—';

function formatAuDate(dateString: string | null): string {
	if (!dateString) return UNKNOWN_DATE_PLACEHOLDER;
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return UNKNOWN_DATE_PLACEHOLDER;
	return date.toLocaleDateString('en-AU');
}

function matchesFilter(
	account: StatementAccount,
	columnKey: ColumnKey,
	normalizedValue: string
): boolean {
	if (columnKey === 'companyName') {
		return account.companyName.toLowerCase().includes(normalizedValue);
	}

	if (columnKey === 'username') {
		return account.username.toLowerCase().includes(normalizedValue);
	}

	if (columnKey === 'totalInvoices') {
		return account.totalInvoices.toString().includes(normalizedValue);
	}

	if (columnKey === 'allInvoicesBalance') {
		return account.allInvoicesBalance.toString().includes(normalizedValue);
	}

	if (columnKey === 'dueInvoiceBalance') {
		return account.dueInvoiceBalance.toString().includes(normalizedValue);
	}

	if (columnKey === 'totalBalanceCustomer') {
		return account.totalBalanceCustomer?.toString().includes(normalizedValue) || false;
	}

	if (columnKey === 'aibVsTb') {
		if (account.totalBalanceCustomer === null) return false;
		const isMatch = Math.abs(account.allInvoicesBalance - account.totalBalanceCustomer) < 0.01;
		const displayText = isMatch ? 'match' : 'no match';
		return displayText.includes(normalizedValue);
	}

	if (columnKey === 'lastSent') {
		const dateValue = account.lastSent;
		if (!dateValue) return false;
		return formatAuDate(dateValue).toLowerCase().includes(normalizedValue);
	}

	return true;
}

function matchesNumericFilter(
	account: StatementAccount,
	columnKey: ColumnKey,
	filter: NumericFilter
): boolean {
	if (columnKey === 'allInvoicesBalance') {
		const value = account.allInvoicesBalance;
		switch (filter.operator) {
			case 'gt':
				return value > filter.value;
			case 'lt':
				return value < filter.value;
			case 'eq':
				return Math.abs(value - filter.value) < 0.01; // Handle floating point precision
			default:
				return true;
		}
	}

	if (columnKey === 'dueInvoiceBalance') {
		const value = account.dueInvoiceBalance;
		switch (filter.operator) {
			case 'gt':
				return value > filter.value;
			case 'lt':
				return value < filter.value;
			case 'eq':
				return Math.abs(value - filter.value) < 0.01; // Handle floating point precision
			default:
				return true;
		}
	}

	if (columnKey === 'totalBalanceCustomer') {
		const value = account.totalBalanceCustomer;
		if (value === null) return false;
		switch (filter.operator) {
			case 'gt':
				return value > filter.value;
			case 'lt':
				return value < filter.value;
			case 'eq':
				return Math.abs(value - filter.value) < 0.01; // Handle floating point precision
			default:
				return true;
		}
	}

	if (columnKey === 'totalInvoices') {
		const value = account.totalInvoices;
		switch (filter.operator) {
			case 'gt':
				return value > filter.value;
			case 'lt':
				return value < filter.value;
			case 'eq':
				return value === filter.value;
			default:
				return true;
		}
	}

	return true;
}

export function filterStatementAccounts(
	accounts: StatementAccount[],
	searchFilters: Partial<Record<ColumnKey, string>>,
	numericFilters: Partial<Record<ColumnKey, NumericFilter>>
): StatementAccount[] {
	const activeStringFilters = Object.entries(searchFilters)
		.filter(([, value]) => Boolean(value))
		.map(([key, value]) => ({ key: key as ColumnKey, normalizedValue: value!.toLowerCase() }));

	const activeNumericFilters = Object.entries(numericFilters)
		.filter(([, filter]) => filter !== undefined)
		.map(([key, filter]) => ({ key: key as ColumnKey, filter: filter! }));

	if (activeStringFilters.length === 0 && activeNumericFilters.length === 0) return accounts;

	return accounts.filter((account) => {
		const stringFilterMatch = activeStringFilters.every(({ key, normalizedValue }) =>
			matchesFilter(account, key, normalizedValue)
		);

		const numericFilterMatch = activeNumericFilters.every(({ key, filter }) =>
			matchesNumericFilter(account, key, filter)
		);

		return stringFilterMatch && numericFilterMatch;
	});
}
