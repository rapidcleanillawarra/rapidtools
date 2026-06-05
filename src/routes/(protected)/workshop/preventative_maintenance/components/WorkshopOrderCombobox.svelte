<script lang="ts">
	import { onMount } from 'svelte';
	import { getWorkshops } from '$lib/services/workshop';

	export type WorkshopOrderOption = {
		orderId: string;
		customerName: string | null;
		clientsWorkOrder: string;
		makeModel: string;
		serialNumber: string;
		siteLocation: string | null;
	};

	interface Props {
		value?: string;
		onselect?: (option: WorkshopOrderOption) => void;
		id?: string;
	}

	let { value = $bindable(''), onselect, id = 'workshop-order-id' }: Props = $props();

	let options = $state<WorkshopOrderOption[]>([]);
	let loading = $state(false);
	let loadError = $state('');
	let dropdownOpen = $state(false);
	let searchQuery = $state('');
	let dropdownNode: HTMLDivElement | undefined = $state();

	const filteredOptions = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return options;
		return options.filter((o) => {
			const haystack = [
				o.orderId,
				o.customerName ?? '',
				o.clientsWorkOrder,
				o.makeModel,
				o.serialNumber
			]
				.join(' ')
				.toLowerCase();
			return haystack.includes(q);
		});
	});

	const selectedLabel = $derived(
		value
			? (options.find((o) => o.orderId === value)?.orderId ?? value)
			: ''
	);

	const inputValue = $derived(dropdownOpen ? searchQuery : selectedLabel);

	function openDropdown() {
		dropdownOpen = true;
		searchQuery = '';
	}

	function selectOption(option: WorkshopOrderOption) {
		value = option.orderId;
		dropdownOpen = false;
		searchQuery = '';
		onselect?.(option);
	}

	function clearSelection() {
		value = '';
		dropdownOpen = false;
		searchQuery = '';
	}

	function handleWindowClick(event: MouseEvent) {
		if (!dropdownOpen || !dropdownNode) return;
		if (!dropdownNode.contains(event.target as Node)) {
			dropdownOpen = false;
		}
	}

	async function loadOptions() {
		loading = true;
		loadError = '';
		try {
			const workshops = await getWorkshops({
				excludeStatuses: ['completed', 'to_be_scrapped'],
				select: [
					'order_id',
					'customer_name',
					'clients_work_order',
					'make_model',
					'serial_number',
					'site_location'
				]
			});
			const seen = new Set<string>();
			options = workshops
				.filter((w) => {
					const id = w.order_id?.trim();
					if (!id || seen.has(id)) return false;
					seen.add(id);
					return true;
				})
				.map((w) => ({
					orderId: w.order_id!.trim(),
					customerName: w.customer_name,
					clientsWorkOrder: w.clients_work_order ?? '',
					makeModel: w.make_model ?? '',
					serialNumber: w.serial_number ?? '',
					siteLocation: w.site_location
				}))
				.sort((a, b) => a.orderId.localeCompare(b.orderId));
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load workshop orders';
			options = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadOptions();
	});
</script>

<svelte:window onclick={handleWindowClick} />

<div class="order-combobox" bind:this={dropdownNode}>
	<div class="order-combobox-input-wrap">
		<input
			{id}
			class="field order-combobox-input"
			type="text"
			value={inputValue}
			placeholder={loading ? 'Loading orders…' : 'Search workshop order ID…'}
			disabled={loading}
			role="combobox"
			aria-expanded={dropdownOpen}
			aria-autocomplete="list"
			aria-controls="{id}-listbox"
			onfocus={openDropdown}
			onclick={(e) => {
				e.stopPropagation();
				openDropdown();
			}}
			oninput={(e) => {
				searchQuery = (e.currentTarget as HTMLInputElement).value;
				if (!dropdownOpen) dropdownOpen = true;
			}}
		/>
		{#if value}
			<button
				type="button"
				class="order-combobox-clear no-print"
				onclick={(e) => {
					e.stopPropagation();
					clearSelection();
				}}
				aria-label="Clear workshop order"
				title="Clear"
			>
				×
			</button>
		{/if}
	</div>

	{#if loadError}
		<p class="order-combobox-error" role="alert">{loadError}</p>
	{/if}

	{#if dropdownOpen}
		<ul id="{id}-listbox" class="order-combobox-list" role="listbox">
			{#if loading}
				<li class="order-combobox-empty">Loading…</li>
			{:else if filteredOptions.length === 0}
				<li class="order-combobox-empty">No matching orders</li>
			{:else}
				{#each filteredOptions as option (option.orderId)}
					<li>
						<button
							type="button"
							class="order-combobox-option"
							class:order-combobox-option--selected={option.orderId === value}
							role="option"
							aria-selected={option.orderId === value}
							onclick={() => selectOption(option)}
						>
							<span class="order-combobox-option-id">#{option.orderId}</span>
							{#if option.customerName || option.clientsWorkOrder}
								<span class="order-combobox-option-meta">
									{option.customerName || option.clientsWorkOrder}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.order-combobox {
		position: relative;
		width: 100%;
	}

	.order-combobox-input-wrap {
		display: flex;
		align-items: stretch;
		width: 100%;
	}

	.order-combobox-input {
		flex: 1;
		min-width: 0;
	}

	.order-combobox-clear {
		flex: 0 0 auto;
		margin-left: 4px;
		padding: 0 8px;
		border: 1px solid #ccc;
		background: #f5f5f5;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		color: #555;
	}

	.order-combobox-clear:hover {
		background: #eee;
		color: #111;
	}

	.order-combobox-error {
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: #b91c1c;
	}

	.order-combobox-list {
		position: absolute;
		z-index: 40;
		left: 0;
		right: 0;
		top: calc(100% + 2px);
		max-height: 220px;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid #999;
		background: #fff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
	}

	.order-combobox-empty {
		padding: 10px 12px;
		font-size: 0.8125rem;
		color: #666;
	}

	.order-combobox-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font: inherit;
	}

	.order-combobox-option:hover,
	.order-combobox-option--selected {
		background: #eff6ff;
	}

	.order-combobox-option-id {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.order-combobox-option-meta {
		font-size: 0.75rem;
		color: #555;
	}

	@media print {
		.order-combobox-clear {
			display: none !important;
		}

		.order-combobox-list {
			display: none !important;
		}
	}
</style>
