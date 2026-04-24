<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
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
		file_count: number;
	};

	const COLUMNS = [
		{ key: 'asset_number' as const, label: 'Asset number' },
		{ key: 'asset_name' as const, label: 'Asset name' },
		{ key: 'model' as const, label: 'Model' },
		{ key: 'serial_number' as const, label: 'Serial number' },
		{ key: 'test_date' as const, label: 'Test date' },
		{ key: 'test_due_date' as const, label: 'Test due date' },
		{ key: 'purchase_date' as const, label: 'Purchase date' },
		{ key: 'file_count' as const, label: 'Files' }
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
		purchase_date: '',
		file_count: ''
	});

	let sortKey = $state<ColumnKey>('asset_number');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let deletingId = $state<string | null>(null);

	type TestDueFilter = '' | 'lt6mo' | 'lt3mo' | 'overdue';
	let testDueFilter = $state<TestDueFilter>('');

	let selectedRowIds = $state(new Set<string>());
	let selectAllCheckboxEl = $state<HTMLInputElement | null>(null);

	function todayYmd() {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function addMonthsYmd(months: number) {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setMonth(d.getMonth() + months);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function matchesTestDueFilter(row: AssetRow): boolean {
		if (!testDueFilter) return true;
		const due = row.test_due_date?.trim();
		if (!due) return false;
		const today = todayYmd();
		if (testDueFilter === 'overdue') return due < today;
		const end = testDueFilter === 'lt3mo' ? addMonthsYmd(3) : addMonthsYmd(6);
		return due >= today && due <= end;
	}

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
			if (k === 'file_count') {
				if (!String(row.file_count).includes(q)) return false;
			} else if (k === 'test_date' || k === 'test_due_date' || k === 'purchase_date') {
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
		if (sortKey === 'file_count') {
			return (a.file_count - b.file_count) * dir;
		}
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
		const filtered = rows.filter((r) => rowMatchesFilters(r) && matchesTestDueFilter(r));
		return [...filtered].sort(compareRows);
	});

	const allDisplayedSelected = $derived.by(() => {
		if (displayedRows.length === 0) return false;
		return displayedRows.every((r) => selectedRowIds.has(r.id));
	});

	const someDisplayedSelected = $derived.by(() => {
		if (displayedRows.length === 0) return false;
		const n = displayedRows.filter((r) => selectedRowIds.has(r.id)).length;
		return n > 0 && n < displayedRows.length;
	});

	$effect(() => {
		void displayedRows;
		void selectedRowIds;
		const el = selectAllCheckboxEl;
		if (!el) return;
		el.indeterminate = displayedRows.length > 0 && someDisplayedSelected;
	});

	function toggleRowSelected(id: string, checked: boolean) {
		const next = new Set(selectedRowIds);
		if (checked) next.add(id);
		else next.delete(id);
		selectedRowIds = next;
	}

	function toggleSelectAllDisplayed() {
		const next = new Set(selectedRowIds);
		if (allDisplayedSelected) {
			for (const r of displayedRows) next.delete(r.id);
		} else {
			for (const r of displayedRows) next.add(r.id);
		}
		selectedRowIds = next;
	}

	function escapeHtml(s: string) {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function editPageUrl(assetId: string) {
		return `${window.location.origin}${base}/assets/${assetId}`;
	}

	function qrCodeImageUrl(editUrl: string) {
		return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(editUrl)}`;
	}

	function printTags() {
		if (!browser || selectedRowIds.size === 0) return;
		const selected = rows.filter((r) => selectedRowIds.has(r.id));
		if (selected.length === 0) {
			toastError('Selected assets are no longer in the list.');
			return;
		}
		const tags = selected.map((r) => {
			const url = editPageUrl(r.id);
			return {
				label: r.asset_number?.trim() || r.asset_name?.trim() || r.id,
				qrUrl: qrCodeImageUrl(url)
			};
		});
		const cells = tags
			.map(
				(t) => `<div class="tag"><img src="${t.qrUrl}" alt="" width="200" height="200" /><div class="label">${escapeHtml(t.label)}</div></div>`
			)
			.join('');
		const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Asset tags</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 20px; color: #111; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  .sub { margin: 0 0 16px; font-size: 0.875rem; color: #444; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 28px; }
  .tag { text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .label { margin-top: 10px; font-size: 13px; word-break: break-word; }
  img { display: block; margin: 0 auto; }
</style></head><body>
<h1>Asset tags</h1>
<p class="sub">Scan to open the asset edit page.</p>
<div class="grid">${cells}</div>
<script>
(function(){
  var imgs = [].slice.call(document.querySelectorAll('img'));
  var left = imgs.length;
  function done() {
    left--;
    if (left <= 0) setTimeout(function() { window.print(); }, 200);
  }
  if (left === 0) setTimeout(function() { window.print(); }, 200);
  else imgs.forEach(function(img) {
    if (img.complete) done();
    else { img.onload = done; img.onerror = done; }
  });
})();
<\/script>
</body></html>`;
		const w = window.open('', '_blank', 'noopener,noreferrer');
		if (!w) {
			toastError('Allow pop-ups to print asset tags.');
			return;
		}
		w.document.write(doc);
		w.document.close();
	}

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
		const sel = new Set(selectedRowIds);
		sel.delete(row.id);
		selectedRowIds = sel;
		toastSuccess('Asset deleted.');
	}

	onMount(() => {
		(async () => {
			loading = true;
			error = null;
			const { data, error: qError } = await supabase
				.from('assets')
				.select(
					'id, asset_number, asset_name, model, serial_number, test_date, test_due_date, purchase_date, asset_files(count)'
				)
				.is('deleted_at', null)
				.order('asset_number', { ascending: true });
			loading = false;
			if (qError) {
				error = qError.message;
				return;
			}
			type RowWithCount = { asset_files?: { count: number }[] } & Record<string, unknown>;
			rows = ((data ?? []) as RowWithCount[]).map((r) => {
				const { asset_files, ...rest } = r;
				const n = asset_files?.[0]?.count;
				return { ...(rest as Omit<AssetRow, 'file_count'>), file_count: Number(n ?? 0) };
			});
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
				<div
					class="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-700/40"
				>
					<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
						<span
							class="whitespace-nowrap font-medium text-gray-800 dark:text-gray-100"
						>Test due date</span>
						<select
							bind:value={testDueFilter}
							class="min-w-[12rem] rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							aria-label="Filter by test due date"
						>
							<option value="">All</option>
							<option value="lt6mo">Less than 6 months</option>
							<option value="lt3mo">Less than 3 months</option>
							<option value="overdue">Overdue</option>
						</select>
					</label>
					<button
						type="button"
						class="ml-auto rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:enabled:hover:bg-gray-700/80"
						disabled={selectedRowIds.size === 0}
						onclick={() => printTags()}
					>
						Print Tag
					</button>
				</div>
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-700">
						<tr>
							<th
								scope="col"
								class="w-10 min-w-[2.5rem] px-2 py-2 text-left align-top text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								<input
									bind:this={selectAllCheckboxEl}
									type="checkbox"
									class="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-800 dark:focus:ring-offset-gray-800"
									checked={allDisplayedSelected}
									disabled={displayedRows.length === 0}
									aria-label="Select all visible rows"
									onchange={() => toggleSelectAllDisplayed()}
								/>
							</th>
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
									colspan={10}
								>
									No assets match the current filters.
								</td>
							</tr>
						{:else}
							{#each displayedRows as row (row.id)}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
									<td class="whitespace-nowrap px-2 py-3 align-middle">
										<input
											type="checkbox"
											class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-800 dark:focus:ring-offset-gray-800"
											checked={selectedRowIds.has(row.id)}
											aria-label="Select {row.asset_number?.trim() ||
												row.asset_name?.trim() ||
												`asset ${row.id}`}"
											onchange={(e) =>
												toggleRowSelected(row.id, e.currentTarget.checked)}
										/>
									</td>
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
									<td
										class="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-gray-900 dark:text-gray-100"
									>
										{row.file_count}
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
