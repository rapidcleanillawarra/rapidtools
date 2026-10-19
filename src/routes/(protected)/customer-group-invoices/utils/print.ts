import type { CustomerGroupInvoice } from '../types';

interface PrintData {
  customerGroupLabel: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface CalculatedAmounts {
  overdueAmount: number;
  currentAmount: number;
  totalAmount: number;
  invoiceDetails: Array<{
    invoiceNumber: string;
    dueDate: Date;
    gracePeriodEnd: Date;
    balance: number;
    isOverdue: boolean;
    isWithinCurrentMonth: boolean;
    category: 'overdue' | 'current' | 'excluded';
  }>;
}

export function calculateInvoiceAmounts(invoices: CustomerGroupInvoice[]): CalculatedAmounts {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

  let overdueAmount = 0;
  let currentAmount = 0;
  const invoiceDetails: CalculatedAmounts['invoiceDetails'] = [];

  invoices.forEach(invoice => {
    const dueDate = new Date(invoice.dueDate);
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(dueDate.getDate() + 10); // Add 10 days for grace period

    // Check if invoice is from current month or earlier
    const isFromCurrentMonthOrEarlier = 
      (dueDate.getFullYear() < currentYear) || 
      (dueDate.getFullYear() === currentYear && dueDate.getMonth() <= currentMonth);

    let category: 'overdue' | 'current' | 'excluded' = 'excluded';
    let amount = 0;

    if (!isFromCurrentMonthOrEarlier) {
      // Skip invoices from future months
      category = 'excluded';
    } else if (now > gracePeriodEnd) {
      // Overdue: Past grace period
      category = 'overdue';
      amount = Number(invoice.balance);
      overdueAmount += amount;
    } else {
      // Current: Within grace period
      category = 'current';
      amount = Number(invoice.balance);
      currentAmount += amount;
    }

    invoiceDetails.push({
      invoiceNumber: invoice.invoiceNumber,
      dueDate,
      gracePeriodEnd,
      balance: Number(invoice.balance),
      isOverdue: now > gracePeriodEnd,
      isWithinCurrentMonth: isFromCurrentMonthOrEarlier,
      category
    });
  });

  return {
    overdueAmount,
    currentAmount,
    totalAmount: overdueAmount + currentAmount,
    invoiceDetails
  };
}

export function handlePrint(invoices: CustomerGroupInvoice[], printData: PrintData) {
  // Calculate amounts first
  const calculatedAmounts = calculateInvoiceAmounts(invoices);
  
  // Log the calculated amounts for debugging
  console.log('Calculated Amounts:', {
    overdue: calculatedAmounts.overdueAmount,
    current: calculatedAmounts.currentAmount,
    total: calculatedAmounts.totalAmount
  });
  console.log('Invoice Details:', calculatedAmounts.invoiceDetails);

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Please allow popups to print the table');
  }

  // Get all data while maintaining current sort order
  const allData = [...invoices];

  // Calculate date range if not set by filters
  let dateFrom: Date, dateTo: Date;
  if (printData.dateFrom && printData.dateTo) {
    dateFrom = printData.dateFrom;
    dateTo = printData.dateTo;
  } else {
    // Find earliest and latest due dates from the data
    const dates = allData.map(invoice => new Date(invoice.dueDate).getTime());
    dateFrom = new Date(Math.min(...dates));
    dateTo = new Date(Math.max(...dates));
  }

