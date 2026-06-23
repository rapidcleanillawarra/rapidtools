<script lang="ts">
	import { fade } from 'svelte/transition';

	export let show = false;
	export let message = '';
	export let type = 'info';
</script>

{#if show}
	<div
		class="mb-4 p-4 rounded-lg {type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}"
		transition:fade
	>
		{message}
	</div>
{/if}
