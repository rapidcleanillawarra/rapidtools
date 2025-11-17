<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { currentUser, isLoadingAuth } from '$lib/firebase';
	import Header from '$lib/Header.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	// Initialize auth state
	let mounted = false;
	let user: any = null;
	let loading = true;
	let sidebarMinimized = false;
	let isDesktop = true; // Track if we're on desktop screen

	// Subscribe to auth state
	const unsubAuth = currentUser.subscribe(value => {
		user = value;
	});

	const unsubLoading = isLoadingAuth.subscribe(value => {
		loading = value;
	});

	// Check if we're on a print page
	$: isPrintPage = $page.url.pathname.includes('/print');

	// Check if we're on a protected route
	$: isProtectedRoute = $page.url.pathname.startsWith(base + '/product-request') ||
						 $page.url.pathname.startsWith(base + '/dashboard') ||
						 $page.url.pathname.startsWith(base + '/edit-profile') ||
						 $page.url.pathname.startsWith(base + '/apply-payments') ||
						 $page.url.pathname.startsWith(base + '/customer-group-invoices') ||
						 $page.url.pathname.startsWith(base + '/customer-groups') ||
						 $page.url.pathname.startsWith(base + '/batch-payments') ||
						 $page.url.pathname.startsWith(base + '/gross-profit-calculator') ||
						 $page.url.pathname.startsWith(base + '/shipping-zones');

	$: if (mounted && browser && !loading && !user && isProtectedRoute) {
		goto(base + '/');
	}

	// Calculate sidebar width - only apply on desktop and not on print pages
	$: sidebarWidth = isPrintPage ? '0' : (isDesktop ? (sidebarMinimized ? '80px' : '280px') : '0');

	onMount(() => {
		mounted = true;

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
			unsubAuth();
			unsubLoading();
			window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
		};
	});
</script>

{#if mounted || !browser}
	{#if !isPrintPage}
		<Header />
	{/if}
	<main class="transition-all duration-300" style:margin-left={sidebarWidth}>
		<slot />
	</main>
	<ToastContainer />
{/if}
