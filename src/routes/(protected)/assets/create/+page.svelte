<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { currentUser, isLoadingAuth } from '$lib/firebase';
	import { supabase } from '$lib/supabase';
	import { userProfile, type UserProfile, fetchUserProfile } from '$lib/userProfile';
	import type { User } from 'firebase/auth';
	import AssetFilesSection from '$lib/assets/AssetFilesSection.svelte';
	import { uploadFilesForAsset, revokeStagedPreviews } from '$lib/assets/assetStorage';

	let currentAuthUser: User | null = null;
	let currentIsLoadingAuth = true;
	let currentProfile: UserProfile | null = null;
	let isLoadingProfile = false;
	let isSubmitting = false;
	let isResolvingAssetNumber = false;
	let formError: string | null = null;
	let assetNumberLoadError: string | null = null;
	let formSuccess = false;

	// Editable asset fields (asset_number is set from next sequence; see loadNextAssetNumber)
	let asset_number = '';
	let asset_name = '';
	let model = '';
	let serial_number = '';
	let test_date = '';
	let test_due_date = '';
	let purchase_date = '';

	/** @type {{ key: string; file: File; preview: string }[]} */
	let stagedFiles = [];

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
			void loadNextAssetNumber();
			applyDefaultDates();
		} else {
			asset_number = '';
			assetNumberLoadError = null;
			test_date = '';
			test_due_date = '';
			purchase_date = '';
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

	/** `YYYY-MM-DD` in local time, for `<input type="date">` */
	function toDateInputValue(d: Date) {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	/** Test & purchase: today; test due: one calendar year from today. */
	function applyDefaultDates() {
		const today = new Date();
		const due = new Date(today);
		due.setFullYear(today.getFullYear() + 1);
		test_date = toDateInputValue(today);
		purchase_date = toDateInputValue(today);
		test_due_date = toDateInputValue(due);
	}

	const ASSET_NUMBER_PREFIX = 'RCI-';
	/** e.g. RCI-0001 — widens after 9999. */
	const ASSET_NUMBER_NUMERIC_PAD = 4;

	function formatAssetNumberFromIndex(oneBasedIndex: number) {
		return `${ASSET_NUMBER_PREFIX}${String(oneBasedIndex).padStart(ASSET_NUMBER_NUMERIC_PAD, '0')}`;
	}

	/** Next asset number: RCI-0001, RCI-0002, … from (row count) + 1. */
	async function loadNextAssetNumber() {
		isResolvingAssetNumber = true;
		assetNumberLoadError = null;
		try {
			const { count, error } = await supabase
				.from('assets')
				.select('*', { count: 'exact', head: true });
			if (error) {
				throw error;
			}
			asset_number = formatAssetNumberFromIndex((count ?? 0) + 1);
		} catch (e) {
			console.error(e);
			asset_number = '';
			assetNumberLoadError =
				e instanceof Error ? e.message : 'Could not load the next asset number.';
		} finally {
			isResolvingAssetNumber = false;
		}
	}

	async function handleSubmit() {
		formError = null;
		formSuccess = false;
		if (!currentAuthUser) {
			formError = 'You must be signed in to create an asset.';
			return;
		}
		if (assetNumberLoadError) {
			formError = 'Fix the asset number error before saving.';
			return;
		}
		if (!asset_number.trim() || !asset_name.trim()) {
			formError = 'Asset name is required, and a valid asset number must be loaded.';
			return;
		}
		const audit = getAuditFromSession();
		if (!audit) {
			formError = 'You must be signed in to create an asset.';
			return;
		}
		isSubmitting = true;
		try {
			const { data: created, error } = await supabase
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
			if (!created?.id) {
				throw new Error('No asset id returned from create.');
			}
			formSuccess = true;
			if (stagedFiles.length) {
				const { error: uploadError } = await uploadFilesForAsset(
					created.id,
					stagedFiles.map((s) => s.file)
				);
				if (uploadError) {
					formError =
						'Asset was created, but one or more file uploads failed: ' +
						uploadError +
						' You can add them from the edit page.';
				}
			}
			revokeStagedPreviews(stagedFiles);
			stagedFiles = [];
			await loadNextAssetNumber();
			applyDefaultDates();
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

	{#if currentIsLoadingAuth || isLoadingProfile || (currentAuthUser && isResolvingAssetNumber)}
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
							>Asset number</label
						>
						<p class="mb-1 text-xs text-gray-500">
							Assigned automatically in order (e.g. RCI-0001, RCI-0002), based on how many assets
							already exist.
						</p>
						{#if assetNumberLoadError}
							<p class="mb-1 text-sm text-red-600" role="alert">{assetNumberLoadError}</p>
						{/if}
						<input
							id="asset_number"
							bind:value={asset_number}
							type="text"
							readonly
							required
							class="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800"
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

			<AssetFilesSection
				staged={stagedFiles}
				existing={[]}
				disabled={isSubmitting}
				on:change={(e) => (stagedFiles = e.detail.staged)}
			/>

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
					disabled={isSubmitting || !!assetNumberLoadError || !asset_number.trim()}
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
