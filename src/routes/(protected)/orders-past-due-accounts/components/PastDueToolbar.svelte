<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { base } from '$app/paths';

	export let operator: string;
	export let value: number | null;
	export let showLegend = false;
	export let showColumnVisibility = false;
	export let invoiceIds = '';
	export let showInvoiceFilter = false;
	export let disableActions = false;

	const dispatch = createEventDispatcher<{
		apply: void;
		exportCsv: void;
		print: void;
		manualTrigger: void;
	}>();
</script>

<div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<!-- Left: PD Counter Filter + Toggle Buttons -->
	<div class="flex flex-wrap items-center gap-3">
		<!-- PD Counter Filter -->
		<div class="flex items-center gap-2">
			<label for="pd-filter" class="text-sm font-medium text-gray-300">
				PD Counter:
			</label>
			<select
				bind:value={operator}
				class="rounded-lg bg-[#0e1012] text-gray-200 border border-[#262a30] px-2.5 py-1.5 text-sm font-semibold focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
			>
				<option value=">">&gt;</option>
				<option value="<">&lt;</option>
				<option value="=">=</option>
			</select>
			<input
				id="pd-filter"
				type="number"
				placeholder="Days"
				class="w-24 rounded-lg bg-[#0e1012] text-gray-200 border border-[#262a30] px-3 py-1.5 text-sm placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
				bind:value
			/>
			<button
				type="button"
				on:click={() => dispatch('apply')}
				class="btn-primary text-xs font-semibold px-3 py-1.5"
			>
				Apply
			</button>
		</div>

		<!-- Toggle Buttons -->
		<button
			type="button"
			on:click={() => (showLegend = !showLegend)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {showLegend
				? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
				: 'border-[#333842] bg-[#1f2329] text-gray-300 hover:bg-[#262a30] hover:text-white'}"
			title={showLegend ? 'Hide Legend' : 'Show Legend'}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				{#if showLegend}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					></path>
				{:else}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
					></path>
				{/if}
			</svg>
			Legend
		</button>
		<button
			type="button"
			on:click={() => (showColumnVisibility = !showColumnVisibility)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {showColumnVisibility
				? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
				: 'border-[#333842] bg-[#1f2329] text-gray-300 hover:bg-[#262a30] hover:text-white'}"
			title={showColumnVisibility ? 'Hide Columns' : 'Show Columns'}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				{#if showColumnVisibility}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					></path>
				{:else}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
					></path>
				{/if}
			</svg>
			Columns
		</button>
		<button
			type="button"
			on:click={() => (showInvoiceFilter = !showInvoiceFilter)}
			class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {showInvoiceFilter
				? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
				: 'border-[#333842] bg-[#1f2329] text-gray-300 hover:bg-[#262a30] hover:text-white'}"
			title={showInvoiceFilter ? 'Hide Invoice Filter' : 'Show Invoice Filter'}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
				/>
			</svg>
			Invoice Filter
		</button>
	</div>

	<!-- Right: Action Buttons -->
	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			on:click={() => dispatch('exportCsv')}
			disabled={disableActions}
			class="btn-secondary text-sm px-3.5 py-1.5 inline-flex items-center gap-1.5"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			Export CSV
		</button>
		<button
			type="button"
			on:click={() => dispatch('print')}
			disabled={disableActions}
			class="btn-secondary text-sm px-3.5 py-1.5 inline-flex items-center gap-1.5"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
			</svg>
			Print Report
		</button>
		<button
			type="button"
			on:click={() => dispatch('manualTrigger')}
			class="btn-secondary text-sm px-3.5 py-1.5 inline-flex items-center gap-1.5 hover:text-lime-400"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			Invoice Synch
		</button>
		<a
			href="{base}/orders-past-due-accounts/settings"
			class="btn-secondary text-sm px-3.5 py-1.5 inline-flex items-center gap-1.5 hover:text-lime-400"
			title="Email Settings"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				></path>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				></path>
			</svg>
			Settings
		</a>
	</div>
</div>

{#if showInvoiceFilter}
	<div class="animate-in fade-in slide-in-from-top-2 mt-4 duration-200">
		<div
			class="relative rounded-2xl border border-[#262a30] bg-[#181b20] p-4 shadow-xl"
		>
			<label
				for="invoice-filter"
				class="mb-2 block text-sm font-medium text-gray-300"
			>
				Filter by Invoice IDs (one per line):
			</label>
			<div class="relative">
				<textarea
					id="invoice-filter"
					bind:value={invoiceIds}
					rows="4"
					placeholder="24-004437&#10;24-004439"
					class="block w-full rounded-lg bg-[#0e1012] text-gray-200 border border-[#262a30] p-3 text-sm placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 font-mono"
				></textarea>
				{#if invoiceIds}
					<div class="absolute bottom-3 right-3">
						<button
							type="button"
							on:click={() => (invoiceIds = '')}
							class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/60 hover:text-red-300 transition"
						>
							Clear
						</button>
					</div>
				{/if}
			</div>
			<p class="mt-2 text-xs text-gray-400">
				Only orders with these specific Invoice IDs will be shown in the table.
			</p>
		</div>
	</div>
{/if}
