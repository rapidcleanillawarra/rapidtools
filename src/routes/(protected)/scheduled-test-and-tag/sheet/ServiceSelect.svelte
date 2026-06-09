<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { SERVICE_OPTIONS } from './types';
	import { parseServiceValues, toggleServiceValue } from './utils';

	export let value = '';

	const dispatch = createEventDispatcher<{ change: string }>();

	$: selectedValues = parseServiceValues(value);

	function handleToggle(option: (typeof SERVICE_OPTIONS)[number]) {
		dispatch('change', toggleServiceValue(value, option));
	}
</script>

<fieldset class="service-select">
	<legend class="service-select-legend">Service types</legend>
	{#each SERVICE_OPTIONS as option (option)}
		<label class="service-select-option">
			<input
				type="checkbox"
				checked={selectedValues.includes(option)}
				on:change={() => handleToggle(option)}
			/>
			<span>{option}</span>
		</label>
	{/each}
</fieldset>

<style>
	.service-select {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		border: none;
		min-width: 7rem;
	}

	.service-select-legend {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.service-select-option {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: #111;
		cursor: pointer;
		user-select: none;
	}

	.service-select-option input[type='checkbox'] {
		width: 0.875rem;
		height: 0.875rem;
		margin: 0;
		flex-shrink: 0;
		cursor: pointer;
		accent-color: #2d6a2d;
	}
</style>
