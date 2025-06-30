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

	// Subscribe to auth state
	const unsubAuth = currentUser.subscribe(value => {
		user = value;
	});

	const unsubLoading = isLoadingAuth.subscribe(value => {
		loading = value;
	});

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

	onMount(() => {
		mounted = true;
		return () => {
			unsubAuth();
			unsubLoading();
		};
	});
</script>

{#if mounted || !browser}
	<Header />
	<slot />
	<ToastContainer />
{/if}
