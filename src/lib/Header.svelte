<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';
  import { currentUser, logoutUser } from '$lib/firebase';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { userProfile, type UserProfile, fetchUserProfile } from '$lib/userProfile';
  let mobileMenuOpen = false;
  let productsOpen = false;
  let ordersOpen = false;
  let userDropdownOpen = false;
  let shippingOpen = false;

  // Subscribe to the currentUser store
  let user: import('firebase/auth').User | null = null;
  let profile: UserProfile | null = null;
  const unsubCurrentUser = currentUser.subscribe(value => {
    user = value;
    if (value) {
      loadUserProfile(value.uid);
    } else {
      profile = null;
    }
  });

  const unsubUserProfile = userProfile.subscribe(value => {
    profile = value;
  });

  async function loadUserProfile(uid: string) {
    try {
      await fetchUserProfile(uid);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  // Check if we're on the landing page
  let isLandingPage: boolean;
  const unsubPage = page.subscribe(value => {
    isLandingPage = value.url.pathname === base + '/' || value.url.pathname === base;
  });

  // For mobile dropdowns
  let mobileProductsOpen = false;
  let mobileOrdersOpen = false;
  let mobileShippingOpen = false;

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.products-dropdown') && productsOpen) {
      productsOpen = false;
    }
    if (!target.closest('.orders-dropdown') && ordersOpen) {
      ordersOpen = false;
    }
    if (!target.closest('.user-dropdown') && userDropdownOpen) {
      userDropdownOpen = false;
    }
    if (!target.closest('.shipping-dropdown') && shippingOpen) {
      shippingOpen = false;
    }
  }

  async function handleSignOut() {
    try {
      await logoutUser();
      // The currentUser store will automatically update
      window.location.href = base + '/'; // Redirect to home/login page
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  onMount(() => {
    const close = () => {
      mobileMenuOpen = false;
      productsOpen = false;
      ordersOpen = false;
      mobileProductsOpen = false;
      mobileOrdersOpen = false;
      mobileShippingOpen = false;
      userDropdownOpen = false;
      shippingOpen = false;
    };
    window.addEventListener('hashchange', close);
    window.addEventListener('popstate', close);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('popstate', close);
      window.removeEventListener('click', handleClickOutside);
      unsubCurrentUser(); // Clean up the subscription
      unsubPage(); // Clean up page subscription
      unsubUserProfile(); // Clean up profile subscription
    };
  });
</script>

{#if !isLandingPage}
  <nav class="bg-gray-900 border-b border-gray-800 w-full sticky top-0 z-50">
    <div class="max-w-[98%] mx-auto px-4 sm:px-6">
      <div class="flex justify-between items-center h-16">
        <!-- Logo / App Name -->
        <div class="flex-shrink-0 flex items-center">
          <span class="text-2xl font-bold text-yellow-400 tracking-tight">RapidTools</span>
        </div>
        <!-- Desktop Nav -->
        <div class="hidden md:flex space-x-6 items-center">
          <a href="{base}/" class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1">Home</a>
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
                    href="{base}/product-request" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => productsOpen = false}
                  >Product Request</a>
                  <a 
                    href="{base}/product-request-approval" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => productsOpen = false}
                  >Product Request Approval</a>
                  <a 
                    href="{base}/update-product-pricing" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => productsOpen = false}
                  >Update Product Price</a>
                  <a 
                    href="{base}/compare-sku" 
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
                    href="{base}/gross-profit-calculator" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => ordersOpen = false}
                  >Gross Profit Calculator</a>
                  <a 
                    href="{base}/customer-group-invoices" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => ordersOpen = false}
                  >Customer Group Invoices</a>
                  <a 
                    href="{base}/customer-groups" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => ordersOpen = false}
                  >Customer Groups</a>
                  <a 
                    href="{base}/batch-payments" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => ordersOpen = false}
                    data-sveltekit-preload-data="off"
                  >Batch Payments</a>
                  <a 
                    href="{base}/xero-maropost-history" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => ordersOpen = false}
                    data-sveltekit-preload-data="off"
                  >Xero Maropost History</a>
                </div>
              </div>
            {/if}
          </div>
          <!-- Shipping Dropdown -->
          <div class="relative shipping-dropdown">
            <button 
              type="button" 
              class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none" 
              on:click|stopPropagation={() => {
                shippingOpen = !shippingOpen;
                if (shippingOpen) {
                  productsOpen = false;
                  ordersOpen = false;
                }
              }}
            >
              Shipping
              <svg 
                class="w-4 h-4 ml-1 transform transition-transform duration-200" 
                class:rotate-180={shippingOpen}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {#if shippingOpen}
              <div 
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out"
                transition:fade
              >
                <div class="py-1.5">
                  <a 
                    href="{base}/shipping-zones" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => shippingOpen = false}
                  >Shipping Zones</a>
                </div>
              </div>
            {/if}
          </div>
          <!-- User Profile Dropdown -->
          {#if user}
            <div class="relative user-dropdown ml-6">
              <button 
                type="button" 
                class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none" 
                on:click|stopPropagation={() => userDropdownOpen = !userDropdownOpen}
              >
                {#if profile}
                  {profile.firstName} {profile.lastName}
                {:else}
                  {user.email?.split('@')[0] || 'User'}
                {/if}
                <svg 
                  class="w-4 h-4 ml-1 transform transition-transform duration-200" 
                  class:rotate-180={userDropdownOpen}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {#if userDropdownOpen}
                <div 
                  class="absolute right-0 w-48 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out"
                  transition:fade
                >
                  <div class="py-1.5">
                    <a 
                      href="/edit-profile"
                      class="block w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    >
                      Edit Profile
                    </a>
                    <div class="h-px bg-gray-200 my-1"></div>
                    <button 
                      on:click={handleSignOut}
                      class="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
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
        <a href="{base}/" class="block text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2">Home</a>
        <!-- Mobile Products Dropdown -->
        <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileProductsOpen = !mobileProductsOpen}>
          <span>Products</span>
          <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileProductsOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {#if mobileProductsOpen}
          <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
            <a 
              href="{base}/product-request" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProductsOpen = false}
            >Product Request</a>
            <a 
              href="{base}/product-request-approval" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProductsOpen = false}
            >Product Request Approval</a>
            <a 
              href="{base}/update-product-price" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProductsOpen = false}
            >Update Product Price</a>
            <a 
              href="{base}/compare-sku" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProductsOpen = false}
            >Compare SKU</a>
            <a 
              href="{base}/apply-payments" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProductsOpen = false}
              data-sveltekit-preload-data="off"
            >Apply Payments</a>
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
              href="{base}/gross-profit-calculator" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileOrdersOpen = false}
            >Gross Profit Calculator</a>
            <a 
              href="{base}/customer-group-invoices" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileOrdersOpen = false}
            >Customer Group Invoices</a>
            <a 
              href="{base}/customer-groups" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileOrdersOpen = false}
            >Customer Groups</a>
            <a 
              href="{base}/batch-payments" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileOrdersOpen = false}
              data-sveltekit-preload-data="off"
            >Batch Payments</a>
            <a 
              href="{base}/xero-maropost-history" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileOrdersOpen = false}
              data-sveltekit-preload-data="off"
            >Xero Maropost History</a>
          </div>
        {/if}
        <!-- Mobile Shipping Dropdown -->
        <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileShippingOpen = !mobileShippingOpen}>
          <span>Shipping</span>
          <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileShippingOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {#if mobileShippingOpen}
          <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
            <a 
              href="{base}/shipping-zones" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileShippingOpen = false}
            >Shipping Zones</a>
          </div>
        {/if}
        <!-- Mobile User Profile -->
        {#if user}
          <div class="border-t border-gray-800 mt-2 pt-2">
            <div class="px-3 py-2 text-white text-base font-medium">
              {#if profile}
                {profile.firstName} {profile.lastName}
              {:else}
                {user.email?.split('@')[0] || 'User'}
              {/if}
            </div>
            <a 
              href="{base}/edit-profile"
              class="block w-full text-left text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            >
              Edit Profile
            </a>
            <button 
              on:click={handleSignOut}
              class="w-full text-left text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
            >
              Sign Out
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </nav>
{/if} 