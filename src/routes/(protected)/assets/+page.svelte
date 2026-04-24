<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	type AssetRow = {
		id: string;
		asset_number: string | null;
		asset_name: string | null;
		model: string | null;
		serial_number: string | null;
		test_date: string | null;
		test_due_date: string | null;
		purchase_date: string | null;
	};

	const COLUMNS = [
		{ key: 'asset_number' as const, label: 'Asset number' },
		{ key: 'asset_name' as const, label: 'Asset name' },
		{ key: 'model' as const, label: 'Model' },
		{ key: 'serial_number' as const, label: 'Serial number' },
		{ key: 'test_date' as const, label: 'Test date' },
		{ key: 'test_due_date' as const, label: 'Test due date' },
		{ key: 'purchase_date' as const, label: 'Purchase date' }
	];

	type ColumnKey = (typeof COLUMNS)[number]['key'];

	let rows = $state<AssetRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let columnFilters = $state<Record<ColumnKey, string>>({
		asset_number: '',
		asset_name: '',
		model: '',
		serial_number: '',
		test_date: '',
		test_due_date: '',
		purchase_date: ''
	});

	let sortKey = $state<ColumnKey>('asset_number');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let deletingId = $state<string | null>(null);

	function fmtDate(s: string | null) {
		if (!s) return '—';
		try {
			return new Date(`${s}T12:00:00`).toLocaleDateString();
		} catch {
			return s;
		}
	}

	function displayText(s: string | null) {
		return s?.trim() ? s : '—';
	}

	function dateSearchHaystack(row: AssetRow, k: 'test_date' | 'test_due_date' | 'purchase_date') {
		const raw = row[k]?.toLowerCase() ?? '';
		const formatted = row[k] ? fmtDate(row[k]).toLowerCase() : '';
		return `${raw} ${formatted}`;
	}

	function rowMatchesFilters(row: AssetRow): boolean {
		for (const k of COLUMNS.map((c) => c.key)) {
			const q = columnFilters[k].trim().toLowerCase();
			if (!q) continue;
			if (k === 'test_date' || k === 'test_due_date' || k === 'purchase_date') {
				if (!dateSearchHaystack(row, k).includes(q)) return false;
			} else {
				const text = (row[k] as string | null)?.toLowerCase() ?? '';
				if (!text.includes(q)) return false;
			}
		}
		return true;
	}

	function sortIndicator(key: ColumnKey) {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? ' ↑' : ' ↓';
	}

	function toggleSort(key: ColumnKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function compareRows(a: AssetRow, b: AssetRow): number {
		const dir = sortDir === 'asc' ? 1 : -1;
		if (
			sortKey === 'test_date' ||
			sortKey === 'test_due_date' ||
			sortKey === 'purchase_date'
		) {
			const ta = a[sortKey] ? new Date(`${a[sortKey]}T12:00:00`).getTime() : null;
			const tb = b[sortKey] ? new Date(`${b[sortKey]}T12:00:00`).getTime() : null;
			if (ta === null && tb === null) return 0;
			if (ta === null) return 1;
			if (tb === null) return -1;
			return (ta - tb) * dir;
		}
		const sa = (a[sortKey] ?? '').toString();
		const sb = (b[sortKey] ?? '').toString();
		return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' }) * dir;
	}

	const displayedRows = $derived.by(() => {
		const filtered = rows.filter((r) => rowMatchesFilters(r));
		return [...filtered].sort(compareRows);
	});

	function buildDeletePayload() {
		const u = get(currentUser);
		if (!u) {
			return { deleted_at: new Date().toISOString() };
		}
		const p = get(userProfile);
		const fullName =
			p && (p.firstName || p.lastName)
				? `${p.firstName} ${p.lastName}`.trim()
				: (u.displayName || '').trim() || null;
		return {
			deleted_at: new Date().toISOString(),
			deleted_by: fullName || u.email || u.uid,
			deleted_by_email: u.email ?? null,
			deleted_by_name: fullName
		};
	}

	async function deleteAsset(row: AssetRow) {
		const label = row.asset_number?.trim() || row.asset_name?.trim() || 'this asset';
		if (!confirm(`Delete ${label}? This can’t be undone from the list (record is archived).`)) {
			return;
		}
		deletingId = row.id;
		const { error: upError } = await supabase
			.from('assets')
			.update(buildDeletePayload())
			.eq('id', row.id)
			.is('deleted_at', null);
		deletingId = null;
		if (upError) {
			toastError(upError.message);
			return;
		}
		rows = rows.filter((r) => r.id !== row.id);
		toastSuccess('Asset deleted.');
	}

	onMount(() => {
		(async () => {
			loading = true;
			error = null;
			const { data, error: qError } = await supabase
				.from('assets')
				.select(
					'id, asset_number, asset_name, model, serial_number, test_date, test_due_date, purchase_date'
				)
				.is('deleted_at', null)
				.order('asset_number', { ascending: true });
			loading = false;
			if (qError) {
				error = qError.message;
				return;
			}
			rows = (data as AssetRow[]) ?? [];
		})();
	});
</script>

<svelte:head>
	<title>Assets - RapidTools</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Assets</h1>

	<div
		class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="overflow-x-auto">
			{#if loading}
				<p class="px-6 py-10 text-center text-gray-600 dark:text-gray-300">Loading…</p>
			{:else if error}
				<p class="px-6 py-10 text-center text-red-600" role="alert">{error}</p>
			{:else if rows.length === 0}
				<p class="px-6 py-10 text-center text-gray-600 dark:text-gray-300">No assets yet.</p>
			{:else}
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-700">
						<tr>
							{#each COLUMNS as col (col.key)}
								<th
									scope="col"
									class="min-w-[8rem] px-3 py-2 text-left align-top text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
								>
									<button
										type="button"
										class="w-full text-left text-xs font-medium uppercase tracking-wider text-gray-600 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
										onclick={() => toggleSort(col.key)}
									>
										{col.label}{sortIndicator(col.key)}
									</button>
									<input
										type="search"
										bind:value={columnFilters[col.key]}
										placeholder="Search…"
										aria-label="Filter {col.label}"
										class="mt-1.5 w-full min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-normal normal-case text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
										onclick={(e) => e.stopPropagation()}
									/>
								</th>
							{/each}
							<th
								scope="col"
								class="w-[1%] min-w-[9.5rem] px-3 py-2 text-left align-top text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								<span class="block">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
						{#if displayedRows.length === 0}
							<tr>
								<td
									class="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-300"
									colspan={8}
								>
									No assets match the current filters.
								</td>
							</tr>
						{:else}
							{#each displayedRows as row (row.id)}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
									<td
										class="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
									>
										{displayText(row.asset_number)}
									</td>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
										{displayText(row.asset_name)}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
										{displayText(row.model)}
									</td>
									<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
										{displayText(row.serial_number)}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
										{fmtDate(row.test_date)}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
										{fmtDate(row.test_due_date)}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
										{fmtDate(row.purchase_date)}
									</td>
									<td class="whitespace-nowrap px-3 py-3 text-right text-sm">
										<div class="inline-flex flex-wrap items-center justify-end gap-1.5">
											<a
												href="{base}/assets/{row.id}"
												class="rounded border border-gray-200 bg-white px-2.5 py-1 text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
											>
												Edit
											</a>
											<button
												type="button"
												class="rounded border border-red-200 bg-white px-2.5 py-1 text-red-700 transition enabled:hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:enabled:hover:bg-red-950/50"
												disabled={deletingId === row.id}
												onclick={() => deleteAsset(row)}
											>
												{deletingId === row.id ? '…' : 'Delete'}
											</button>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>
