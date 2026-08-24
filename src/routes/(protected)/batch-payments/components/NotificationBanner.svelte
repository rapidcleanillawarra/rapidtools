<script lang="ts">
	import { fade } from 'svelte/transition';

	export let show = false;
	export let message = '';
	export let type = 'info';
</script>

{#if show}
	<div
		class="mb-6 p-4 rounded-xl border text-sm leading-relaxed whitespace-pre-line {type === 'error'
			? 'border-red-500/30 bg-red-950/30 text-red-300'
			: type === 'success'
				? 'border-lime-500/30 bg-lime-950/30 text-lime-300'
				: 'border-blue-500/30 bg-blue-950/30 text-blue-300'}"
		transition:fade
	>
		{message}
	</div>
{/if}