  // Format currency values
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-AU', { 
      style: 'decimal', 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Format dates for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Create the print content
  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Customer Group Invoices</title>
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
            width: 100%;
            margin-top: 20px;
          }
          table {
            background: #fff;
            width: 100%;
            max-width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            margin: 0 auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          }
          th, td {
            padding: 6px 4px;
            vertical-align: top;
            overflow-wrap: break-word;
            word-wrap: break-word;
            word-break: break-word;
          }
          th {
            border-bottom: 2px solid #222;
            font-weight: bold;
            background: #fff;
            text-align: left;
            font-size: 11px;
            line-height: 1.25;
          }
          td {
            border-bottom: 1px solid #e0e0e0;
            font-size: 11px;
            line-height: 1.3;
          }
          td.right, th.right {
            text-align: right;
          }
          /* Explicit column widths so all 9 columns fit cleanly on the page */
          th:nth-child(1), td:nth-child(1) { width: 9%; }   /* Date Issued */
          th:nth-child(2), td:nth-child(2) { width: 13%; }  /* Invoice # */
          th:nth-child(3), td:nth-child(3) { width: 9%; }   /* PO # */
          th:nth-child(4), td:nth-child(4) { width: 9%; }   /* Due Date */
          th:nth-child(5), td:nth-child(5) { width: 15%; }  /* Company */
          th:nth-child(6), td:nth-child(6) { width: 18%; }  /* Ship Address */
          th:nth-child(7), td:nth-child(7) { width: 9%; }   /* Invoice Total */
          th:nth-child(8), td:nth-child(8) { width: 9%; }   /* Payments */
          th:nth-child(9), td:nth-child(9) { width: 9%; }   /* Balance AUD */
          tbody tr:last-child td {
            border-bottom: 2px solid #222;
          }
          .summary-row td {
            border: none;
            border-bottom: 2px solid #222;
            font-size: 12px;
            font-weight: bold;
            background: #fff;
            padding-top: 10px;
            padding-bottom: 10px;
            vertical-align: middle;
          }
          .summary-label {
            text-align: right;
            padding-right: 12px;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .summary-value {
            font-size: 12px;
            font-weight: bold;
            color: #222;
            text-align: right;
            white-space: nowrap;
          }
          @page {
            margin: 8mm;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              box-sizing: border-box;
            }
            .print-table-container {
              margin-top: 10px;
            }
            table {
              box-shadow: none;
              width: 100% !important;
              max-width: 100% !important;
            }
            th, td {
              padding: 4px 3px !important;
              font-size: 10px !important;
            }
            .summary-row td, .summary-label, .summary-value {
              font-size: 11px !important;
              padding-top: 8px !important;
              padding-bottom: 8px !important;
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
              <p>Total Records: ${allData.length}</p>
            </div>
            <img src="https://www.rapidsupplies.com.au/assets/images/Company%20Logo%20New.png" alt="Rapid Supplies Logo" class="header-logo">
          </div>
          <div class="second-row">
            <div class="statement-title">
              Statement of Account for ${printData.customerGroupLabel}
            </div>
            <div class="date-range">
              <div class="date-range-label">Date Range:</div>
              From: ${formatDate(dateFrom)}<br>
              To: ${formatDate(dateTo)}
            </div>
            <div class="address">
              RapidIllawarraPtyLtd<br>
              112a Industrial Road<br>
              OAKFLATS NSW 2529<br>
              AUSTRALIA
            </div>
          </div>
        </div>
        <div class="print-table-container">
        <table>
          <thead>
            <tr>
              <th>Date Issued</th>
              <th>Invoice #</th>
              <th>PO #</th>
              <th>Due Date</th>
              <th>Company</th>
              <th>Ship Address</th>
              <th class="right">Invoice Total</th>
              <th class="right">Payments</th>
              <th class="right">Balance AUD</th>
            </tr>
          </thead>
          <tbody>
            ${allData.map(invoice => `
              <tr>
                <td>${new Date(invoice.dateIssued).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${invoice.invoiceNumber}</td>
                <td>${invoice.purchaseOrderNumber || '—'}</td>
                <td>${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${invoice.company}</td>
                <td>${invoice.shipAddress || '—'}</td>
                <td class="right">${Number(invoice.totalAmount).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="right">${Number(invoice.amountPaid).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="right">${Number(invoice.balance).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="summary-row">
              <td colspan="6" class="summary-label">TOTAL AUD</td>
              <td class="summary-value right">${allData.reduce((sum, inv) => sum + Number(inv.totalAmount), 0).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="summary-value right">${allData.reduce((sum, inv) => sum + Number(inv.amountPaid), 0).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="summary-value right">${allData.reduce((sum, inv) => sum + Number(inv.balance), 0).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
            <img src='https://www.rapidsupplies.com.au/assets/images/stripe_qr.png' alt='Stripe Payment QR' style='width: 140px; height: 140px; margin-bottom: 10px; border: 1px solid #eee; padding: 4px; background: #fff;' />
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
                  <td style="border-bottom: 1px solid #aaa; padding-bottom: 4px;">${printData.customerGroupLabel}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; padding-top: 10px;">Overdue</td>
                  <td style="padding-top: 10px;">${formatCurrency(calculatedAmounts.overdueAmount)}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Current</td>
                  <td>${formatCurrency(calculatedAmounts.currentAmount)}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Total AUD Due</td>
                  <td>${formatCurrency(calculatedAmounts.totalAmount)}</td>
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

  // Write the content to the new window
  printWindow.document.write(printContent);
  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = function() {
    printWindow.print();
    // Close the window after printing
    printWindow.onafterprint = function() {
      printWindow.close();
    };
  };
} 