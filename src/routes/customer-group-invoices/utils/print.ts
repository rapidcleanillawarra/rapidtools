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
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f8f9fa;
            font-weight: bold;
          }
          .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
          }
          .footer {
            margin-top: 20px;
            text-align: right;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body {
              margin: 0;
              padding: 15px;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
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
              <h1>Customer Group Invoices</h1>
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
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date Issued</th>
              <th>Due Date</th>
              <th>Total Invoice</th>
              <th>Payments</th>
              <th>Balance AUD</th>
              <th>Username</th>
              <th>Company</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${allData.map(invoice => `
              <tr>
                <td>${invoice.invoiceNumber}</td>
                <td>${new Date(invoice.dateIssued).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                <td>${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                <td>${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.totalAmount)}</td>
                <td>${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.amountPaid)}</td>
                <td>${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.balance)}</td>
                <td>${invoice.username}</td>
                <td>${invoice.company}</td>
                <td>
                  <span class="status-badge" style="background-color: ${invoice.statusColor.split(' ')[0].replace('bg-', '#')}; color: ${invoice.statusColor.split(' ')[1].replace('text-', '#')}">
                    ${invoice.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="9" class="footer">
                Page 1 of 1 - Total Records: ${allData.length}
              </td>
            </tr>
          </tfoot>
        </table>
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