import type { CustomerGroupInvoice } from '../types';

interface PrintData {
  customerGroupLabel: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export function handlePrint(invoices: CustomerGroupInvoice[], printData: PrintData) {
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
              <th>Due Date</th>
              <th class="right">Grand Total</th>
              <th class="right">Payments</th>
              <th class="right">Balance AUD</th>
            </tr>
          </thead>
          <tbody>
            ${allData.map(invoice => `
              <tr>
                <td>${new Date(invoice.dateIssued).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>${invoice.invoiceNumber}</td>
                <td>${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td class="right">${Number(invoice.totalAmount).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="right">${Number(invoice.amountPaid).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="right">${Number(invoice.balance).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="summary-row">
              <td colspan="5" class="summary-label">BALANCE DUE AUD</td>
              <td class="summary-value right">${allData.reduce((sum, inv) => sum + Number(inv.balance), 0).toLocaleString('en-AU', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
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