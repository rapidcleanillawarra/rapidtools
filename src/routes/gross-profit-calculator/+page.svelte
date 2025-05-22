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
        <p>Customer: {orderInfo.customerName}</p>
        <p>Order Date: {orderInfo.orderDate}</p>
        <p>Order Status: {orderInfo.orderStatus}</p>
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
                  <th align="left">Product Name</th>
                  <th align="left">SKU</th>
                  <th align="left">Quantity</th>
                  <th align="left">Cost Price</th>
                  <th align="left">RRP</th>
                  <th align="left">Unit Price</th>
                  <th align="left">Percent Discount</th>
                  <th align="left">Accumulated Discount</th>
                  <th align="left">Unit Price Discounted</th>
                  <th align="left">GPP Ex GST</th>
                  <th align="left">Total Ex GST</th>
                  <th align="left">
                    Save Discount Price
                    <input 
                      type="checkbox" 
                      bind:checked={saveAllDiscounts}
                      on:change={handleSaveAllDiscountsChange}
                      style="margin-left: 10px;"
                      disabled={loading}
                    >
                  </th>
                </tr>
              </thead>
              <tbody>
                {#each orderLines as line}
                  <tr class={line.highlight}>
                    <td>{line.productName}</td>
                    <td>{line.sku}</td>
                    <td>{line.quantity}</td>
                    <td>{line.costPrice}</td>
                    <td>{line.rrp}</td>
                    <td>{line.unitPrice}</td>
                    <td>{line.percentDiscount}%</td>
                    <td>{line.accumulatedDiscount}</td>
                    <td>{line.unitPriceDiscounted}</td>
                    <td>{line.gppExGst}%</td>
                    <td>{line.totalExGst}</td>
                    <td>
                      <input 
                        type="checkbox" 
                        bind:checked={line.saveDiscount}
                        disabled={loading}
                      >
                    </td>
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
  }

  .order-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .input-area {
    margin: 20px 0;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .table-legends {
    margin: 20px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
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
    text-align: right;
  }

  td:first-child,
  td:nth-child(2) {
    text-align: left;
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
    overflow-x: auto;
    margin: 20px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: white;
  }

  th {
    position: sticky;
    top: 0;
    background-color: rgb(0, 120, 215);
    color: white;
    padding: 12px 10px;
    text-align: left;
    border: none;
    font-weight: 500;
    white-space: nowrap;
  }

  tr:nth-child(even) {
    background-color: #f8f9fa;
  }

  tr:hover {
    background-color: #f5f5f5;
  }

  .submit-area {
    margin: 20px 0;
    text-align: right;
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
</style> 