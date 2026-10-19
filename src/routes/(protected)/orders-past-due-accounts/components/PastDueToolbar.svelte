<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let globalSearch = '';
	export let operator: string;
	export let value: number | null;
	export let appliedOperator: string = '>';
	export let appliedValue: number | null = 30;
	export let showLegend = false;
	export let showColumnVisibility = false;
	export let invoiceIds = '';
	export let showInvoiceFilter = false;

	let showPdDropdown = false;

	const dispatch = createEventDispatcher<{
		apply: void;
		clearPdFilter: void;
	}>();

	function handleApplyPd() {
		dispatch('apply');
		showPdDropdown = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (showPdDropdown && !target.closest('.pd-dropdown-container')) {
			showPdDropdown = false;
		}
	}

	$: pdFilterLabel =
		appliedValue !== null && appliedValue !== undefined && String(appliedValue) !== ''
			? `PD counter ${appliedOperator} ${appliedValue}`
			: 'PD counter: All';
</script>

<svelte:window on:click={handleClickOutside} />

<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<!-- Left: Search Input -->
	<div class="relative flex-1 max-w-xl">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
			<svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
		</div>
		<input
			type="text"
			bind:value={globalSearch}
			placeholder="Search customers or invoices..."
			class="w-full rounded-xl border border-[#262a30] bg-[#141619] py-2.5 pl-10 pr-9 text-sm text-gray-200 placeholder-gray-500 transition focus:border-lime-500/60 focus:outline-none focus:ring-1 focus:ring-lime-500/60"
		/>
		{#if globalSearch}
			<button
				type="button"
				on:click={() => (globalSearch = '')}
				class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-300"
				title="Clear search"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Right: Filter Controls -->
	<div class="flex flex-wrap items-center gap-2.5">
		<!-- PD Counter Dropdown -->
		<div class="relative pd-dropdown-container">
			<button
				type="button"
				on:click={() => (showPdDropdown = !showPdDropdown)}
				class="inline-flex items-center gap-2.5 rounded-xl border border-[#262a30] bg-[#141619] px-3.5 py-2.5 text-sm font-medium text-gray-200 transition hover:border-[#333842] hover:bg-[#1a1d21]"
			>
				<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
					/>
				</svg>
				<span>{pdFilterLabel}</span>
				<svg
					class="h-4 w-4 text-gray-400 transition-transform {showPdDropdown ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if showPdDropdown}
				<div
					class="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#262a30] bg-[#181b20] p-4 shadow-2xl"
				>
					<div class="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
						Filter by PD Counter
					</div>
					<div class="flex items-center gap-2">
						<select
							bind:value={operator}
							class="rounded-lg border border-[#262a30] bg-[#0e1012] px-2.5 py-1.5 text-sm font-semibold text-gray-200 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
						>
							<option value=">">&gt;</option>
							<option value="<">&lt;</option>
							<option value="=">=</option>
						</select>
						<input
							id="pd-filter"
							type="number"
							placeholder="Days"
							class="w-full rounded-lg border border-[#262a30] bg-[#0e1012] px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
							bind:value
							on:keydown={(e) => e.key === 'Enter' && handleApplyPd()}
						/>
					</div>
					<div class="mt-3 flex items-center justify-between gap-2">
						<button
							type="button"
							on:click={() => {
								operator = '>';
								value = 0;
								handleApplyPd();
							}}
							class="text-xs text-gray-400 hover:text-gray-200 transition"
						>
							Reset (&gt; 0)
						</button>
						<button
							type="button"
							on:click={handleApplyPd}
							class="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-lime-300 transition"
						>
							Apply
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Filters Button (Invoice IDs + Column Search / Legend) -->
		<button
			type="button"
			on:click={() => (showInvoiceFilter = !showInvoiceFilter)}
			class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors {showInvoiceFilter || invoiceIds.trim() !== ''
				? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
				: 'border-[#262a30] bg-[#141619] text-gray-200 hover:border-[#333842] hover:bg-[#1a1d21]'}"
			title="Filters"
		>
			<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
				/>
			</svg>
			Filters
		</button>

		<!-- Columns Button -->
		<button
			type="button"
			on:click={() => (showColumnVisibility = !showColumnVisibility)}
			class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors {showColumnVisibility
				? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
				: 'border-[#262a30] bg-[#141619] text-gray-200 hover:border-[#333842] hover:bg-[#1a1d21]'}"
			title="Columns"
		>
			<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 4h6v16H9zM4 4h5v16H4zM15 4h5v16h-5z"
				/>
			</svg>
			Columns
		</button>
	</div>
</div>

{#if showInvoiceFilter}
	<div class="animate-in fade-in slide-in-from-top-2 mt-3 duration-200">
		<div class="relative rounded-2xl border border-[#262a30] bg-[#141619] p-4 shadow-xl">
			<div class="flex items-center justify-between mb-2">
				<label for="invoice-filter" class="block text-sm font-medium text-gray-300">
					Filter by Invoice IDs (one per line):
				</label>
				<button
					type="button"
					on:click={() => (showLegend = !showLegend)}
					class="text-xs font-medium text-lime-400 hover:text-lime-300 transition"
				>
					{showLegend ? 'Hide PD Legend' : 'Show PD Legend'}
				</button>
			</div>
			<div class="relative">
				<textarea
					id="invoice-filter"
					bind:value={invoiceIds}
					rows="3"
					placeholder="24-004437&#10;24-004439"
					class="block w-full rounded-xl border border-[#262a30] bg-[#0e1012] p-3 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
				></textarea>
				{#if invoiceIds}
					<div class="absolute bottom-3 right-3">
						<button
							type="button"
							on:click={() => (invoiceIds = '')}
							class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-900/60 hover:text-red-300"
						>
							Clear
						</button>
					</div>
				{/if}
			</div>
			<p class="mt-2 text-xs text-gray-500">
				Only orders with these specific Invoice IDs will be shown in the table.
			</p>
		</div>
	</div>
{/if}

