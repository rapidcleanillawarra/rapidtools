<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { MACHINE_TYPE_OPTIONS } from './types';
	import { getClipboardText, isMultiCellPaste, parsePasteGrid } from './utils';

	export let value = '';
	export let placeholder = 'Select type…';

	const dispatch = createEventDispatcher<{ change: string; paste: ClipboardEvent }>();

	let isOpen = false;
	let searchQuery = '';
	let container: HTMLDivElement;
	let blurTimeout: ReturnType<typeof setTimeout>;

	$: filteredOptions = MACHINE_TYPE_OPTIONS.filter((option) =>
		option.toLowerCase().includes(searchQuery.toLowerCase())
	);

	$: if (!isOpen) {
		searchQuery = value;
	}

	$: inputValue = isOpen ? searchQuery : value;

	function openDropdown() {
		isOpen = true;
		searchQuery = value;
	}

	function closeDropdown() {
		isOpen = false;
		searchQuery = value;
	}

	function selectOption(option: string) {
		clearTimeout(blurTimeout);
		searchQuery = option;
		isOpen = false;
		dispatch('change', option);
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
			const match = MACHINE_TYPE_OPTIONS.find(
				(option) => option.toLowerCase() === searchQuery.trim().toLowerCase()
			);
			if (match) {
				selectOption(match);
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

		if (event.key === 'Enter' && isOpen && filteredOptions.length > 0) {
			event.preventDefault();
			selectOption(filteredOptions[0]);
		}
	}

	async function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		event.stopPropagation();

		const text = await getClipboardText(event);
		if (!text) return;

		const grid = parsePasteGrid(text);
		if (grid.length === 0) return;

		if (isMultiCellPaste(grid)) {
			dispatch('paste', event);
			return;
		}

		const pasted = grid[0]?.[0]?.trim() ?? '';
		if (!pasted) return;

		const match = MACHINE_TYPE_OPTIONS.find(
			(option) => option.toLowerCase() === pasted.toLowerCase()
		);
		if (match) {
			selectOption(match);
		} else {
			searchQuery = pasted;
			isOpen = true;
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

<div class="machine-type-dropdown" bind:this={container}>
	<input
		type="text"
		class="machine-type-input"
		{placeholder}
		value={inputValue}
		on:focus={handleFocus}
		on:input={handleInput}
		on:blur={handleBlur}
		on:keydown={handleKeydown}
		on:paste={handlePaste}
		autocomplete="off"
		role="combobox"
		aria-expanded={isOpen}
		aria-haspopup="listbox"
	/>
	{#if isOpen}
		<ul class="machine-type-options" role="listbox">
			{#if filteredOptions.length === 0}
				<li class="machine-type-option machine-type-option--empty">No matches</li>
			{:else}
				{#each filteredOptions as option (option)}
					<li>
						<button
							type="button"
							class="machine-type-option"
							class:machine-type-option--selected={option === value}
							role="option"
							aria-selected={option === value}
							on:mousedown|preventDefault={() => selectOption(option)}
						>
							{option}
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.machine-type-dropdown {
		position: relative;
		width: 100%;
		min-width: 6rem;
	}

	.machine-type-input {
		display: block;
		width: 100%;
		min-width: 6rem;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font: inherit;
		color: #2563eb;
		font-weight: 500;
	}

	.machine-type-input:focus {
		outline: none;
		background: #fafafa;
		box-shadow: inset 0 -1px 0 #111;
	}

	.machine-type-options {
		position: absolute;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		z-index: 30;
		margin: 0;
		padding: 0.25rem 0;
		list-style: none;
		background: #fff;
		border: 1px solid #d1d5db;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		max-height: 10rem;
		overflow-y: auto;
	}

	.machine-type-option {
		display: block;
		width: 100%;
		border: none;
		background: transparent;
		padding: 0.375rem 0.625rem;
		text-align: left;
		font: inherit;
		color: #2563eb;
		cursor: pointer;
	}

	.machine-type-option:hover,
	.machine-type-option--selected {
		background: #eff6ff;
	}

	.machine-type-option--empty {
		color: #6b7280;
		cursor: default;
	}
</style>
