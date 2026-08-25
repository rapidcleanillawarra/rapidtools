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
	let rememberSidebarMinimized = false;

	// Dropdown states in expanded mode
	let productsOpen = false;
	let ordersOpen = false;
	let shippingOpen = false;
	let proMaxOpen = false;
	let assetsOpen = false;
	let workshopOpen = false;
	let sttOpen = false;
	let brochuresOpen = false;
	let userDropdownOpen = false;

	// Flyout states in minimized mode
	let activeFlyout: string | null = null;
	let flyoutTop = 0;
	let flyoutTitle = '';
	let flyoutItems: { href: string; label: string }[] = [];
	let flyoutTimeout: ReturnType<typeof setTimeout> | null = null;

	// Standalone tooltip in minimized mode
	let tooltipText = '';
	let tooltipTop = 0;
	let tooltipVisible = false;

	function toggleSidebarSize() {
		sidebarMinimized = !sidebarMinimized;
		activeFlyout = null;
		tooltipVisible = false;

		if (browser) {
			if (rememberSidebarMinimized) {
				localStorage.setItem('sidebarMinimized', sidebarMinimized.toString());
			}
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

		if (sidebarMinimized) {
			closeAllExpandedDropdowns();
		}
	}

	function toggleRememberSidebar() {
		rememberSidebarMinimized = !rememberSidebarMinimized;
		if (browser) {
			localStorage.setItem('rememberSidebarMinimized', rememberSidebarMinimized.toString());
			if (rememberSidebarMinimized) {
				localStorage.setItem('sidebarMinimized', sidebarMinimized.toString());
			} else {
				localStorage.removeItem('sidebarMinimized');
			}
		}
	}

	function closeAllExpandedDropdowns() {
		productsOpen = false;
		ordersOpen = false;
		shippingOpen = false;
		proMaxOpen = false;
		assetsOpen = false;
		workshopOpen = false;
		sttOpen = false;
		brochuresOpen = false;
		userDropdownOpen = false;
	}

	function openFlyout(e: MouseEvent, title: string, items: { href: string; label: string }[]) {
		if (!sidebarMinimized) return;
		tooltipVisible = false;
		if (flyoutTimeout) {
			clearTimeout(flyoutTimeout);
			flyoutTimeout = null;
		}

		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const estimatedHeight = items.length * 38 + 56;
		const maxTop = window.innerHeight - estimatedHeight - 16;
		flyoutTop = Math.max(10, Math.min(rect.top, maxTop));
		flyoutTitle = title;
		flyoutItems = items;
		activeFlyout = title;
	}

	function openUserFlyout(e: MouseEvent) {
		if (!sidebarMinimized) return;
		tooltipVisible = false;
		if (flyoutTimeout) {
			clearTimeout(flyoutTimeout);
			flyoutTimeout = null;
		}

		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const estimatedHeight = 160;
		const maxTop = window.innerHeight - estimatedHeight - 16;
		flyoutTop = Math.max(10, Math.min(rect.top, maxTop));
		activeFlyout = 'user_profile';
	}

	function scheduleCloseFlyout() {
		if (flyoutTimeout) clearTimeout(flyoutTimeout);
		flyoutTimeout = setTimeout(() => {
			activeFlyout = null;
		}, 180);
	}

	function cancelCloseFlyout() {
		if (flyoutTimeout) {
			clearTimeout(flyoutTimeout);
			flyoutTimeout = null;
		}
	}

	function showTooltip(e: MouseEvent, text: string) {
		if (!sidebarMinimized || activeFlyout) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		tooltipTop = rect.top + (rect.height / 2) - 14;
		tooltipText = text;
		tooltipVisible = true;
	}

	function hideTooltip() {
		tooltipVisible = false;
	}

	// Active route helper
	function isPathActive(href: string, exact = false): boolean {
		const pathname = $page.url.pathname;
		const fullHref = href;
		if (exact || fullHref === base + '/' || fullHref === base) {
			return pathname === fullHref;
		}
		return pathname === fullHref || pathname.startsWith(fullHref + '/');
	}

	// User state
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

	// Landing page check
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
		activeFlyout = null;
		tooltipVisible = false;
		closeAllExpandedDropdowns();
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
		if (browser) {
			rememberSidebarMinimized = localStorage.getItem('rememberSidebarMinimized') === 'true';
			if (rememberSidebarMinimized && localStorage.getItem('sidebarMinimized') === 'true') {
				sidebarMinimized = true;
			}

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
			activeFlyout = null;
			tooltipVisible = false;
			closeAllExpandedDropdowns();
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

	// Dynamic menu definitions for submenus
	$: assetsLinks = [
		{ href: 'https://rapidcleantools.vercel.app/admin/assets', label: 'Assets' },
		{ href: 'https://rapidcleantools.vercel.app/admin/assets/customers', label: 'Customers' },
		{ href: 'https://rapidcleantools.vercel.app/admin/assets/qr', label: 'QR codes' },
		{ href: 'https://rapidcleantools.vercel.app/admin/assets/qr/design', label: 'QR design' }
	];

	$: productsLinks = [
		{ href: `${base}/product-request`, label: 'Product Request' },
		{ href: `${base}/product-request-approval`, label: 'Product Request Approval' },
		{ href: `${base}/update-product-pricing`, label: 'Update Product Price' },
		{ href: `${base}/product-information-update`, label: 'Product Information Update' }
	];

	$: ordersLinks = [
		{ href: `${base}/customer-group-invoices`, label: 'Customer Group Invoices' },
		{ href: `${base}/product-order-management`, label: 'Product Order Management' },
		{ href: `${base}/orders-past-due-accounts`, label: 'Past Due Accounts' },
		{ href: `${base}/sent-invoice-logs`, label: 'Sent Invoice Logs' },
		{ href: `${base}/batch-payments`, label: 'Batch Payments' },
		{ href: `${base}/generate-invoice-pdf`, label: 'Generate Invoice PDF' }
	];

	$: shippingLinks = [
		{ href: `${base}/shipping-zones`, label: 'Shipping Zones' }
	];

	$: proMaxLinks = [
		{ href: `${base}/promax-template`, label: 'Create Template' },
		{ href: `${base}/promax-settings`, label: 'Pro Max Settings' }
	];

	$: workshopLinks = [
		{ href: `${base}/workshop/workshop-board`, label: 'Workshop Job Status' },
		{ href: `${base}/workshop/deliveries`, label: 'Deliveries' },
		{ href: `${base}/workshop/tech-jobs-summary`, label: 'Tech Jobs Summary' },
		{ href: `${base}/workshop/preventative_maintenance?form=carpet_extractor`, label: 'PMIS' },
		{ href: `${base}/workshop/preventative_maintenance?form=floor_scrubber`, label: 'Floor Scrubber PM' },
		{ href: `${base}/workshop/preventative_maintenance?form=pressure_washer`, label: 'IMS (HD / HDS)' },
		...(profile?.firstName === 'Joeven' && profile?.lastName === 'Cerveza'
			? [{ href: `${base}/workshop`, label: 'Overview' }]
			: [])
	];

	$: sttLinks = [
		{ href: `${base}/scheduled-test-and-tag/schedules`, label: 'Schedules' },
		{ href: `${base}/scheduled-test-and-tag/companies`, label: 'Companies' }
	];

	$: brochuresLinks = [
		{ href: `${base}/brochures/preventative_maintenance`, label: 'Preventative Maintenance' },
		{ href: `${base}/brochures/washroom_fitout`, label: 'Washroom Fitout' }
	];
</script>

{#if !isLandingPage}
	<!-- Mobile Top Bar with Rapid Clean Theme -->
	<div class="sticky top-0 z-50 w-full border-b border-[#262a30] bg-[#141619] shadow-lg lg:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-2.5">
				<img
					src="{base}/company_logo_white.webp"
					alt="Rapid Clean Illawarra"
					class="h-7 w-auto object-contain"
				/>
				<span class="rounded bg-lime-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-lime-400">TOOLS</span>
			</div>
			<button
				type="button"
				on:click={toggleSidebar}
				class="rounded-lg p-2 text-gray-300 transition hover:bg-[#20242a] hover:text-lime-400 focus:outline-none"
				aria-label="Toggle sidebar"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Mobile Overlay -->
	{#if sidebarOpen}
		<div
			class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
			on:click={closeSidebar}
			on:keydown={(e) => e.key === 'Escape' && closeSidebar()}
			role="button"
			tabindex="-1"
			transition:fade={{ duration: 200 }}
			aria-label="Close sidebar"
		></div>
	{/if}

	<!-- Sidebar Container -->
	<aside
		class="fixed left-0 top-0 z-50 flex h-full flex-col border-r border-[#262a30] bg-[#141619] text-gray-200 shadow-2xl transition-all duration-300 ease-in-out"
		class:translate-x-0={sidebarOpen}
		class:-translate-x-full={!sidebarOpen}
		class:lg:translate-x-0={true}
		style={sidebarMinimized ? 'width: 80px;' : 'width: 280px;'}
	>
		<!-- 1. TOP HEADER & CONTROLS -->
		<div class="flex flex-col border-b border-[#262a30] bg-[#101214]">
			<!-- Brand Row -->
			<div
				class="flex items-center justify-between py-3.5 transition-all duration-200"
				class:px-4={!sidebarMinimized}
				class:px-3={sidebarMinimized}
			>
				{#if !sidebarMinimized}
					<div class="flex items-center gap-2">
						<img
							src="{base}/company_logo_white.webp"
							alt="Rapid Clean Illawarra"
							class="h-7 w-auto max-w-[130px] object-contain"
						/>
						<span class="rounded bg-lime-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-lime-400 border border-lime-500/30">
							TOOLS
						</span>
					</div>
				{:else}
					<div class="mx-auto flex flex-col items-center">
						<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#262a30] to-[#1a1d22] border border-[#333842] shadow-inner">
							<span class="text-sm font-extrabold tracking-wider text-lime-400">RC</span>
						</div>
					</div>
				{/if}

				<!-- Desktop Toggle Actions -->
				<div class="flex items-center gap-1">
					<button
						type="button"
						on:click={toggleSidebarSize}
						class="hidden rounded-lg p-1.5 text-gray-400 transition hover:bg-[#20242a] hover:text-lime-400 focus:outline-none lg:block"
						aria-label={sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
						title={sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if sidebarMinimized}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
							{/if}
						</svg>
					</button>

					<!-- Mobile Close Button -->
					<button
						type="button"
						on:click={closeSidebar}
						class="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#20242a] hover:text-lime-400 focus:outline-none lg:hidden"
						aria-label="Close sidebar"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Remember Minimize Setting (Placed at the Top) -->
			{#if !sidebarMinimized}
				<div class="flex items-center justify-between border-t border-[#1f2329] bg-[#0d0e10] px-4 py-2 text-xs">
					<span class="flex items-center gap-1.5 font-medium text-gray-400">
						<svg class="h-3.5 w-3.5 {rememberSidebarMinimized ? 'text-lime-400' : 'text-gray-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
						</svg>
						Remember minimize
					</span>
					<button
						type="button"
						role="switch"
						aria-checked={rememberSidebarMinimized}
						on:click={toggleRememberSidebar}
						class="relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {rememberSidebarMinimized ? 'bg-lime-500' : 'bg-gray-700'}"
						title="Remember minimized sidebar state across sessions"
					>
						<span class="sr-only">Remember minimize</span>
						<span
							aria-hidden="true"
							class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-gray-950 shadow ring-0 transition duration-200 ease-in-out {rememberSidebarMinimized ? 'translate-x-4' : 'translate-x-0'}"
						></span>
					</button>
				</div>
			{:else}
				<div class="flex items-center justify-center border-t border-[#1f2329] bg-[#0d0e10] py-1.5">
					<button
						type="button"
						on:click={toggleRememberSidebar}
						class="rounded p-1 text-gray-400 transition hover:bg-[#20242a] focus:outline-none {rememberSidebarMinimized ? 'text-lime-400' : 'text-gray-600'}"
						title={rememberSidebarMinimized ? 'Remember minimize: ON' : 'Remember minimize: OFF'}
						on:mouseenter={(e) => showTooltip(e, rememberSidebarMinimized ? 'Remember: ON' : 'Remember: OFF')}
						on:mouseleave={hideTooltip}
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
						</svg>
					</button>
				</div>
			{/if}
		</div>

		<!-- 2. NAVIGATION LINKS (SCROLLABLE) -->
		<nav
			class="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-thumb-[#262a30] hover:scrollbar-thumb-lime-500/40"
			class:px-3={!sidebarMinimized}
			class:px-2={sidebarMinimized}
		>
			<!-- Home -->
			<a
				href="{base}/"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/', true) ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'Home')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">Home</span>
				{/if}
			</a>

			<!-- Price Lists -->
			<a
				href="{base}/price-lists"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/price-lists') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'Price Lists')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5h12M9 12h12M9 19h12M5 5h.01M5 12h.01M5 19h.01" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">Price Lists</span>
				{/if}
			</a>

			<!-- Assets Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Assets', assetsLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/assets') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (assetsOpen = !assetsOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h5l2-2h5l2 2h5v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Assets</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={assetsOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if assetsOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each assetsLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Products Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Products', productsLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/product-') || isPathActive(base + '/update-product-pricing') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (productsOpen = !productsOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Products</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={productsOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if productsOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each productsLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Orders Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Orders', ordersLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/customer-group-invoices') || isPathActive(base + '/orders-past-due-accounts') || isPathActive(base + '/product-order-management') || isPathActive(base + '/sent-invoice-logs') || isPathActive(base + '/batch-payments') || isPathActive(base + '/generate-invoice-pdf') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (ordersOpen = !ordersOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Orders</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={ordersOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if ordersOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each ordersLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Customers -->
			<a
				href="{base}/customers"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/customers') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'Customers')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">Customers</span>
				{/if}
			</a>

			<!-- Shipping Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Shipping', shippingLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/shipping-zones') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (shippingOpen = !shippingOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Shipping</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={shippingOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if shippingOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each shippingLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- New Promax -->
			<a
				href="{base}/promax"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/promax', true) ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'New Promax')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">New Promax</span>
				{/if}
			</a>

			<!-- Pro Max Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Pro Max', proMaxLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/promax-template') || isPathActive(base + '/promax-settings') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (proMaxOpen = !proMaxOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Pro Max</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={proMaxOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if proMaxOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each proMaxLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Workshop Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Workshop', workshopLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/workshop') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (workshopOpen = !workshopOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Workshop</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={workshopOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if workshopOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each workshopLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- STT Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'STT', sttLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/scheduled-test-and-tag') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (sttOpen = !sttOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">STT</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={sttOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if sttOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each sttLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Brochures Dropdown / Flyout -->
			<div
				class="relative"
				role="none"
				on:mouseenter={(e) => openFlyout(e, 'Brochures', brochuresLinks)}
				on:mouseleave={scheduleCloseFlyout}
			>
				<button
					type="button"
					class="group flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/brochures') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
					class:px-3={!sidebarMinimized}
					class:px-2={sidebarMinimized}
					class:justify-center={sidebarMinimized}
					on:click={() => !sidebarMinimized && (brochuresOpen = !brochuresOpen)}
				>
					<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
					{#if !sidebarMinimized}
						<span class="flex-1 truncate text-left">Brochures</span>
						<svg class="h-4 w-4 transform text-gray-400 transition-transform duration-200" class:rotate-180={brochuresOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				{#if brochuresOpen && !sidebarMinimized}
					<div class="my-1 space-y-1 rounded-lg bg-[#0e1012]/70 py-1 pl-3 border-l-2 border-lime-500/30 ml-3" transition:slide={{ duration: 180 }}>
						{#each brochuresLinks as link}
							<a
								href={link.href}
								class="block rounded-md px-3 py-1.5 text-xs font-medium transition-colors {isPathActive(link.href) ? 'text-lime-400 font-semibold bg-lime-500/10' : 'text-gray-400 hover:bg-[#1e2228] hover:text-lime-300'}"
								on:click={closeSidebar}>{link.label}</a
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Email Sender -->
			<a
				href="{base}/email-sender"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/email-sender') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'Email Sender')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">Email Sender</span>
				{/if}
			</a>

			<!-- Credentials Vault -->
			<a
				href="{base}/credentials-vault"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/credentials-vault') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'Credentials Vault')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">Credentials Vault</span>
				{/if}
			</a>

			<!-- Tickets -->
			<a
				href="{base}/tickets"
				class="group flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-150 {isPathActive(base + '/tickets') ? 'bg-lime-500/10 text-lime-400 font-semibold border-l-[3px] border-lime-400 shadow-sm' : 'text-gray-300 hover:bg-[#1f2329] hover:text-lime-300'}"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
				class:justify-center={sidebarMinimized}
				on:click={closeSidebar}
				on:mouseenter={(e) => showTooltip(e, 'Tickets')}
				on:mouseleave={hideTooltip}
			>
				<svg class="h-5 w-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				{#if !sidebarMinimized}
					<span class="truncate">Tickets</span>
				{/if}
			</a>
		</nav>

		<!-- 3. USER PROFILE (BOTTOM) -->
		{#if user}
			<div
				class="border-t border-[#262a30] bg-[#101214] py-3"
				class:px-3={!sidebarMinimized}
				class:px-2={sidebarMinimized}
			>
				{#if !sidebarMinimized}
					<div class="user-dropdown">
						<button
							type="button"
							class="group flex w-full items-center gap-3 rounded-xl p-2 text-sm font-medium text-white transition hover:bg-[#1f2329] focus:outline-none"
							on:click={() => (userDropdownOpen = !userDropdownOpen)}
						>
							<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-lime-600 font-bold text-gray-950 shadow-md">
								{#if profile?.firstName}
									{profile.firstName[0].toUpperCase()}
								{:else if user.email}
									{user.email[0].toUpperCase()}
								{:else}
									U
								{/if}
							</div>
							<div class="flex flex-1 flex-col text-left overflow-hidden">
								<span class="truncate font-semibold text-white group-hover:text-lime-300">
									{#if profile}
										{profile.firstName} {profile.lastName}
									{:else}
										{user.email?.split('@')[0] || 'User'}
									{/if}
								</span>
								<span class="truncate text-[11px] text-gray-400">
									{user.email || ''}
								</span>
							</div>
							<svg
								class="h-4 w-4 flex-shrink-0 text-gray-400 transform transition-transform duration-200"
								class:rotate-180={userDropdownOpen}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						{#if userDropdownOpen}
							<div class="mt-2 space-y-1 rounded-xl bg-[#0a0b0d] p-1.5 border border-[#262a30]" transition:slide={{ duration: 180 }}>
								<a
									href="{base}/edit-profile"
									class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-[#1f2329] hover:text-lime-400"
									on:click={closeSidebar}
								>
									<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
									Edit Profile
								</a>
								<button
									type="button"
									on:click={handleSignOut}
									class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
								>
									<svg class="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
									</svg>
									Sign Out
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Minimized User Avatar -->
					<div
						class="flex justify-center"
						role="none"
						on:mouseenter={openUserFlyout}
						on:mouseleave={scheduleCloseFlyout}
					>
						<button
							type="button"
							class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400 to-lime-600 font-bold text-gray-950 shadow-md transition hover:scale-105"
							aria-label="User profile"
						>
							{#if profile?.firstName}
								{profile.firstName[0].toUpperCase()}
							{:else if user.email}
								{user.email[0].toUpperCase()}
							{:else}
								U
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</aside>

	<!-- 4. FLOATING FLYOUT MENU (FOR MINIMIZED SIDEBAR) -->
	{#if sidebarMinimized && activeFlyout}
		<div
			class="fixed z-[9999] min-w-[210px] max-w-[260px] rounded-xl border border-[#2d3239] bg-[#141619] p-1.5 shadow-2xl backdrop-blur-xl"
			style="top: {flyoutTop}px; left: 86px;"
			role="region"
			aria-label="Sidebar Submenu"
			on:mouseenter={cancelCloseFlyout}
			on:mouseleave={scheduleCloseFlyout}
			transition:fade={{ duration: 120 }}
		>
			{#if activeFlyout === 'user_profile'}
				<div class="border-b border-[#262a30] px-3 py-2">
					<p class="truncate text-xs font-bold text-white">
						{#if profile}
							{profile.firstName} {profile.lastName}
						{:else}
							{user?.email?.split('@')[0] || 'User'}
						{/if}
					</p>
					<p class="truncate text-[10px] text-gray-400">{user?.email || ''}</p>
				</div>
				<div class="mt-1 space-y-0.5">
					<a
						href="{base}/edit-profile"
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-[#20242a] hover:text-lime-300"
						on:click={closeSidebar}
					>
						<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
						Edit Profile
					</a>
					<button
						type="button"
						on:click={handleSignOut}
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
					>
						<svg class="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						Sign Out
					</button>
				</div>
			{:else}
				<!-- Flyout Submenu Header -->
				<div class="flex items-center justify-between border-b border-[#262a30] px-3 py-2">
					<span class="text-xs font-extrabold tracking-wider uppercase text-lime-400">{flyoutTitle}</span>
				</div>
				<!-- Flyout Links -->
				<div class="mt-1 space-y-0.5 max-h-[380px] overflow-y-auto scrollbar-thin">
					{#each flyoutItems as item}
						<a
							href={item.href}
							class="block rounded-lg px-3 py-2 text-xs font-medium transition-colors {isPathActive(item.href) ? 'bg-lime-500/15 text-lime-400 font-semibold border-l-2 border-lime-400' : 'text-gray-300 hover:bg-[#20242a] hover:text-lime-300'}"
							on:click={closeSidebar}
						>
							{item.label}
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- 5. STANDALONE TOOLTIP (FOR MINIMIZED SIDEBAR) -->
	{#if sidebarMinimized && tooltipVisible && !activeFlyout}
		<div
			class="pointer-events-none fixed z-[9999] rounded-lg border border-[#2d3239] bg-[#141619] px-2.5 py-1 text-xs font-medium text-white shadow-xl backdrop-blur-md"
			style="top: {tooltipTop}px; left: 86px;"
			transition:fade={{ duration: 80 }}
		>
			{tooltipText}
		</div>
	{/if}
{/if}
