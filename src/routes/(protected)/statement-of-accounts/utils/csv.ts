import type { StatementAccount } from '../statementAccounts';

const CSV_HEADERS = [
	'customer_username',
	'total_invoices',
	'all_invoices_balance',
	'due_invoice_balance',
	'total_balance_customer',
	'aib_vs_tb'
] as const;

export function createStatementAccountsCsv(accounts: StatementAccount[]): string {
	return [
		CSV_HEADERS.join(','),
		...accounts.map((account) => {
			let aibVsTb = 'N/A';
			if (account.totalBalanceCustomer !== null) {
				const isMatch = Math.abs(account.allInvoicesBalance - account.totalBalanceCustomer) < 0.01;
				aibVsTb = isMatch ? 'Match' : 'Not Matched';
			}

			return [
				account.username,
				account.totalInvoices,
				account.allInvoicesBalance.toFixed(2),
				account.dueInvoiceBalance.toFixed(2),
				account.totalBalanceCustomer !== null ? account.totalBalanceCustomer.toFixed(2) : 'N/A',
				aibVsTb
			].join(',');
		})
	].join('\n');
}

export function downloadStatementAccountsCsv(accounts: StatementAccount[]): string {
	const csvContent = createStatementAccountsCsv(accounts);
	const fileName = `statement_accounts_${new Date().toISOString().split('T')[0]}.csv`;

	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);

	link.setAttribute('href', url);
	link.setAttribute('download', fileName);
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	setTimeout(() => URL.revokeObjectURL(url), 0);

	return fileName;
}
