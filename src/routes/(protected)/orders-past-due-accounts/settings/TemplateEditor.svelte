<script lang="ts">
	import { replacePlaceholders } from './emailSettings';

	export let label: string;
	export let value: string;
	export let rangeDescription: string;

	let showPreview = false;

	// Sample values for preview
	const sampleValues = {
		customer: 'ABC Company Pty Ltd',
		invoice: 'INV-12345',
		amount: '2,450.00',
		days: 35
	};

	$: previewText = replacePlaceholders(value, sampleValues);
	$: characterCount = value.length;
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<div>
			<label class="block text-sm font-semibold text-white">
				{label}
			</label>
			<p class="mt-1 text-xs text-gray-400">{rangeDescription}</p>
		</div>
		<button
			type="button"
			on:click={() => (showPreview = !showPreview)}
			class="text-sm font-medium text-lime-400 hover:text-lime-300 transition"
		>
			{showPreview ? 'Hide Preview' : 'Show Preview'}
		</button>
	</div>

	<!-- Placeholder Reference -->
	<div class="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3">
		<p class="text-xs font-semibold text-sky-400">Available Placeholders:</p>
		<div class="mt-1.5 flex flex-wrap gap-2">
			<code
				class="rounded-md border border-sky-500/30 bg-sky-950/40 px-2 py-0.5 text-xs font-mono text-sky-300"
				>&#123;customer&#125;</code
			>
			<code
				class="rounded-md border border-sky-500/30 bg-sky-950/40 px-2 py-0.5 text-xs font-mono text-sky-300"
				>&#123;invoice&#125;</code
			>
			<code
				class="rounded-md border border-sky-500/30 bg-sky-950/40 px-2 py-0.5 text-xs font-mono text-sky-300"
				>&#123;amount&#125;</code
			>
			<code
				class="rounded-md border border-sky-500/30 bg-sky-950/40 px-2 py-0.5 text-xs font-mono text-sky-300"
				>&#123;days&#125;</code
			>
		</div>
	</div>

	<!-- Template Editor -->
	<div class="relative">
		<textarea
			bind:value
			rows="12"
			class="w-full rounded-xl bg-[#0e1012] border border-[#262a30] p-3 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
			placeholder="Enter email template here..."
		></textarea>
		<div class="mt-1 text-right text-xs text-gray-500">
			{characterCount} characters
		</div>
	</div>

	<!-- Preview Section -->
	{#if showPreview}
		<div class="rounded-xl border border-[#262a30] bg-[#0e1012] p-4 text-gray-200">
			<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Preview (with sample data):</p>
			<div class="whitespace-pre-wrap text-sm text-gray-200">
				{previewText}
			</div>
			<div class="mt-3 border-t border-[#262a30] pt-2">
				<p class="text-xs text-gray-500">
					Sample: Customer="{sampleValues.customer}", Invoice="{sampleValues.invoice}", Amount="${sampleValues.amount}",
					Days={sampleValues.days}
				</p>
			</div>
		</div>
	{/if}
</div>

