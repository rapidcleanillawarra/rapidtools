<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { Schedule } from './stores';

	export let companies: Schedule[] = [];
	export let companyName = '';
	export let inputId = 'company-combobox';
	export let placeholder = 'Select company…';
	export let theme: 'dark' | 'light' = 'dark';

	const dispatch = createEventDispatcher<{ select: Schedule }>();

	let isOpen = false;
	let searchQuery = '';
	let container: HTMLDivElement;
	let blurTimeout: ReturnType<typeof setTimeout>;

	$: sortedCompanies = [...companies].sort((a, b) => a.company.localeCompare(b.company));

	$: filteredCompanies = sortedCompanies.filter((company) => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return true;

		return (
			company.company.toLowerCase().includes(query) ||
			company.id.toLowerCase().includes(query)
		);
	});

	$: if (!isOpen) {
		searchQuery = companyName;
	}

	$: inputValue = isOpen ? searchQuery : companyName;

	function openDropdown() {
		isOpen = true;
		searchQuery = companyName;
	}

	function closeDropdown() {
		isOpen = false;
		searchQuery = companyName;
	}

	function selectCompany(company: Schedule) {
		clearTimeout(blurTimeout);
		searchQuery = company.company;
		isOpen = false;
		dispatch('select', company);
	}

	function handleInput(event: Event) {
		searchQuery = (event.target as HTMLInputElement).value;
		isOpen = true;
	}

	function handleFocus() {
		clearTimeout(blurTimeout);
		openDropdown();
	}

	function handleBlur() {
		blurTimeout = setTimeout(() => {
			const match = sortedCompanies.find(
				(company) => company.company.toLowerCase() === searchQuery.trim().toLowerCase()
			);

			if (match) {
				selectCompany(match);
			} else {
				closeDropdown();
			}
		}, 120);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeDropdown();
			return;
		}

		if (event.key === 'Enter' && isOpen && filteredCompanies.length > 0) {
			event.preventDefault();
			selectCompany(filteredCompanies[0]);
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (container && !container.contains(event.target as Node)) {
			closeDropdown();
		}
	}

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div
	class="company-combobox"
	class:company-combobox--light={theme === 'light'}
	bind:this={container}
>
	<input
		id={inputId}
		type="text"
		class="company-combobox-input"
		{placeholder}
		value={inputValue}
		on:focus={handleFocus}
		on:input={handleInput}
		on:blur={handleBlur}
		on:keydown={handleKeydown}
		autocomplete="off"
		role="combobox"
		aria-expanded={isOpen}
		aria-haspopup="listbox"
		aria-controls="{inputId}-listbox"
	/>
	{#if isOpen}
		<ul id="{inputId}-listbox" class="company-combobox-list" role="listbox">
			{#if filteredCompanies.length === 0}
				<li class="company-combobox-empty">No matching companies</li>
			{:else}
				{#each filteredCompanies as company (company.id)}
					<li>
						<button
							type="button"
							class="company-combobox-option"
							class:company-combobox-option--selected={company.company === companyName}
							role="option"
							aria-selected={company.company === companyName}
							on:mousedown|preventDefault={() => selectCompany(company)}
						>
							<span class="company-combobox-option-name">{company.company}</span>
							<span class="company-combobox-option-id">{company.id}</span>
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.company-combobox {
		position: relative;
		width: 100%;
	}

	.company-combobox-input {
		display: block;
		width: 100%;
		border: none;
		background: transparent;
		font-size: 1.375rem;
		font-weight: 700;
		color: #fff;
		text-align: center;
		padding: 0;
		margin: 0 auto;
	}

	.company-combobox-input::placeholder {
		color: #9ca3af;
		font-weight: 500;
	}

	.company-combobox-input:focus {
		outline: none;
		box-shadow: 0 1px 0 #fff;
	}

	.company-combobox-list {
		position: absolute;
		top: calc(100% + 0.375rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 40;
		width: min(100%, 24rem);
		margin: 0;
		padding: 0.25rem 0;
		list-style: none;
		background: #fff;
		border: 1px solid #d1d5db;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
		max-height: 14rem;
		overflow-y: auto;
		text-align: left;
	}

	.company-combobox-empty {
		padding: 0.625rem 0.75rem;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.company-combobox-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		width: 100%;
		border: none;
		background: transparent;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font: inherit;
		cursor: pointer;
	}

	.company-combobox-option:hover,
	.company-combobox-option--selected {
		background: #f3f4f6;
	}

	.company-combobox-option-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: #111;
	}

	.company-combobox-option-id {
		font-size: 0.6875rem;
		font-family: 'Consolas', 'Courier New', monospace;
		color: #6b7280;
		word-break: break-all;
	}

	.company-combobox--light .company-combobox-input {
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		background: #fff;
		color: #111;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		padding: 0.5rem 0.75rem;
	}

	.company-combobox--light .company-combobox-input::placeholder {
		color: #9ca3af;
		font-weight: 400;
	}

	.company-combobox--light .company-combobox-input:focus {
		box-shadow: 0 0 0 1px #111;
		border-color: #111;
	}

	.company-combobox--light .company-combobox-list {
		left: 0;
		transform: none;
		width: 100%;
	}
</style>
