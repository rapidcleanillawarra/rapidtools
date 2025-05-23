<script lang="ts">
  import { onMount } from 'svelte';
  import type { OrderLine, OrderInfo } from './types';
  import { GPPService } from './services/gpp.service';
  
  let orderId = '';
  let orderInfo: OrderInfo | null = null;
  let orderLines: OrderLine[] = [];
  let saveAllDiscounts = false;
  let loading = false;
  let error: string | null = null;
  let success: string | null = null;

  const gppService = GPPService.getInstance();

  async function handleSubmit() {
    if (!orderId.trim()) {
      alert('Please enter an Order ID.');
      return;
    }

    loading = true;
    error = null;
    success = null;

    try {
      const result = await gppService.fetchOrderDetails(orderId);
      orderInfo = result.orderInfo;
      orderLines = result.orderLines;
    } catch (e) {
      error = e instanceof Error ? e.message : 'An error occurred while fetching order details';
    } finally {
      loading = false;
    }
  }

  function handleSaveAllDiscountsChange(e: Event) {
    saveAllDiscounts = (e.target as HTMLInputElement).checked;
    // Update all checkboxes in the table
    if (orderLines) {
      orderLines = orderLines.map(line => ({
        ...line,
        saveDiscount: saveAllDiscounts
      }));
    }
  }

  async function handleApplyPricing() {
    if (!orderId || !orderLines.length) return;

    loading = true;
    error = null;
    success = null;

    try {
      await gppService.saveCustomerPricing(orderId, orderLines);
      success = 'Customer pricing applied successfully';
    } catch (e) {
      error = e instanceof Error ? e.message : 'An error occurred while applying customer pricing';
    } finally {
      loading = false;
    }
  }
</script>

