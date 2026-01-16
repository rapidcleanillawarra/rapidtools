import type { ColumnKey, StatementAccount } from '../statementAccounts';

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

export function filterStatementAccounts(
	accounts: StatementAccount[],
	searchFilters: Partial<Record<ColumnKey, string>>
): StatementAccount[] {
	const activeFilters = Object.entries(searchFilters)
		.filter(([, value]) => Boolean(value))
		.map(([key, value]) => ({ key: key as ColumnKey, normalizedValue: value!.toLowerCase() }));

	if (activeFilters.length === 0) return accounts;

	return accounts.filter((account) => {
		return activeFilters.every(({ key, normalizedValue }) =>
			matchesFilter(account, key, normalizedValue)
		);
	});
}
