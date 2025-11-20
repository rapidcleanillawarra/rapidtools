<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { currentUser, logoutUser } from '$lib/firebase';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { userProfile, type UserProfile, fetchUserProfile } from '$lib/userProfile';
  import { browser } from '$app/environment';
  
  let sidebarOpen = false;
  let sidebarMinimized = false;
  let productsOpen = false;
  let ordersOpen = false;
  let shippingOpen = false;
  let proMaxOpen = false;
  let workshopOpen = false;
  let sttOpen = false;
  let catalogueOpen = false;
  let userDropdownOpen = false;

  function toggleSidebarSize() {
    sidebarMinimized = !sidebarMinimized;
    if (browser) {
      localStorage.setItem('sidebarMinimized', sidebarMinimized.toString());
      // Dispatch event to update main content margin (desktop only)
      const isDesktop = window.innerWidth >= 1024; // lg breakpoint
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
        detail: { 
          minimized: sidebarMinimized,
          isDesktop: isDesktop
        } 
      }));
    }
    // Close all dropdowns when minimizing
    if (sidebarMinimized) {
      productsOpen = false;
      ordersOpen = false;
      shippingOpen = false;
      proMaxOpen = false;
      workshopOpen = false;
      sttOpen = false;
      catalogueOpen = false;
      userDropdownOpen = false;
    }
  }

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

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function closeSidebar() {
    sidebarOpen = false;
    productsOpen = false;
    ordersOpen = false;
    shippingOpen = false;
    proMaxOpen = false;
    workshopOpen = false;
    sttOpen = false;
    catalogueOpen = false;
    userDropdownOpen = false;
  }

  async function handleSignOut() {
    try {
      await logoutUser();
      window.location.href = base + '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  onMount(() => {
    // Load sidebar state from localStorage
    if (browser && localStorage.getItem('sidebarMinimized') === 'true') {
      sidebarMinimized = true;
    }

    // Dispatch initial sidebar state
    if (browser) {
      const isDesktop = window.innerWidth >= 1024;
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
        detail: { 
          minimized: sidebarMinimized,
          isDesktop: isDesktop
        } 
      }));
    }

    // Handle window resize to update layout when switching between mobile/desktop
    const handleResize = () => {
      if (browser) {
        const isDesktop = window.innerWidth >= 1024;
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
          detail: { 
            minimized: sidebarMinimized,
            isDesktop: isDesktop
          } 
        }));
      }
    };

    const close = () => {
      sidebarOpen = false;
      productsOpen = false;
      ordersOpen = false;
      shippingOpen = false;
      proMaxOpen = false;
      workshopOpen = false;
      sttOpen = false;
      catalogueOpen = false;
      userDropdownOpen = false;
    };
    
    window.addEventListener('hashchange', close);
    window.addEventListener('popstate', close);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('hashchange', close);
      window.removeEventListener('popstate', close);
      window.removeEventListener('resize', handleResize);
      unsubCurrentUser();
      unsubPage();
      unsubUserProfile();
    };
  });
</script>

