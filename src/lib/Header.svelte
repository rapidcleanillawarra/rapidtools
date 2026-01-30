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
	let userDropdownOpen = false;

	function toggleSidebarSize() {
		sidebarMinimized = !sidebarMinimized;
		if (browser) {
			localStorage.setItem('sidebarMinimized', sidebarMinimized.toString());
			// Dispatch event to update main content margin (desktop only)
			const isDesktop = window.innerWidth >= 1024; // lg breakpoint
			window.dispatchEvent(
				new CustomEvent('sidebar-toggle', {
					detail: {
						minimized: sidebarMinimized,
						isDesktop: isDesktop
					}
				})
			);
		}
		// Close all dropdowns when minimizing
		if (sidebarMinimized) {
			productsOpen = false;
			ordersOpen = false;
			shippingOpen = false;
			proMaxOpen = false;
			workshopOpen = false;
			sttOpen = false;
			userDropdownOpen = false;
		}
	}

	// Subscribe to the currentUser store
	let user: import('firebase/auth').User | null = null;
	let profile: UserProfile | null = null;
	const unsubCurrentUser = currentUser.subscribe((value) => {
		user = value;
		if (value) {
			loadUserProfile(value.uid);
		} else {
			profile = null;
		}
	});

	const unsubUserProfile = userProfile.subscribe((value) => {
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
	const unsubPage = page.subscribe((value) => {
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
			window.dispatchEvent(
				new CustomEvent('sidebar-toggle', {
					detail: {
						minimized: sidebarMinimized,
						isDesktop: isDesktop
					}
				})
			);
		}

		// Handle window resize to update layout when switching between mobile/desktop
		const handleResize = () => {
			if (browser) {
				const isDesktop = window.innerWidth >= 1024;
				window.dispatchEvent(
					new CustomEvent('sidebar-toggle', {
						detail: {
							minimized: sidebarMinimized,
							isDesktop: isDesktop
						}
					})
				);
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
	<div class="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900 shadow-lg lg:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<span class="text-xl font-bold tracking-tight text-yellow-400">RapidTools</span>
			<button
				type="button"
				on:click={toggleSidebar}
				class="rounded-md p-2 text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
				aria-label="Toggle sidebar"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Overlay for mobile/tablet -->
	{#if sidebarOpen}
		<div
			class="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
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
		class="fixed left-0 top-0 z-50 h-full overflow-y-auto border-r border-gray-800 bg-gray-900 shadow-2xl transition-all duration-300 ease-in-out"
		class:translate-x-0={sidebarOpen}
		class:-translate-x-full={!sidebarOpen}
		class:lg:translate-x-0={true}
		style={sidebarMinimized ? 'width: 80px;' : 'width: 280px;'}
	>
		<div class="flex h-full flex-col">
			<!-- Logo / Header -->
			<div
				class="flex items-center justify-between border-b border-gray-800"
				class:px-6={!sidebarMinimized}
				class:px-3={sidebarMinimized}
				class:py-4={true}
			>
				{#if !sidebarMinimized}
					<span class="text-2xl font-bold tracking-tight text-yellow-400">RapidTools</span>
				{:else}
					<span class="text-xl font-bold text-yellow-400">RT</span>
				{/if}
				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={toggleSidebarSize}
						class="hidden rounded-md p-1 text-gray-400 transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none lg:block"
						aria-label={sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
						title={sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if sidebarMinimized}
								<!-- Expand icon -->
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 5l7 7-7 7M5 5l7 7-7 7"
								/>
							{:else}
								<!-- Minimize icon -->
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
								/>
							{/if}
						</svg>
					</button>
					<button
						type="button"
						on:click={closeSidebar}
						class="rounded-md p-1 text-gray-400 transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none lg:hidden"
						aria-label="Close sidebar"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Navigation Links -->
			<nav
				class="flex-1 space-y-1 py-6"
				class:px-4={!sidebarMinimized}
				class:px-2={sidebarMinimized}
			>
				<!-- Home -->
				<a
					href="{base}/"
					class="flex items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400"
					class:px-4={!sidebarMinimized}
					class:px-3={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={closeSidebar}
					title="Home"
				>
					<svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
					{#if !sidebarMinimized}
						<span>Home</span>
					{/if}
				</a>

				<!-- Price Lists -->
				<a
					href="{base}/price-lists"
					class="flex items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400"
					class:px-4={!sidebarMinimized}
					class:px-3={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={closeSidebar}
					title="Price Lists"
				>
					<svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5h12M9 12h12M9 19h12M5 5h.01M5 12h.01M5 19h.01"
						/>
					</svg>
					{#if !sidebarMinimized}
						<span>Price Lists</span>
					{/if}
				</a>

				<!-- Products Dropdown -->
				<div class="products-dropdown">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
						class:px-4={!sidebarMinimized}
						class:px-3={sidebarMinimized}
						class:justify-center={sidebarMinimized}
						on:click={() => !sidebarMinimized && (productsOpen = !productsOpen)}
						title="Products"
					>
						<svg
							class="h-5 w-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
							/>
						</svg>
						{#if !sidebarMinimized}
							<span class="flex-1 text-left">Products</span>
							<svg
								class="h-4 w-4 transform transition-transform duration-200"
								class:rotate-180={productsOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{/if}
					</button>
					{#if productsOpen && !sidebarMinimized}
						<div class="mt-1 space-y-1 pl-4" transition:slide={{ duration: 200 }}>
							<a
								href="{base}/product-request"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Product Request</a
							>
							<a
								href="{base}/product-request-approval"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Product Request Approval</a
							>
							<a
								href="{base}/update-product-pricing"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Update Product Price</a
							>
							<a
								href="{base}/product-information-update"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Product Information Update</a
							>
						</div>
					{/if}
				</div>

				<!-- Orders Dropdown -->
				<div class="orders-dropdown">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
						class:px-4={!sidebarMinimized}
						class:px-3={sidebarMinimized}
						class:justify-center={sidebarMinimized}
						on:click={() => !sidebarMinimized && (ordersOpen = !ordersOpen)}
						title="Orders"
					>
						<svg
							class="h-5 w-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
							/>
						</svg>
						{#if !sidebarMinimized}
							<span class="flex-1 text-left">Orders</span>
							<svg
								class="h-4 w-4 transform transition-transform duration-200"
								class:rotate-180={ordersOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{/if}
					</button>
					{#if ordersOpen && !sidebarMinimized}
						<div class="mt-1 space-y-1 pl-4" transition:slide={{ duration: 200 }}>
							<a
								href="{base}/customer-group-invoices"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Customer Group Invoices</a
							>
							<a
								href="{base}/product-order-management"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Product Order Management</a
							>
							<a
								href="{base}/orders-past-due-accounts"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Past Due Accounts</a
							>
							<a
								href="{base}/statement-of-accounts"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Statement of Accounts</a
							>
							<a
								href="{base}/sent-invoice-logs"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Sent Invoice Logs</a
							>
							<a
								href="{base}/batch-payments"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Batch Payments</a
							>
							<a
								href="{base}/generate-invoice-pdf"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Generate Invoice PDF</a
							>
						</div>
					{/if}
				</div>

				<!-- Customers -->
				<a
					href="{base}/customers"
					class="flex items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400"
					class:px-4={!sidebarMinimized}
					class:px-3={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={closeSidebar}
					title="Customers"
				>
					<svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
					{#if !sidebarMinimized}
						<span>Customers</span>
					{/if}
				</a>

				<!-- Shipping Dropdown -->
				<div class="shipping-dropdown">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
						class:px-4={!sidebarMinimized}
						class:px-3={sidebarMinimized}
						class:justify-center={sidebarMinimized}
						on:click={() => !sidebarMinimized && (shippingOpen = !shippingOpen)}
						title="Shipping"
					>
						<svg
							class="h-5 w-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
							/>
						</svg>
						{#if !sidebarMinimized}
							<span class="flex-1 text-left">Shipping</span>
							<svg
								class="h-4 w-4 transform transition-transform duration-200"
								class:rotate-180={shippingOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{/if}
					</button>
					{#if shippingOpen && !sidebarMinimized}
						<div class="mt-1 space-y-1 pl-4" transition:slide={{ duration: 200 }}>
							<a
								href="{base}/shipping-zones"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Shipping Zones</a
							>
						</div>
					{/if}
				</div>

				<!-- Pro Max Dropdown -->
				<div class="promax-dropdown">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
						class:px-4={!sidebarMinimized}
						class:px-3={sidebarMinimized}
						class:justify-center={sidebarMinimized}
						on:click={() => !sidebarMinimized && (proMaxOpen = !proMaxOpen)}
						title="Pro Max"
					>
						<svg
							class="h-5 w-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
							/>
						</svg>
						{#if !sidebarMinimized}
							<span class="flex-1 text-left">Pro Max</span>
							<svg
								class="h-4 w-4 transform transition-transform duration-200"
								class:rotate-180={proMaxOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{/if}
					</button>
					{#if proMaxOpen && !sidebarMinimized}
						<div class="mt-1 space-y-1 pl-4" transition:slide={{ duration: 200 }}>
							<a
								href="{base}/promax-template"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Create Template</a
							>
							<a
								href="{base}/promax-settings"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Pro Max Settings</a
							>
						</div>
					{/if}
				</div>

				<!-- Workshop Dropdown -->
				<div class="workshop-dropdown">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
						class:px-4={!sidebarMinimized}
						class:px-3={sidebarMinimized}
						class:justify-center={sidebarMinimized}
						on:click={() => !sidebarMinimized && (workshopOpen = !workshopOpen)}
						title="Workshop"
					>
						<svg
							class="h-5 w-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						{#if !sidebarMinimized}
							<span class="flex-1 text-left">Workshop</span>
							<svg
								class="h-4 w-4 transform transition-transform duration-200"
								class:rotate-180={workshopOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{/if}
					</button>
					{#if workshopOpen && !sidebarMinimized}
						<div class="mt-1 space-y-1 pl-4" transition:slide={{ duration: 200 }}>
							<a
								href="{base}/workshop/workshop-board"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Workshop Job Status</a
							>
							{#if profile?.firstName === 'Joeven' && profile?.lastName === 'Cerveza'}
								<div class="my-1 h-px bg-gray-700"></div>
								<a
									href="{base}/workshop"
									class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
									on:click={closeSidebar}>Overview</a
								>
							{/if}
							<a
								href="{base}/workshop/camera"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Camera Access</a
							>
						</div>
					{/if}
				</div>

				<!-- STT Dropdown -->
				<div class="stt-dropdown">
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400 focus:outline-none"
						class:px-4={!sidebarMinimized}
						class:px-3={sidebarMinimized}
						class:justify-center={sidebarMinimized}
						on:click={() => !sidebarMinimized && (sttOpen = !sttOpen)}
						title="STT (Scheduled Test and Tag)"
					>
						<svg
							class="h-5 w-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						{#if !sidebarMinimized}
							<span class="flex-1 text-left">STT</span>
							<svg
								class="h-4 w-4 transform transition-transform duration-200"
								class:rotate-180={sttOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						{/if}
					</button>
					{#if sttOpen && !sidebarMinimized}
						<div class="mt-1 space-y-1 pl-4" transition:slide={{ duration: 200 }}>
							<a
								href="{base}/scheduled-test-and-tag/schedules"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Schedules</a
							>
							<a
								href="{base}/scheduled-test-and-tag/companies"
								class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
								on:click={closeSidebar}>Companies</a
							>
						</div>
					{/if}
				</div>

				<!-- Credentials Vault -->
				<a
					href="{base}/credentials-vault"
					class="flex items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400"
					class:px-4={!sidebarMinimized}
					class:px-3={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={closeSidebar}
					title="Credentials Vault"
				>
					<svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
						/>
					</svg>
					{#if !sidebarMinimized}
						<span>Credentials Vault</span>
					{/if}
				</a>

				<!-- Tickets -->
				<a
					href="{base}/tickets"
					class="flex items-center gap-3 rounded-lg py-2.5 text-base font-medium text-white transition hover:bg-gray-800 hover:text-yellow-400"
					class:px-4={!sidebarMinimized}
					class:px-3={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={closeSidebar}
					title="Tickets"
				>
					<svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					{#if !sidebarMinimized}
						<span>Tickets</span>
					{/if}
				</a>
			</nav>

			<!-- User Profile Section (Bottom of Sidebar) -->
			{#if user}
				<div
					class="border-t border-gray-800 py-4"
					class:px-4={!sidebarMinimized}
					class:px-2={sidebarMinimized}
				>
					<div class="user-dropdown">
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-lg py-3 text-base font-medium text-white transition hover:bg-gray-800 focus:outline-none"
							class:px-4={!sidebarMinimized}
							class:px-3={sidebarMinimized}
							class:justify-center={sidebarMinimized}
							on:click={() => !sidebarMinimized && (userDropdownOpen = !userDropdownOpen)}
							title={profile
								? `${profile.firstName} ${profile.lastName}`
								: user.email?.split('@')[0] || 'User'}
						>
							<svg
								class="h-5 w-5 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
							{#if !sidebarMinimized}
								<span class="flex-1 truncate text-left">
									{#if profile}
										{profile.firstName} {profile.lastName}
									{:else}
										{user.email?.split('@')[0] || 'User'}
									{/if}
								</span>
								<svg
									class="h-4 w-4 flex-shrink-0 transform transition-transform duration-200"
									class:rotate-180={userDropdownOpen}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							{/if}
						</button>
						{#if userDropdownOpen && !sidebarMinimized}
							<div class="mt-2 space-y-1" transition:slide={{ duration: 200 }}>
								<a
									href="{base}/edit-profile"
									class="block rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
									on:click={closeSidebar}>Edit Profile</a
								>
								<button
									on:click={handleSignOut}
									class="w-full rounded-lg px-4 py-2 text-left text-sm text-gray-300 transition hover:bg-gray-800 hover:text-yellow-400"
									>Sign Out</button
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</aside>
{/if}
