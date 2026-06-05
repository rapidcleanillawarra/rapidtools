<script lang="ts">
	import { page } from '$app/stores';
	import CarpetExtractor from './components/carpet_extractor.svelte';
	import FloorScrubber from './components/floor_scrubber.svelte';
	import PressureWasher from './components/pressure_washer.svelte';

	type FormType = 'carpet_extractor' | 'floor_scrubber' | 'pressure_washer';

	const FORM_ALIASES: Record<string, FormType> = {
		carpet_extractor: 'carpet_extractor',
		pmis: 'carpet_extractor',
		floor_scrubber: 'floor_scrubber',
		pms_floor_scrubber: 'floor_scrubber',
		pm_floor_scrubber: 'floor_scrubber',
		pressure_washer: 'pressure_washer',
		ims: 'pressure_washer'
	};

	const formType = $derived(
		FORM_ALIASES[$page.url.searchParams.get('form') ?? ''] ?? null
	);
</script>

{#if formType === 'pressure_washer'}
	<PressureWasher />
{:else if formType === 'carpet_extractor'}
	<CarpetExtractor />
{:else if formType === 'floor_scrubber'}
	<FloorScrubber />
{:else}
	<div class="mx-auto max-w-lg px-4 py-16 text-center text-gray-600">
		<p class="text-lg font-medium text-gray-800">Preventive Maintenance</p>
		<p class="mt-2 text-sm">
			Add a <code class="rounded bg-gray-100 px-1">form</code> URL parameter:
			<code class="rounded bg-gray-100 px-1">carpet_extractor</code>,
			<code class="rounded bg-gray-100 px-1">floor_scrubber</code>, or
			<code class="rounded bg-gray-100 px-1">pressure_washer</code>.
		</p>
	</div>
{/if}
