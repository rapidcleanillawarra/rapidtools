<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { currentUser, isLoadingAuth } from '$lib/firebase';
	import { supabase } from '$lib/supabase';
	import { userProfile, type UserProfile, fetchUserProfile } from '$lib/userProfile';
	import type { User } from 'firebase/auth';

	let currentAuthUser: User | null = null;
	let currentIsLoadingAuth = true;
	let currentProfile: UserProfile | null = null;
	let isLoadingProfile = false;
	let isSubmitting = false;
	let formError: string | null = null;
	let formSuccess = false;

	// Editable asset fields
	let asset_number = '';
	let asset_name = '';
	let model = '';
	let serial_number = '';
	let test_date = '';
	let test_due_date = '';
	let purchase_date = '';

	/** Name and email for audit columns — same source for UI hint and insert. */
	function resolveActingIdentity(): {
		display: string;
		name: string | null;
		email: string | null;
	} | null {
		if (!currentAuthUser) return null;
		const name =
			currentProfile && (currentProfile.firstName || currentProfile.lastName)
				? `${currentProfile.firstName} ${currentProfile.lastName}`.trim()
				: (currentAuthUser.displayName || '').trim() || (currentAuthUser.email ?? '').split('@')[0] || '';
		const display = name || currentAuthUser.uid;
		return {
			display,
			name: name || null,
			email: currentAuthUser.email?.trim() || null
		};
	}

	function getAuditFromSession() {
		const who = resolveActingIdentity();
		if (!who) return null;
		return {
			created_by: who.display,
			created_by_email: who.email,
			updated_by: who.display,
			updated_by_email: who.email,
			created_by_name: who.name,
			updated_by_name: who.name
		};
	}

	function creatingAsText() {
		const who = resolveActingIdentity();
		if (!who) return '';
		if (who.email && who.name) return `${who.name} (${who.email})`;
		return who.email || who.name || who.display;
	}

	const unsubCurrentUser = currentUser.subscribe((value) => {
		currentAuthUser = value;
		if (browser && !currentIsLoadingAuth && !currentAuthUser) {
			goto(base + '/', { replaceState: true });
		}
		if (value) {
			void loadUserProfile(value.uid);
		}
	});

	const unsubIsLoadingAuth = isLoadingAuth.subscribe((value) => {
		currentIsLoadingAuth = value;
		if (browser && !value && !currentAuthUser) {
			goto(base + '/', { replaceState: true });
		}
	});

	const unsubUserProfile = userProfile.subscribe((value) => {
		currentProfile = value;
	});

	async function loadUserProfile(uid: string) {
		isLoadingProfile = true;
		try {
			await fetchUserProfile(uid);
		} catch (e) {
			console.error('Error loading user profile:', e);
		} finally {
			isLoadingProfile = false;
		}
	}

	function toNullDate(v: string): string | null {
		const t = v?.trim();
		return t ? t : null;
	}

	async function handleSubmit() {
		formError = null;
		formSuccess = false;
		if (!currentAuthUser) {
			formError = 'You must be signed in to create an asset.';
			return;
		}
		if (!asset_number.trim() || !asset_name.trim()) {
			formError = 'Asset number and asset name are required.';
			return;
		}
		const audit = getAuditFromSession();
		if (!audit) {
			formError = 'You must be signed in to create an asset.';
			return;
		}
		isSubmitting = true;
		try {
			const { error } = await supabase
				.from('assets')
				.insert({
					asset_number: asset_number.trim(),
					asset_name: asset_name.trim(),
					model: model.trim() || null,
					serial_number: serial_number.trim() || null,
					test_date: toNullDate(test_date),
					test_due_date: toNullDate(test_due_date),
					purchase_date: toNullDate(purchase_date),
					...audit,
					deleted_by: null,
					deleted_by_email: null,
					deleted_by_name: null
				})
				.select('id')
				.single();

			if (error) {
				throw error;
			}
			formSuccess = true;
		} catch (e) {
			console.error(e);
			formError = e instanceof Error ? e.message : 'Failed to save asset.';
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		if (browser && !currentIsLoadingAuth && !currentAuthUser) {
			goto(base + '/', { replaceState: true });
		}
		return () => {
			unsubCurrentUser();
			unsubIsLoadingAuth();
			unsubUserProfile();
		};
	});
</script>

<svelte:head>
	<title>Create asset - RapidTools</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<nav class="mb-6 text-sm text-gray-500">
		<a href="{base}/assets" class="text-blue-600 hover:underline">Assets</a>
		<span class="mx-2">/</span>
		<span class="text-gray-700">Create</span>
	</nav>

	<h1 class="mb-6 text-2xl font-bold text-gray-900">Create asset</h1>

	{#if currentIsLoadingAuth || isLoadingProfile}
		<p class="text-gray-600">Loading…</p>
	{:else if !currentAuthUser}
		<p class="text-gray-600">Sign in to continue.</p>
	{:else}
		<form class="space-y-8" on:submit|preventDefault={handleSubmit}>
			<section>
				<h2 class="mb-4 text-lg font-semibold text-gray-800">Asset details</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="asset_number" class="mb-1 block text-sm font-medium text-gray-700"
							>Asset number *</label
						>
						<input
							id="asset_number"
							bind:value={asset_number}
							type="text"
							required
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="asset_name" class="mb-1 block text-sm font-medium text-gray-700"
							>Asset name *</label
						>
						<input
							id="asset_name"
							bind:value={asset_name}
							type="text"
							required
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="model" class="mb-1 block text-sm font-medium text-gray-700">Model</label>
						<input
							id="model"
							bind:value={model}
							type="text"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="serial_number" class="mb-1 block text-sm font-medium text-gray-700"
							>Serial number</label
						>
						<input
							id="serial_number"
							bind:value={serial_number}
							type="text"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="test_date" class="mb-1 block text-sm font-medium text-gray-700"
							>Test date</label
						>
						<input
							id="test_date"
							bind:value={test_date}
							type="date"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="test_due_date" class="mb-1 block text-sm font-medium text-gray-700"
							>Test due date</label
						>
						<input
							id="test_due_date"
							bind:value={test_due_date}
							type="date"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="purchase_date" class="mb-1 block text-sm font-medium text-gray-700"
							>Purchase date</label
						>
						<input
							id="purchase_date"
							bind:value={purchase_date}
							type="date"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
			</section>

			<p class="text-sm text-gray-600">
				<span class="font-medium text-gray-700">Created / updated by</span> is set automatically from
				your account: <span class="text-gray-900">{(currentAuthUser && creatingAsText()) || '—'}</span>
			</p>

			{#if formError}
				<p class="text-sm text-red-600" role="alert">{formError}</p>
			{/if}
			{#if formSuccess}
				<p class="text-sm text-green-700" role="status">Asset saved.</p>
			{/if}

			<div class="flex flex-wrap gap-3">
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isSubmitting ? 'Saving…' : 'Create asset'}
				</button>
				<a
					href="{base}/assets"
					class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50"
				>
					Cancel
				</a>
			</div>
		</form>
	{/if}
</div>
