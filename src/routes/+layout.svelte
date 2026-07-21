<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Header from '$lib/Header.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	let sidebarMinimized = false;
	let isDesktop = true; // Track if we're on desktop screen

	// Print flows: paths containing `/print`, or asset tag sheet (no app chrome)
	$: isPrintPage =
		$page.url.pathname.includes('/print') || $page.url.pathname.includes('/assets/print-tags');

	// Promax page: no header/sidebar, standalone content
	$: isPromaxPage = $page.url.pathname === base + '/promax' || $page.url.pathname.startsWith(base + '/promax/');

	// Workshop deliveries: mobile tracker, no header/sidebar
	$: isDeliveriesPage =
		$page.url.pathname === base + '/workshop/deliveries' ||
		$page.url.pathname.startsWith(base + '/workshop/deliveries/');

	// Login / landing: full-bleed, no sidebar offset
	$: isLoginPage = $page.url.pathname === base + '/' || $page.url.pathname === base;

	$: hideAppChrome = isPrintPage || isPromaxPage || isDeliveriesPage || isLoginPage;

	// Calculate sidebar width - only apply on desktop, not on chrome-hidden pages
	$: sidebarWidth = hideAppChrome ? '0' : (isDesktop ? (sidebarMinimized ? '80px' : '280px') : '0');

	onMount(() => {
		// Load initial sidebar state
		if (browser && localStorage.getItem('sidebarMinimized') === 'true') {
			sidebarMinimized = true;
		}

		// Check initial screen size
		if (browser) {
			isDesktop = window.innerWidth >= 1024;
		}

		// Listen for sidebar toggle events
		const handleSidebarToggle = (event: CustomEvent) => {
			sidebarMinimized = event.detail.minimized;
			isDesktop = event.detail.isDesktop;
		};
		
		window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);

		return () => {
			window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
		};
	});
</script>

{#if !hideAppChrome}
	<Header />
{/if}
<main class="transition-all duration-300" style:margin-left={sidebarWidth}>
	<slot />
</main>
<ToastContainer />
