import type { Order } from '../statementAccounts';
import { calculateOutstandingAmount, getCustomerName } from '../statementAccounts';

interface CustomerInvoice {
	orderID: string;
	datePlaced: string;
	datePaymentDue: string;
	grandTotal: number;
	payments: number;
	balance: number;
}

/**
 * Get all outstanding invoices for a specific company and username from orders
 */
export function getCustomerInvoices(orders: Order[], companyName: string, username: string): CustomerInvoice[] {
	return orders
		.filter((order) => {
			const name = getCustomerName(order);
			return name === companyName;
		})
		.filter((order) => order.Username === username)
		.filter((order) => {
			const outstanding = calculateOutstandingAmount(order);
			return outstanding > 0.01;
		})
		.map((order) => {
			const grandTotal = parseFloat(order.GrandTotal);
			const payments = order.OrderPayment?.reduce(
				(sum, payment) => sum + parseFloat(payment.Amount),
				0
			) || 0;
			const balance = grandTotal - payments;

			return {
				orderID: order.OrderID,
				datePlaced: order.DatePlaced,
				datePaymentDue: order.DatePaymentDue,
				grandTotal,
				payments,
				balance
			};
		})
		.sort((a, b) => new Date(a.datePlaced).getTime() - new Date(b.datePlaced).getTime());
}

/**
 * Format currency in AUD
 */
