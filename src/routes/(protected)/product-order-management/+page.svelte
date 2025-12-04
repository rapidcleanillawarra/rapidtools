<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Modal from '$lib/components/Modal.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import { disableProduct, deleteOrder } from './services';
  import type { ProductDisableFormData, OrderDeleteFormData } from './types';
  import { emptyProductDisableForm, emptyOrderDeleteForm } from './types';

  // State
  let loading = false;
  let error = '';

  // Tab state
  let activeTab = 'disable-product';

  // Modal state
  let showDeleteOrderModal = false;
  let isSubmitting = false;

  // Form state
  let productFormData: ProductDisableFormData = { ...emptyProductDisableForm };
  let orderFormData: OrderDeleteFormData = { ...emptyOrderDeleteForm };

  // Load on mount
  onMount(() => {
    // Initialize any necessary data
  });

  async function handleDisableProduct() {
    if (!productFormData.sku.trim()) {
      toastError('SKU is required');
      return;
    }

    if (!productFormData.replacementProductSku.trim()) {
      toastError('Replacement product SKU is required');
      return;
    }

    isSubmitting = true;
    try {
      await disableProduct(productFormData.sku, productFormData.replacementProductSku);
      closeDisableProductModal();
      toastSuccess('Product disabled successfully');
    } catch (err) {
      toastError('Failed to disable product');
      console.error(err);
    } finally {
      isSubmitting = false;
    }
  }

  // Order Delete Modal
  function openDeleteOrderModal() {
    orderFormData = { ...emptyOrderDeleteForm };
    showDeleteOrderModal = true;
  }

  function closeDeleteOrderModal() {
    showDeleteOrderModal = false;
    orderFormData = { ...emptyOrderDeleteForm };
  }

  async function handleDeleteOrder() {
    if (!orderFormData.orderId.trim()) {
      toastError('Order ID is required');
      return;
    }

    if (!orderFormData.reason.trim()) {
      toastError('Reason for deletion is required');
      return;
    }

    isSubmitting = true;
    try {
      await deleteOrder(orderFormData.orderId, orderFormData.reason);
      closeDeleteOrderModal();
      toastSuccess('Order deleted successfully');
    } catch (err) {
      toastError('Failed to delete order');
      console.error(err);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<ToastContainer />

<div class="container mx-auto px-4 py-8">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
    <h1 class="text-2xl font-bold text-gray-900">Product & Order Management</h1>
  </div>

  <!-- Tabs -->
  <div class="mb-6">
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          on:click={() => activeTab = 'disable-product'}
          class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'disable-product'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        >
          Disable Product
        </button>
        <button
          on:click={() => activeTab = 'delete-order'}
          class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'delete-order'
            ? 'border-red-500 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        >
          Delete Order
        </button>
      </nav>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" transition:fade>
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-red-800">{error}</p>
      </div>
    </div>
  {/if}

  <!-- Tab Content -->
  {#if activeTab === 'disable-product'}
    <div class="bg-white rounded-lg shadow p-6">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Disable Product</h2>
        <p class="text-gray-600 mt-1">Disable a product by SKU to remove it from active listings</p>
      </div>

      <!-- Disable Product Form -->
      <form on:submit|preventDefault={handleDisableProduct} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="product-sku" class="block text-sm font-medium text-gray-700 mb-1">
              Product SKU <span class="text-red-500">*</span>
            </label>
            <input
              id="product-sku"
              type="text"
              bind:value={productFormData.sku}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter the product SKU to disable"
              required
            />
          </div>
          <div>
            <label for="replacement-product-sku" class="block text-sm font-medium text-gray-700 mb-1">
              Replacement Product SKU <span class="text-red-500">*</span>
            </label>
            <input
              id="replacement-product-sku"
              type="text"
              bind:value={productFormData.replacementProductSku}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter the replacement product SKU"
              required
            />
          </div>
        </div>
        <div class="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Disabling...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Disable Product
            {/if}
          </button>
        </div>
      </form>
    </div>
  {:else if activeTab === 'delete-order'}
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">Delete Order</h2>
          <p class="text-gray-600 mt-1">Permanently delete an order from the system</p>
        </div>
        <button
          on:click={openDeleteOrderModal}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Order
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Delete Order Modal -->
<Modal show={showDeleteOrderModal} on:close={closeDeleteOrderModal} size="lg">
  <span slot="header">Delete Order</span>
  <div slot="body">
    <form on:submit|preventDefault={handleDeleteOrder} class="space-y-4">
      <div>
        <label for="order-id" class="block text-sm font-medium text-gray-700 mb-1">
          Order ID <span class="text-red-500">*</span>
        </label>
        <input
          id="order-id"
          type="text"
          bind:value={orderFormData.orderId}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="Enter the order ID to delete"
          required
        />
      </div>
      <div>
        <label for="order-reason" class="block text-sm font-medium text-gray-700 mb-1">
          Reason for Deletion <span class="text-red-500">*</span>
        </label>
        <textarea
          id="order-reason"
          bind:value={orderFormData.reason}
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-vertical"
          placeholder="Provide a detailed reason for deleting this order..."
          required
        ></textarea>
      </div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-3">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div class="text-sm text-red-800">
            <p><strong>Warning: This action cannot be undone and will:</strong></p>
            <ul class="list-disc pl-5 mt-1">
              <li>Permanently remove the order from the system</li>
              <li>Delete all associated order data</li>
              <li>Potentially affect customer records and payment history</li>
              <li>Remove order from all reports and analytics</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  </div>
  <div slot="footer" class="flex justify-end gap-3">
    <button
      on:click={closeDeleteOrderModal}
      class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
    >
      Cancel
    </button>
    <button
      on:click={handleDeleteOrder}
      disabled={isSubmitting}
      class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {#if isSubmitting}
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Deleting...
      {:else}
        Delete Order
      {/if}
    </button>
  </div>
</Modal>