<div class="global-container">
  <div class="order-container">
    <h1>Gross Profit Calculator</h1>
    
    <!-- Input and submit button -->
    <div class="input-area">
      <label for="orderIdInput">Order ID:</label>
      <input 
        type="text" 
        id="orderIdInput" 
        placeholder="Enter Order ID"
        bind:value={orderId}
        on:keypress={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={loading}
      >
      <button on:click={handleSubmit} disabled={loading}>
        {loading ? 'Loading...' : 'Submit'}
      </button>
    </div>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    {#if success}
      <div class="success-message">
        {success}
      </div>
    {/if}

    <!-- Container for customer information -->
    {#if orderInfo}
      <div id="orderInfo" class="order-info">
        <div class="info-block">
          <strong>Customer Name:</strong> {orderInfo.customerName}
        </div>
        <div class="info-block">
          <strong>Order User Group:</strong> 
          <span class={orderInfo.customerGroup === orderInfo.orderUserGroup ? 'group-match' : 'group-mismatch'}>
            {orderInfo.orderUserGroup}
          </span>
        </div>
        <div class="info-block">
          <strong>Current User Group:</strong> {orderInfo.customerGroup}
        </div>
        {#if orderInfo.customerGroup !== orderInfo.orderUserGroup}
          <div class="notification">
            The current user group does not match the order's user group.
          </div>
        {/if}
        <div class="info-block">
          <strong>Order Date:</strong> {orderInfo.orderDate}
        </div>
        <div class="info-block">
          <strong>Order Status:</strong> {orderInfo.orderStatus}
        </div>
      </div>
    {/if}

    <!-- Row for legends and table -->
    <div class="row">
      <div class="col-12">
        <!-- Static Legends -->
        <div class="table-legends">
          <span class="legend-item cost-price-legend">Cost Price has no stock history it's using Default Price</span>
          <span class="legend-item gp-legend">Gross Profit Percentage GPP should be above 20% threshold</span>
          <span class="legend-item green-legend">Unit Price is equal to the default price</span>
          <span class="legend-item blue-legend">Unit Price is lower than the default price indicating a Special Pricing for the customer</span>
        </div>

        <!-- Responsive Table -->
        {#if orderLines.length > 0}
          <div class="table-responsive">
            <table id="orderLineTable">
              <thead>
                <tr>
                  <th align="center" style="width: 3%;">
                    <input 
                      type="checkbox" 
                      bind:checked={saveAllDiscounts}
                      on:change={handleSaveAllDiscountsChange}
                      disabled={loading}
                    >
                  </th>
                  <th align="left" style="width: 10%;">Product Name</th>
                  <th align="left" style="width: 10%;">SKU</th>
                  <th align="left" style="width: 5%;">Qty</th>
                  <th align="left" style="width: 5%;">Cost Price</th>
                  <th align="left" style="width: 10%;">RRP</th>
                  <th align="left" style="width: 10%;">Unit Price</th>
                  <th align="left" style="width: 10%;">% Discount</th>
                  <th align="left" style="width: 10%;">Accum. Discount</th>
                  <th align="left" style="width: 10%;">Unit Price Disc.</th>
                  <th align="left" style="width: 10%;">GPP Ex GST</th>
                  <th align="left" style="width: 10%;">Total Ex GST</th>
                </tr>
              </thead>
              <tbody>
                {#each orderLines as line}
                  <tr class={line.highlight}>
                    <td style="text-align: center;">
                      <input 
                        type="checkbox" 
                        bind:checked={line.saveDiscount}
                        disabled={loading}
                      >
                    </td>
                    <td title={line.productName}>{line.productName}</td>
                    <td title={line.sku}>{line.sku}</td>
                    <td title={line.quantity.toString()} style="text-align: left;">{line.quantity}</td>
                    <td title={line.costPrice.toString()} style="text-align: left;">{line.costPrice}</td>
                    <td title={line.rrp.toString()} style="text-align: left;">{line.rrp}</td>
                    <td title={line.unitPrice.toString()} style="text-align: left;">{line.unitPrice}</td>
                    <td title={line.percentDiscount.toString() + '%'} style="text-align: left;">{line.percentDiscount}%</td>
                    <td title={line.accumulatedDiscount.toString()} style="text-align: left;">{line.accumulatedDiscount}</td>
                    <td title={line.unitPriceDiscounted.toString()} style="text-align: left;">{line.unitPriceDiscounted}</td>
                    <td title={line.gppExGst.toString() + '%'} style="text-align: left;">{line.gppExGst}%</td>
                    <td title={line.totalExGst.toString()} style="text-align: left;">{line.totalExGst}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Submit Button -->
          <div class="submit-area">
            <button 
              id="applyPricingBtn" 
              on:click={handleApplyPricing}
              disabled={loading || !orderLines.length}
            >
              {loading ? 'Applying...' : 'Apply Customer Pricing to Maropost'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .global-container {
    padding: 20px;
    width: 100%;
  }

  .order-container {
    width: 100%;
    margin: 0 auto;
  }

  .input-area {
    margin: 20px 0;
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .table-legends {
    margin: 20px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    width: 100%;
  }

  .legend-item {
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 14px;
  }

  .cost-price-legend {
    background-color: #ffecb3;
  }

  .gp-legend {
    background-color: #ffcdd2;
  }

  .green-legend {
    background-color: #c8e6c9;
  }

  .blue-legend {
    background-color: #bbdefb;
  }

  .low-gpp {
    background-color: #ffcdd2;
  }

  .equal-price td {
    background-color: #c8e6c9;
  }

  .lower-price td {
    background-color: #bbdefb;
  }

  td {
    padding: 10px;
    border: 1px solid #ddd;
    white-space: normal;
    word-wrap: break-word;
    overflow: visible;
  }

  td:first-child,
  td:nth-child(2) {
    text-align: left;
  }

  td:nth-child(3),
  td:nth-child(4),
  td:nth-child(5),
  td:nth-child(6),
  td:nth-child(7),
  td:nth-child(8),
  td:nth-child(9),
  td:nth-child(10),
  td:nth-child(11) {
    text-align: left;
  }

  td:nth-child(12) {
    text-align: center;
  }

  input[type="number"] {
    width: 80px;
    padding: 4px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  input[type="number"]:focus {
    outline: none;
    border-color: rgb(0, 120, 215);
    box-shadow: 0 0 0 2px rgba(0, 120, 215, 0.2);
  }

  .table-responsive {
    width: 100%;
    margin: 20px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: white;
    table-layout: fixed;
  }

  th {
    position: sticky;
    top: 0;
    background-color: rgb(0, 120, 215);
    color: white;
    padding: 12px 10px;
    font-weight: 500;
    white-space: normal;
    word-wrap: break-word;
    overflow: visible;
  }

  tr:nth-child(even) {
    background-color: #f8f9fa;
  }

  tr:hover {
    background-color: #f5f5f5;
  }

  .submit-area {
    margin: 20px 0;
    text-align: left;
  }

  button {
    padding: 8px 16px;
    background-color: rgb(0, 120, 215);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  input[type="text"] {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .error-message {
    background-color: #ffebee;
    color: #c62828;
    padding: 10px;
    border-radius: 4px;
    margin: 10px 0;
  }

  .success-message {
    background-color: #e8f5e9;
    color: #2e7d32;
    padding: 10px;
    border-radius: 4px;
    margin: 10px 0;
  }

  .order-info {
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 4px;
    margin: 20px 0;
  }

  .order-info p {
    margin: 5px 0;
  }

  /* Checkbox styling */
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  input[type="checkbox"]:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Ensure the table container takes full width */
  .row, .col-12 {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  /* Remove hover tooltip styles */
  td:hover::after, th:hover::after {
    display: none;
  }

  .info-block {
    margin: 5px 0;
  }

  .group-match {
    color: #2e7d32;
    background-color: #e8f5e9;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .group-mismatch {
    color: #c62828;
    background-color: #ffebee;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .notification {
    margin-top: 10px;
    padding: 8px;
    background-color: #fff3e0;
    color: #e65100;
    border-radius: 4px;
    font-size: 14px;
  }
</style> 