{#if !isLandingPage}
  <!-- Mobile Top Bar -->
  <div class="lg:hidden bg-gray-900 border-b border-gray-800 w-full sticky top-0 z-50 shadow-lg">
    <div class="flex items-center justify-between px-4 py-3">
      <span class="text-xl font-bold text-yellow-400 tracking-tight">RapidTools</span>
      <button
        type="button"
        on:click={toggleSidebar}
        class="p-2 rounded-md text-gray-300 hover:text-yellow-400 hover:bg-gray-800 focus:outline-none transition"
        aria-label="Toggle sidebar"
      >
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Overlay for mobile/tablet -->
  {#if sidebarOpen}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
      on:click={closeSidebar}
      on:keydown={(e) => e.key === 'Escape' && closeSidebar()}
      role="button"
      tabindex="-1"
      transition:fade={{ duration: 200 }}
      aria-label="Close sidebar"
    ></div>
  {/if}

  <!-- Sidebar -->
  <aside
    class="fixed top-0 left-0 h-full bg-gray-900 border-r border-gray-800 shadow-2xl z-50 transition-all duration-300 ease-in-out overflow-y-auto"
    class:translate-x-0={sidebarOpen}
    class:-translate-x-full={!sidebarOpen}
    class:lg:translate-x-0={true}
    style={sidebarMinimized ? 'width: 80px;' : 'width: 280px;'}
  >
    <div class="flex flex-col h-full">
      <!-- Logo / Header -->
      <div class="flex items-center justify-between border-b border-gray-800" class:px-6={!sidebarMinimized} class:px-3={sidebarMinimized} class:py-4={true}>
        {#if !sidebarMinimized}
          <span class="text-2xl font-bold text-yellow-400 tracking-tight">RapidTools</span>
        {:else}
          <span class="text-xl font-bold text-yellow-400">RT</span>
        {/if}
        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={toggleSidebarSize}
            class="hidden lg:block p-1 rounded-md text-gray-400 hover:text-yellow-400 hover:bg-gray-800 focus:outline-none transition"
            aria-label={sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
            title={sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {#if sidebarMinimized}
                <!-- Expand icon -->
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              {:else}
                <!-- Minimize icon -->
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              {/if}
            </svg>
          </button>
          <button
            type="button"
            on:click={closeSidebar}
            class="lg:hidden p-1 rounded-md text-gray-400 hover:text-yellow-400 hover:bg-gray-800 focus:outline-none transition"
            aria-label="Close sidebar"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 py-6 space-y-1" class:px-4={!sidebarMinimized} class:px-2={sidebarMinimized}>
        <!-- Home -->
        <a
          href="{base}/"
          class="flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
          class:px-4={!sidebarMinimized}
          class:px-3={sidebarMinimized}
          class:justify-center={sidebarMinimized}
          on:click={closeSidebar}
          title="Home"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {#if !sidebarMinimized}
            <span>Home</span>
          {/if}
        </a>

        <!-- Catalogue Dropdown -->
        <div class="catalogue-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (catalogueOpen = !catalogueOpen)}
            title="Catalogue"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">Catalogue</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={catalogueOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if catalogueOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/catalogue"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Create Catalogue</a>
            </div>
          {/if}
        </div>

        <!-- Products Dropdown -->
        <div class="products-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (productsOpen = !productsOpen)}
            title="Products"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">Products</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={productsOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if productsOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/product-request"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Product Request</a>
              <a
                href="{base}/product-request-approval"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Product Request Approval</a>
              <a
                href="{base}/update-product-pricing"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Update Product Price</a>
              <a
                href="{base}/product-information-update"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Product Information Update</a>
            </div>
          {/if}
        </div>

        <!-- Orders Dropdown -->
        <div class="orders-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (ordersOpen = !ordersOpen)}
            title="Orders"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">Orders</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={ordersOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if ordersOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/customer-group-invoices"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Customer Group Invoices</a>
              <a
                href="{base}/customer-groups"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Customer Groups</a>
              <a
                href="{base}/batch-payments"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
                data-sveltekit-preload-data="off"
              >Batch Payments</a>
              <a
                href="{base}/xero-maropost-history"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
                data-sveltekit-preload-data="off"
              >Xero Maropost History</a>
              <a
                href="{base}/rebates"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Rebates</a>
            </div>
          {/if}
        </div>

        <!-- Shipping Dropdown -->
        <div class="shipping-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (shippingOpen = !shippingOpen)}
            title="Shipping"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">Shipping</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={shippingOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if shippingOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/shipping-zones"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Shipping Zones</a>
            </div>
          {/if}
        </div>

        <!-- Pro Max Dropdown -->
        <div class="promax-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (proMaxOpen = !proMaxOpen)}
            title="Pro Max"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">Pro Max</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={proMaxOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if proMaxOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/promax-template"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Create Template</a>
              <a
                href="{base}/promax-settings"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Pro Max Settings</a>
            </div>
          {/if}
        </div>

        <!-- Workshop Dropdown -->
        <div class="workshop-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (workshopOpen = !workshopOpen)}
            title="Workshop"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">Workshop</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={workshopOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if workshopOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/workshop/workshop-board"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Workshop Job Status</a>
              {#if profile?.firstName === "Joeven" && profile?.lastName === "Cerveza"}
                <div class="h-px bg-gray-700 my-1"></div>
                <a
                  href="{base}/workshop"
                  class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                  on:click={closeSidebar}
                >Overview</a>
              {/if}
              <a
                href="{base}/workshop/camera"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Camera Access</a>
            </div>
          {/if}
        </div>

        <!-- STT Dropdown -->
        <div class="stt-dropdown">
          <button
            type="button"
            class="w-full flex items-center gap-3 py-2.5 text-white text-base font-medium hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition focus:outline-none"
            class:px-4={!sidebarMinimized}
            class:px-3={sidebarMinimized}
            class:justify-center={sidebarMinimized}
            on:click={() => !sidebarMinimized && (sttOpen = !sttOpen)}
            title="STT (Scheduled Test and Tag)"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {#if !sidebarMinimized}
              <span class="flex-1 text-left">STT</span>
              <svg
                class="w-4 h-4 transform transition-transform duration-200"
                class:rotate-180={sttOpen}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            {/if}
          </button>
          {#if sttOpen && !sidebarMinimized}
            <div class="pl-4 mt-1 space-y-1" transition:slide={{ duration: 200 }}>
              <a
                href="{base}/scheduled-test-and-tag/schedules"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Schedules</a>
              <a
                href="{base}/scheduled-test-and-tag/companies"
                class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                on:click={closeSidebar}
              >Companies</a>
            </div>
          {/if}
        </div>
      </nav>

      <!-- User Profile Section (Bottom of Sidebar) -->
      {#if user}
        <div class="border-t border-gray-800 py-4" class:px-4={!sidebarMinimized} class:px-2={sidebarMinimized}>
          <div class="user-dropdown">
            <button
              type="button"
              class="w-full flex items-center gap-3 py-3 text-white text-base font-medium hover:bg-gray-800 rounded-lg transition focus:outline-none"
              class:px-4={!sidebarMinimized}
              class:px-3={sidebarMinimized}
              class:justify-center={sidebarMinimized}
              on:click={() => !sidebarMinimized && (userDropdownOpen = !userDropdownOpen)}
              title={profile ? `${profile.firstName} ${profile.lastName}` : (user.email?.split('@')[0] || 'User')}
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {#if !sidebarMinimized}
                <span class="flex-1 text-left truncate">
                  {#if profile}
                    {profile.firstName} {profile.lastName}
                  {:else}
                    {user.email?.split('@')[0] || 'User'}
                  {/if}
                </span>
                <svg
                  class="w-4 h-4 flex-shrink-0 transform transition-transform duration-200"
                  class:rotate-180={userDropdownOpen}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              {/if}
            </button>
            {#if userDropdownOpen && !sidebarMinimized}
              <div class="mt-2 space-y-1" transition:slide={{ duration: 200 }}>
                <a
                  href="{base}/edit-profile"
                  class="block px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                  on:click={closeSidebar}
                >Edit Profile</a>
                <button
                  on:click={handleSignOut}
                  class="w-full text-left px-4 py-2 text-gray-300 text-sm hover:bg-gray-800 hover:text-yellow-400 rounded-lg transition"
                >Sign Out</button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </aside>
{/if}
