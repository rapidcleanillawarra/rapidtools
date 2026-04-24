<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

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

	let rows: AssetRow[] = [];
	let loading = true;
	let error: string | null = null;

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
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Asset number
							</th>
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Asset name
							</th>
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Model
							</th>
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Serial number
							</th>
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Test date
							</th>
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Test due date
							</th>
							<th
								scope="col"
								class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"
							>
								Purchase date
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
						{#each rows as row (row.id)}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
								<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
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
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>
