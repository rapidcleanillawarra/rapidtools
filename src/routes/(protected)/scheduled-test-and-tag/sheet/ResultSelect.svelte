<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { RESULT_OPTIONS } from './types';

	export let value = '';

	const dispatch = createEventDispatcher<{ change: string }>();

	const labels: Record<(typeof RESULT_OPTIONS)[number], string> = {
		pass: 'Pass',
		fail: 'Fail'
	};

	function handleChange(event: Event) {
		const next = (event.target as HTMLSelectElement).value;
		if (next === '' || RESULT_OPTIONS.includes(next as (typeof RESULT_OPTIONS)[number])) {
			dispatch('change', next);
		}
	}
</script>

<select
	class="result-select"
	class:result-select--pass={value === 'pass'}
	class:result-select--fail={value === 'fail'}
	{value}
	on:change={handleChange}
	aria-label="Result"
>
	<option value="">—</option>
	{#each RESULT_OPTIONS as option (option)}
		<option value={option}>{labels[option]}</option>
	{/each}
</select>

<style>
	.result-select {
		display: block;
		width: 100%;
		min-width: 4.5rem;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font: inherit;
		font-weight: 600;
		color: #6b7280;
		cursor: pointer;
		appearance: none;
	}

	.result-select--pass {
		color: #16a34a;
	}

	.result-select--fail {
		color: #dc2626;
	}

	.result-select:focus {
		outline: none;
		background: #fafafa;
		box-shadow: inset 0 -1px 0 #111;
	}
</style>
