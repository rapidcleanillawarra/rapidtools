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
			<label class="block text-sm font-medium text-gray-900 dark:text-gray-100">
				{label}
			</label>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{rangeDescription}</p>
		</div>
		<button
			type="button"
			on:click={() => (showPreview = !showPreview)}
			class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
		>
			{showPreview ? 'Hide Preview' : 'Show Preview'}
		</button>
	</div>

	<!-- Placeholder Reference -->
	<div class="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
		<p class="text-xs font-medium text-blue-800 dark:text-blue-300">Available Placeholders:</p>
		<div class="mt-1 flex flex-wrap gap-2">
			<code
				class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
				>&#123;customer&#125;</code
			>
			<code
				class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
				>&#123;invoice&#125;</code
			>
			<code
				class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
				>&#123;amount&#125;</code
			>
			<code
				class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
				>&#123;days&#125;</code
			>
		</div>
	</div>

	<!-- Template Editor -->
	<div class="relative">
		<textarea
			bind:value
			rows="12"
			class="block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			placeholder="Enter email template here..."
		></textarea>
		<div class="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
			{characterCount} characters
		</div>
	</div>

	<!-- Preview Section -->
	{#if showPreview}
		<div class="rounded-md border border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800">
			<p class="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Preview (with sample data):</p>
			<div class="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
				{previewText}
			</div>
			<div class="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Sample: Customer="{sampleValues.customer}", Invoice="{sampleValues.invoice}", Amount="${sampleValues.amount}",
					Days={sampleValues.days}
				</p>
			</div>
		</div>
	{/if}
</div>

