<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentUser, isLoadingAuth } from '$lib/firebase';
	import { supabase } from '$lib/supabase';
	import { userProfile, type UserProfile, fetchUserProfile } from '$lib/userProfile';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import type { User } from 'firebase/auth';
	import AssetFilesSection from '$lib/assets/AssetFilesSection.svelte';
	import {
		listAssetFileRows,
		uploadFilesForAsset,
		deleteAssetFile,
		revokeStagedPreviews,
		type AssetFileRow
	} from '$lib/assets/assetStorage';

	let currentAuthUser = $state<User | null>(null);
	let currentIsLoadingAuth = $state(true);
	let currentProfile = $state<UserProfile | null>(null);
	let isLoadingProfile = false;
	let isSubmitting = $state(false);
	let isLoadingRow = $state(true);
	let loadError = $state<string | null>(null);
	let formError = $state<string | null>(null);

	let asset_number = $state('');
	let asset_name = $state('');
	let model = $state('');
	let serial_number = $state('');
	let area = $state('');
	let test_date = $state('');
	let test_due_date = $state('');
	let purchase_date = $state('');

	let existingFiles = $state<AssetFileRow[]>([]);
	let stagedFiles = $state<{ key: string; file: File; preview: string }[]>([]);

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

	function getUpdateAudit() {
		const who = resolveActingIdentity();
		if (!who) return null;
		return {
			updated_by: who.display,
			updated_by_email: who.email,
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

	function toDateInputValue(s: string | null) {
		if (!s) return '';
		if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
			return s.slice(0, 10);
		}
		try {
			const d = new Date(s);
			if (Number.isNaN(d.getTime())) return '';
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${y}-${m}-${day}`;
		} catch {
			return '';
		}
	}

	/** Bumps when a new load starts so a stale in-flight request won’t clobber state. */
	let loadSeq = 0;

	async function loadRowForId(id: string) {
		const seq = ++loadSeq;
		revokeStagedPreviews(stagedFiles);
		stagedFiles = [];
		isLoadingRow = true;
		loadError = null;
		try {
			const { data, error: qe } = await supabase
				.from('assets')
				.select(
					'asset_number, asset_name, model, serial_number, area, test_date, test_due_date, purchase_date'
				)
				.eq('id', id)
				.is('deleted_at', null)
				.maybeSingle();

			if (seq !== loadSeq) {
				return;
			}
			if (qe) {
				loadError = qe.message;
				existingFiles = [];
				return;
			}
			if (!data) {
				loadError = 'Asset not found.';
				existingFiles = [];
				return;
			}
			const row = data as {
				asset_number: string | null;
				asset_name: string | null;
				model: string | null;
				serial_number: string | null;
				area: string | null;
				test_date: string | null;
				test_due_date: string | null;
				purchase_date: string | null;
			};
			asset_number = row.asset_number ?? '';
			asset_name = row.asset_name ?? '';
			model = row.model ?? '';
			serial_number = row.serial_number ?? '';
			area = row.area ?? '';
			test_date = toDateInputValue(row.test_date);
			test_due_date = toDateInputValue(row.test_due_date);
			purchase_date = toDateInputValue(row.purchase_date);

			const { data: fileRows, error: fe } = await listAssetFileRows(supabase, id);
			if (seq !== loadSeq) {
				return;
			}
			if (fe) {
				console.error('asset_files load:', fe);
				existingFiles = [];
			} else {
				existingFiles = fileRows;
			}
		} catch (e) {
			if (seq !== loadSeq) {
				return;
			}
			loadError = e instanceof Error ? e.message : 'Failed to load asset.';
			existingFiles = [];
		} finally {
			if (seq === loadSeq) {
				isLoadingRow = false;
			}
		}
	}

	async function handleDeleteAssetFile(row: AssetFileRow) {
		const { error } = await deleteAssetFile(row);
		if (error) {
			toastError(error);
			return;
		}
		existingFiles = existingFiles.filter((r) => r.id !== row.id);
		toastSuccess('File removed.');
	}

	async function handleSubmit() {
		formError = null;
		const id = $page.params.id;
		if (!id) {
			formError = 'Missing asset id.';
			return;
		}
		if (!currentAuthUser) {
			formError = 'You must be signed in to save.';
			return;
		}
		if (!asset_name.trim()) {
			formError = 'Asset name is required.';
			return;
		}
		const audit = getUpdateAudit();
		if (!audit) {
			formError = 'You must be signed in to save.';
			return;
		}
		isSubmitting = true;
		try {
			const { error: upError } = await supabase
				.from('assets')
				.update({
					asset_name: asset_name.trim(),
					model: model.trim() || null,
					serial_number: serial_number.trim() || null,
					area: area.trim() || null,
					test_date: toNullDate(test_date),
					test_due_date: toNullDate(test_due_date),
					purchase_date: toNullDate(purchase_date),
					...audit
				})
				.eq('id', id)
				.is('deleted_at', null);

			if (upError) {
				throw upError;
			}

			if (stagedFiles.length) {
				const { error: uploadErr } = await uploadFilesForAsset(
					id,
					stagedFiles.map((s) => s.file)
				);
				if (uploadErr) {
					throw new Error(uploadErr);
				}
				revokeStagedPreviews(stagedFiles);
				stagedFiles = [];
				const { data: refreshed, error: refErr } = await listAssetFileRows(supabase, id);
				if (!refErr) {
					existingFiles = refreshed;
				}
			}

			toastSuccess('Asset updated.');
		} catch (e) {
			console.error(e);
			const msg = e instanceof Error ? e.message : 'Failed to save changes.';
			formError = msg;
			toastError(msg);
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => {
		if (browser && !get(isLoadingAuth) && !get(currentUser)) {
			goto(base + '/', { replaceState: true });
		}

		let unsubPage: (() => void) | undefined;
		if (browser) {
			const run = (id: string | undefined) => {
				if (!id) {
					isLoadingRow = false;
					loadError = 'Missing asset id';
					return;
				}
				void loadRowForId(id);
			};
			unsubPage = page.subscribe((p) => {
				run(p.params.id);
			});
		}

		return () => {
			unsubPage?.();
			unsubCurrentUser();
			unsubIsLoadingAuth();
			unsubUserProfile();
		};
	});
</script>

<svelte:head>
	<title>Edit asset - RapidTools</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<nav class="mb-6 text-sm text-gray-500">
		<a href="{base}/assets" class="text-blue-600 hover:underline">Assets</a>
		<span class="mx-2">/</span>
		<span class="text-gray-700">Edit</span>
	</nav>

	<h1 class="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Edit asset</h1>

	{#if currentIsLoadingAuth}
		<p class="text-gray-600 dark:text-gray-300">Loading…</p>
	{:else if !currentAuthUser}
		<p class="text-gray-600 dark:text-gray-300">Sign in to continue.</p>
	{:else if isLoadingRow}
		<p class="text-gray-600 dark:text-gray-300">Loading…</p>
	{:else if loadError}
		<p class="text-red-600" role="alert">{loadError}</p>
		<a
			href="{base}/assets"
			class="mt-4 inline-flex text-blue-600 hover:underline dark:text-blue-400"
			>Back to assets</a
		>
	{:else}
		<form class="space-y-8" on:submit|preventDefault={handleSubmit}>
			<section>
				<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Asset details</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="asset_number" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Asset number</label
						>
						<p class="mb-1 text-xs text-gray-500">Fixed after creation.</p>
						<input
							id="asset_number"
							value={asset_number}
							readonly
							type="text"
							class="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-200"
						/>
					</div>
					<div>
						<label for="asset_name" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Asset name *</label
						>
						<input
							id="asset_name"
							bind:value={asset_name}
							type="text"
							required
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="model" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Model</label
						>
						<input
							id="model"
							bind:value={model}
							type="text"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="serial_number" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Serial number</label
						>
						<input
							id="serial_number"
							bind:value={serial_number}
							type="text"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="area" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Area</label
						>
						<input
							id="area"
							bind:value={area}
							type="text"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="test_date" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Test date</label
						>
						<input
							id="test_date"
							bind:value={test_date}
							type="date"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="test_due_date" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Test due date</label
						>
						<input
							id="test_due_date"
							bind:value={test_due_date}
							type="date"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="purchase_date" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Purchase date</label
						>
						<input
							id="purchase_date"
							bind:value={purchase_date}
							type="date"
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						/>
					</div>
				</div>
			</section>

			<AssetFilesSection
				staged={stagedFiles}
				existing={existingFiles}
				disabled={isSubmitting}
				onDeleteExisting={handleDeleteAssetFile}
				on:change={(e) => (stagedFiles = e.detail.staged)}
			/>

			<p class="text-sm text-gray-600 dark:text-gray-300">
				<span class="font-medium text-gray-700 dark:text-gray-200">Updated by</span> is set from your
				account: <span class="text-gray-900 dark:text-gray-100"
					>{(currentAuthUser && creatingAsText()) || '—'}</span
				>
			</p>

			{#if formError}
				<p class="text-sm text-red-600" role="alert">{formError}</p>
			{/if}

			<div class="flex flex-wrap gap-3">
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isSubmitting ? 'Saving…' : 'Save changes'}
				</button>
				<a
					href="{base}/assets"
					class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
				>
					Cancel
				</a>
			</div>
		</form>
	{/if}
</div>
