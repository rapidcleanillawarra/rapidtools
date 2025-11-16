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
  let customerGroupProductsOpen = false;
  let proMaxOpen = false; // Add this line
  let workshopOpen = false; // Add workshop dropdown state
  let sttOpen = false; // Add STT dropdown state
  let catalogueOpen = false; // Add catalogue dropdown state

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
    const pathname = value.url.pathname;
    const basePath = base || '';
    isLandingPage = pathname === basePath + '/' || pathname === basePath;
  });

  // For mobile dropdowns
  let mobileProductsOpen = false;
  let mobileOrdersOpen = false;
  let mobileShippingOpen = false;
  let mobileCustomerGroupProductsOpen = false;
  let mobileProMaxOpen = false; // Add this line
  let mobileWorkshopOpen = false; // Add mobile workshop dropdown state
  let mobileSttOpen = false; // Add mobile STT dropdown state
  let mobileCatalogueOpen = false; // Add mobile catalogue dropdown state

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
    if (!target.closest('.customer-group-products-dropdown') && customerGroupProductsOpen) {
      customerGroupProductsOpen = false;
    }
    if (!target.closest('.promax-dropdown') && proMaxOpen) { // Add this block
      proMaxOpen = false;
    }
    if (!target.closest('.workshop-dropdown') && workshopOpen) { // Add workshop dropdown handling
      workshopOpen = false;
    }
    if (!target.closest('.stt-dropdown') && sttOpen) { // Add STT dropdown handling
      sttOpen = false;
    }
    if (!target.closest('.catalogue-dropdown') && catalogueOpen) { // Add catalogue dropdown handling
      catalogueOpen = false;
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
      customerGroupProductsOpen = false;
      proMaxOpen = false; // Add this line
      mobileProMaxOpen = false; // Add this line
      workshopOpen = false; // Add workshop dropdown
      mobileWorkshopOpen = false; // Add mobile workshop dropdown
      sttOpen = false; // Add STT dropdown
      mobileSttOpen = false; // Add mobile STT dropdown
      catalogueOpen = false; // Add catalogue dropdown
      mobileCatalogueOpen = false; // Add mobile catalogue dropdown
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
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
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
                  <a
                    href="{base}/customer-group-products"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => productsOpen = false}
                  >Customer Group Products</a>
                </div>
              </div>
            {/if}
          </div>
          <!-- Catalogue Dropdown -->
          <div class="relative catalogue-dropdown">
            <button
              type="button"
              class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none"
              on:click|stopPropagation={() => {
                catalogueOpen = !catalogueOpen;
                if (catalogueOpen) {
                  productsOpen = false;
                  ordersOpen = false;
                  shippingOpen = false;
                  proMaxOpen = false;
                  workshopOpen = false;
                  sttOpen = false;
                }
              }}
              on:mouseenter={() => {
                if (!catalogueOpen) {
                  catalogueOpen = true;
                  productsOpen = false;
                  ordersOpen = false;
                  shippingOpen = false;
                  proMaxOpen = false;
                  workshopOpen = false;
                  sttOpen = false;
                }
              }}
              on:mouseleave={() => {
                // Don't close on mouseleave - let handleClickOutside handle it
              }}
            >
              Catalogue
              <svg
                class="w-4 h-4 ml-1 transform transition-transform duration-200"
                class:rotate-180={catalogueOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {#if catalogueOpen}
              <div
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
                transition:fade
                on:mouseleave={() => {
                  catalogueOpen = false;
                }}
              >
                <div class="py-1.5">
                  <a
                    href="{base}/catalogue"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => catalogueOpen = false}
                  >View Catalogue</a>
                  <a
                    href="{base}/catalogue/print"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => catalogueOpen = false}
                  >Print Catalogue</a>
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
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
                transition:fade
              >
                <div class="py-1.5">
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
                  <a 
                    href="{base}/rebates" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => ordersOpen = false}
                  >Rebates</a>
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
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
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
          <!-- Pro Max Dropdown -->
          <div class="relative promax-dropdown">
            <button 
              type="button" 
              class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none" 
              on:click|stopPropagation={() => {
                proMaxOpen = !proMaxOpen;
                if (proMaxOpen) {
                  productsOpen = false;
                  ordersOpen = false;
                  shippingOpen = false;
                  sttOpen = false;
                }
              }}
            >
              Pro Max
              <svg 
                class="w-4 h-4 ml-1 transform transition-transform duration-200" 
                class:rotate-180={proMaxOpen}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {#if proMaxOpen}
              <div 
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
                transition:fade
              >
                <div class="py-1.5">
                  <a 
                    href="{base}/promax-template" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => proMaxOpen = false}
                  >Create Template</a>
                  <a 
                    href="{base}/promax-settings" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => proMaxOpen = false}
                  >Pro Max Settings</a>
                </div>
              </div>
            {/if}
          </div>
          <!-- Workshop Dropdown -->
          <div class="relative workshop-dropdown">
            <button
              type="button"
              class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none"
              on:click|stopPropagation={() => {
                workshopOpen = !workshopOpen;
                if (workshopOpen) {
                  productsOpen = false;
                  ordersOpen = false;
                  shippingOpen = false;
                  proMaxOpen = false;
                  sttOpen = false;
                }
              }}
            >
              Workshop
              <svg
                class="w-4 h-4 ml-1 transform transition-transform duration-200"
                class:rotate-180={workshopOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {#if workshopOpen}
              <div
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
                transition:fade
              >
                <div class="py-1.5">
                  <a
                    href="{base}/workshop/workshop-board"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => workshopOpen = false}
                  >Workshop Job Status</a>
                  <div class="h-px bg-gray-200 my-1"></div>
                  <a
                    href="{base}/workshop"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => workshopOpen = false}
                  >Overview</a>
                  <a
                    href="{base}/workshop/create"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => workshopOpen = false}
                  >Create Workshop</a>
                  <a
                    href="{base}/workshop/camera"
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => workshopOpen = false}
                  >Camera Access</a>
                </div>
              </div>
            {/if}
          </div>
          <!-- STT Dropdown -->
          <div class="relative stt-dropdown">
            <button 
              type="button" 
              class="text-white text-lg font-medium hover:text-yellow-400 transition px-2 py-1 flex items-center gap-1 focus:outline-none" 
              on:click|stopPropagation={() => {
                sttOpen = !sttOpen;
                if (sttOpen) {
                  productsOpen = false;
                  ordersOpen = false;
                  shippingOpen = false;
                  proMaxOpen = false;
                }
              }}
            >
              STT
              <svg 
                class="w-4 h-4 ml-1 transform transition-transform duration-200" 
                class:rotate-180={sttOpen}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {#if sttOpen}
              <div 
                class="absolute left-0 w-56 mt-1 bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-gray-200/50 transform origin-top transition-all duration-200 ease-out z-40"
                transition:fade
              >
                <div class="py-1.5">
                  <a 
                    href="{base}/scheduled-test-and-tag/schedules" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => sttOpen = false}
                  >Schedules</a>
                  <a 
                    href="{base}/scheduled-test-and-tag/companies" 
                    class="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                    on:click={() => sttOpen = false}
                  >Companies</a>
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
        <!-- Mobile Catalogue Dropdown -->
        <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileCatalogueOpen = !mobileCatalogueOpen}>
          <span>Catalogue</span>
          <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileCatalogueOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {#if mobileCatalogueOpen}
          <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
            <a
              href="{base}/catalogue"
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileCatalogueOpen = false}
            >View Catalogue</a>
            <a
              href="{base}/catalogue/print"
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileCatalogueOpen = false}
            >Print Catalogue</a>
          </div>
        {/if}
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
              href="{base}/customer-group-products" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProductsOpen = false}
            >Customer Group Products</a>
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
            <a 
              href="{base}/rebates" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileOrdersOpen = false}
            >Rebates</a>
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
        <!-- Mobile Pro Max Dropdown -->
        <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileProMaxOpen = !mobileProMaxOpen}>
          <span>Pro Max</span>
          <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileProMaxOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {#if mobileProMaxOpen}
          <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
            <a 
              href="{base}/promax-template" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProMaxOpen = false}
            >Create Template</a>
            <a 
              href="{base}/promax-settings" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileProMaxOpen = false}
            >Pro Max Settings</a>
          </div>
        {/if}
        <!-- Mobile Workshop Dropdown -->
        <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileWorkshopOpen = !mobileWorkshopOpen}>
          <span>Workshop</span>
          <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileWorkshopOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {#if mobileWorkshopOpen}
          <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
            <a
              href="{base}/workshop/workshop-board"
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileWorkshopOpen = false}
            >Workshop Job Status</a>
            <div class="h-px bg-gray-700 my-1"></div>
            <a
              href="{base}/workshop"
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileWorkshopOpen = false}
            >Overview</a>
            <a
              href="{base}/workshop/create"
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileWorkshopOpen = false}
            >Create Workshop</a>
            <a
              href="{base}/workshop/camera"
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileWorkshopOpen = false}
            >Camera Access</a>
          </div>
        {/if}
        <!-- Mobile STT Dropdown -->
        <button type="button" class="w-full flex justify-between items-center text-white text-base font-medium hover:text-yellow-400 transition px-3 py-2 focus:outline-none" on:click={() => mobileSttOpen = !mobileSttOpen}>
          <span>STT</span>
          <svg class="w-4 h-4 ml-1 transform transition-transform duration-200" class:rotate-180={mobileSttOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        {#if mobileSttOpen}
          <div class="pl-4 space-y-1 bg-gray-800/50 mt-1">
            <a 
              href="{base}/scheduled-test-and-tag/schedules" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileSttOpen = false}
            >Schedules</a>
            <a 
              href="{base}/scheduled-test-and-tag/companies" 
              class="block text-gray-200 hover:text-yellow-400 transition-colors duration-150 px-3 py-2.5 hover:bg-gray-800/50"
              on:click={() => mobileSttOpen = false}
            >Companies</a>
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