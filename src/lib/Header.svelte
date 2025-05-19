<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';
  let mobileMenuOpen = false;
  let productsOpen = false;
  let ordersOpen = false;

  // For mobile dropdowns
  let mobileProductsOpen = false;
  let mobileOrdersOpen = false;

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.products-dropdown') && productsOpen) {
      productsOpen = false;
    }
    if (!target.closest('.orders-dropdown') && ordersOpen) {
      ordersOpen = false;
    }
  }

  onMount(() => {
    const close = () => {
      mobileMenuOpen = false;
      productsOpen = false;
      ordersOpen = false;
      mobileProductsOpen = false;
      mobileOrdersOpen = false;
    };
    window.addEventListener('hashchange', close);
    window.addEventListener('popstate', close);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('popstate', close);
      window.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<nav class="bg-gray-900 border-b border-gray-800 w-full sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <!-- Logo / App Name -->
      <div class="flex-shrink-0 flex items-center">
        <span class="text-2xl font-bold text-yellow-400 tracking-tight">RapidTools</span>
      </div>
      <!-- Desktop Nav -->
      <div class="hidden md:flex space-x-6 items-center">
        <a href="/" class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1">Home</a>
        <!-- Products Dropdown -->
        <div class="relative products-dropdown">
          <button 
            type="button" 
            class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none" 
            on:click|stopPropagation={() => {
              productsOpen = !productsOpen;
              if (productsOpen) ordersOpen = false;
            }}
          >
            Products
            <svg 
              class="w-4 h-4 ml-1 transform transition-transform duration-200" 
              class:rotate-180={productsOpen}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if productsOpen}
            <div 
              class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out"
              transition:fade
            >
              <div class="py-1.5">
                <a 
                  href="/product-request" 
                  class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                  on:click={() => productsOpen = false}
                >Product Request</a>
                <a 
                  href="/product-request-approval" 
                  class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                  on:click={() => productsOpen = false}
                >Product Request Approval</a>
                <a 
                  href="/update-product-price" 
                  class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                  on:click={() => productsOpen = false}
                >Update Product Price</a>
                <a 
                  href="/compare-sku" 
                  class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                  on:click={() => productsOpen = false}
                >Compare SKU</a>
              </div>
            </div>
          {/if}
        </div>
        <!-- Orders Dropdown -->
        <div class="relative orders-dropdown">
          <button 
            type="button" 
            class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none" 
            on:click|stopPropagation={() => {
              ordersOpen = !ordersOpen;
              if (ordersOpen) productsOpen = false;
            }}
          >
            Orders
            <svg 
              class="w-4 h-4 ml-1 transform transition-transform duration-200" 
              class:rotate-180={ordersOpen}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if ordersOpen}
            <div 
              class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out"
              transition:fade
            >
              <div class="py-1.5">
                <a 
                  href="/gross-profit-calculator" 
                  class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                  on:click={() => ordersOpen = false}
                >Gross Profit Calculator</a>
              </div>
            </div>
          {/if}
        </div>
      </div>
      <!-- Mobile Hamburger -->
      <div class="md:hidden flex items-center">
        <button type="button" class="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-yellow-400 hover:bg-gray-800 focus:outline-none" aria-label="Open main menu" on:click={() => mobileMenuOpen = !mobileMenuOpen}>
          <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
            <path class={mobileMenuOpen ? 'hidden' : 'inline'} stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            <path class={mobileMenuOpen ? 'inline' : 'hidden'} stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div class="md:hidden bg-gray-900 border-t border-gray-800 px-2 pt-2 pb-3 space-y-1">
      <a href="/" class="block text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2">Home</a>
      <!-- Mobile Products Dropdown -->
      <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileProductsOpen = !mobileProductsOpen}>
        <span>Products</span>
        <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileProductsOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      {#if mobileProductsOpen}
        <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
          <a 
            href="/product-request" 
            class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            on:click={() => mobileProductsOpen = false}
          >Product Request</a>
          <a 
            href="/product-request-approval" 
            class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            on:click={() => mobileProductsOpen = false}
          >Product Request Approval</a>
          <a 
            href="/update-product-price" 
            class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            on:click={() => mobileProductsOpen = false}
          >Update Product Price</a>
          <a 
            href="/compare-sku" 
            class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            on:click={() => mobileProductsOpen = false}
          >Compare SKU</a>
        </div>
      {/if}
      <!-- Mobile Orders Dropdown -->
      <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileOrdersOpen = !mobileOrdersOpen}>
        <span>Orders</span>
        <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileOrdersOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      {#if mobileOrdersOpen}
        <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
          <a 
            href="/gross-profit-calculator" 
            class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            on:click={() => mobileOrdersOpen = false}
          >Gross Profit Calculator</a>
        </div>
      {/if}
    </div>
  {/if}
</nav> 