function formatCurrency(amount: number): string {
	return amount.toLocaleString('en-AU', {
		style: 'decimal',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return '—';
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Check if an invoice is past due (due date is before today)
 */
function isPastDue(datePaymentDue: string): boolean {
	const dueDate = new Date(datePaymentDue);
	const today = new Date();
	today.setHours(0, 0, 0, 0); // Set to start of today
	dueDate.setHours(0, 0, 0, 0); // Set to start of due date
	return dueDate < today;
}

/**
 * Handle printing statement of account for a specific customer
 */
/**
 * Generate HTML content for the statement of account
 */
export function generateStatementHtml(
	companyName: string,
	invoices: CustomerInvoice[],
	usePlaceholders: boolean = false
): string {
	// Calculate totals
	const totalBalance = invoices.reduce((sum, inv) => sum + inv.balance, 0);

	// Calculate date range from invoices
	const dates = invoices.map((inv) => new Date(inv.datePlaced).getTime());
	const dateFrom = new Date(Math.min(...dates));
	const dateTo = new Date(Math.max(...dates));

	const formatDisplayDate = (date: Date): string => {
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const logoSrc = usePlaceholders
		? '{{COMPANY_LOGO}}'
		: 'https://www.rapidsupplies.com.au/assets/images/Company%20Logo%20New.png';

	const qrSrc = usePlaceholders
		? '{{STRIPE_QR}}'
		: 'https://www.rapidsupplies.com.au/assets/images/stripe_qr.png';

	return `
		<!DOCTYPE html>
		<html>
			<head>
				<title>Statement of Account - ${companyName}</title>
				<style>
					body {
						font-family: Arial, sans-serif;
						margin: 20px;
						background: #fafbfc;
					}
					.header {
						margin-bottom: 20px;
					}
					.header-row {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 15px;
					}
					.header-content {
						flex: 1;
					}
					.header-logo {
						width: 200px;
						height: auto;
					}
					.second-row {
						display: grid;
						grid-template-columns: 1fr 1fr 1fr;
						gap: 20px;
						margin-top: 15px;
					}
					.statement-title {
						font-size: 18px;
						font-weight: bold;
						color: #1a1a1a;
					}
					.address {
						text-align: right;
						font-size: 14px;
						color: #1a1a1a;
						line-height: 1.4;
					}
					.header h1 {
						margin: 0;
						color: #1a1a1a;
					}
					.header p {
						margin: 5px 0;
						color: #666;
					}
					.print-table-container {
						display: flex;
						justify-content: center;
						margin-top: 30px;
					}
					table {
						background: #fff;
						width: 100%;
						max-width: 100%;
						border-collapse: separate;
						border-spacing: 0;
						margin: 0 auto;
						box-shadow: 0 2px 8px rgba(0,0,0,0.03);
					}
					th, td {
						padding: 8px 8px;
					}
					th {
						border-bottom: 2px solid #222;
						font-weight: bold;
						background: #fff;
						text-align: left;
						font-size: 16px;
					}
					td {
						border-bottom: 1px solid #e0e0e0;
						font-size: 14px;
					}
					td.right, th.right {
						text-align: right;
					}
					tr:last-child td {
						border-bottom: 2px solid #222;
					}
					.summary-row td {
						border: none;
						font-size: 18px;
						font-weight: bold;
						background: #fff;
						padding-top: 18px;
						padding-bottom: 18px;
					}
					.summary-label {
						text-align: right;
						padding-right: 20px;
						font-size: 18px;
						font-weight: bold;
						letter-spacing: 1px;
					}
					.summary-value {
						font-size: 20px;
						font-weight: bold;
						color: #222;
						text-align: right;
						min-width: 120px;
					}
					@media print {
						body {
							margin: 0;
							padding: 5mm 5mm 5mm 5mm;
							background: #fff;
						}
						.print-table-container {
							margin-top: 0;
						}
						table {
							box-shadow: none;
							width: 100% !important;
							max-width: 100% !important;
						}
						th, td {
							padding: 4px 4px !important;
							font-size: 12px !important;
						}
					}
					.date-range {
						text-align: center;
						font-size: 14px;
						color: #1a1a1a;
						line-height: 1.4;
					}
					.date-range-label {
						font-weight: bold;
						margin-bottom: 5px;
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="header-row">
						<div class="header-content">
							<p>Printed on: ${new Date().toLocaleString()}</p>
							<p>Total Invoices: ${invoices.length}</p>
						</div>
						<img src="${logoSrc}" alt="Rapid Supplies Logo" class="header-logo">
					</div>
					<div class="second-row">
						<div class="statement-title">
							Statement of Account for ${companyName}
						</div>
						<div class="date-range">
							<div class="date-range-label">Date Range:</div>
							From: ${formatDisplayDate(dateFrom)}<br>
							To: ${formatDisplayDate(dateTo)}
						</div>
						<div class="address">
							Rapid Illawarra Pty Ltd<br>
							112a Industrial Road<br>
							OAK FLATS NSW 2529<br>
							AUSTRALIA
						</div>
					</div>
				</div>
				<div class="print-table-container">
				<table>
					<thead>
						<tr>
							<th>Order #</th>
							<th>Date Placed</th>
							<th>Due Date</th>
							<th class="right">Order Total</th>
							<th class="right">Payments</th>
							<th class="right">Balance AUD</th>
						</tr>
					</thead>
					<tbody>
						${invoices
			.map(
				(invoice) => {
					const pastDue = isPastDue(invoice.datePaymentDue);
					const rowClass = pastDue ? 'style="background-color: #fee2e2;"' : '';
					return `
							<tr ${rowClass}>
								<td>${invoice.orderID}</td>
								<td>${formatDate(invoice.datePlaced)}</td>
								<td>${formatDate(invoice.datePaymentDue)}</td>
								<td class="right">${formatCurrency(invoice.grandTotal)}</td>
								<td class="right">${formatCurrency(invoice.payments)}</td>
								<td class="right">${formatCurrency(invoice.balance)}</td>
							</tr>
						`;
				}
			)
			.join('')}
					</tbody>
					<tfoot>
						<tr class="summary-row">
							<td colspan="5" class="summary-label">BALANCE DUE AUD</td>
							<td class="summary-value right">${formatCurrency(totalBalance)}</td>
						</tr>
					</tfoot>
				</table>
				</div>
				<div style="margin-top: 30px; padding: 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: flex-start; gap: 40px;">
					<div style="flex: 1; min-width: 220px;">
						<h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1a1a1a;">Banking Details:</h3>
						<p style="margin: 5px 0; font-size: 14px; color: #1a1a1a;">IMB Shellharbour City</p>
						<p style="margin: 5px 0; font-size: 14px; color: #1a1a1a;">BSB: 641-800</p>
						<p style="margin: 5px 0; font-size: 14px; color: #1a1a1a;">A/C: 200839104</p>
						<p style="margin: 5px 0; font-size: 14px; color: #1a1a1a;">Name: Rapid Illawarra Pty Ltd</p>
						<p style="margin: 5px 0; font-size: 14px; color: #1a1a1a;">Swiftcode: ASLLAU2C</p>
					</div>
					<div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
						<img src='${qrSrc}' alt='Stripe Payment QR' style='width: 140px; height: 140px; margin-bottom: 10px; border: 1px solid #eee; padding: 4px; background: #fff;' />
						<a href='https://buy.stripe.com/dRm9AUexncD0fQacewaZi00' target='_blank' style='display: inline-block; margin-top: 8px; padding: 8px 18px; background: #635bff; color: #fff; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 500;'>Pay via Stripe</a>
						<div style='margin-top: 6px; font-size: 12px; color: #888; text-align: center;'>Scan to pay online</div>
					</div>
				</div>
				<div style="margin-top: 40px;">
					<div style="border-top: 3px dashed #000; position: relative; margin-bottom: 20px;">
						<span style="position: absolute; left: -18px; top: -16px; font-size: 22px; background: #fff;">✂️</span>
					</div>
					<div style="display: flex; align-items: flex-start; justify-content: space-between;">
						<div style="flex: 1; min-width: 220px;">
							<div style="font-size: 32px; font-weight: 500; letter-spacing: 2px; margin-bottom: 10px;">PAYMENT ADVICE</div>
							<div style="font-size: 12px; margin-bottom: 10px;">To: Rapid Illawarra Pty Ltd<br>112a Industrial Road<br>OAK FLATS NSW 2529<br>AUSTRALIA</div>
						</div>
						<div style="flex: 1.2; margin-left: 40px;">
							<table style="width: 100%; border-collapse: collapse; font-size: 18px;">
								<tr>
									<td style="font-weight: bold; border-bottom: 1px solid #aaa; padding-bottom: 4px;">Customer</td>
									<td style="border-bottom: 1px solid #aaa; padding-bottom: 4px;">${companyName}</td>
								</tr>
								<tr>
									<td style="font-weight: bold; padding-top: 10px;">Total Invoices</td>
									<td style="padding-top: 10px;">${invoices.length}</td>
								</tr>
								<tr>
									<td style="font-weight: bold;">Total AUD Due</td>
									<td>${formatCurrency(totalBalance)}</td>
								</tr>
								<tr>
									<td style="font-weight: bold; padding-top: 18px;">Amount Enclosed</td>
									<td style="padding-top: 18px; border-bottom: 2px solid #222;">
										<span style="display: block; height: 24px;"></span>
									</td>
								</tr>
								<tr>
									<td></td>
									<td style="color: #888; font-size: 14px;">Enter the amount you are paying above</td>
								</tr>
							</table>
						</div>
					</div>
				</div>
			</body>
		</html>
	`;
}

/**
 * Handle printing statement of account for a specific company and username
 */
export function handlePrintStatement(companyName: string, username: string, orders: Order[]): void {
	const invoices = getCustomerInvoices(orders, companyName, username);

	if (invoices.length === 0) {
		throw new Error(`No outstanding invoices found for ${companyName}`);
	}

	// Create a new window for printing
	const printWindow = window.open('', '_blank');
	if (!printWindow) {
		throw new Error('Please allow popups to print the statement');
	}

	// Generate the HTML content
	const printContent = generateStatementHtml(companyName, invoices);

	// Write the content to the new window
	printWindow.document.write(printContent);
	printWindow.document.close();

	// Wait for content to load then print
	printWindow.onload = function () {
		printWindow.print();
		// Close the window after printing
		printWindow.onafterprint = function () {
			printWindow.close();
		};
	};
}
