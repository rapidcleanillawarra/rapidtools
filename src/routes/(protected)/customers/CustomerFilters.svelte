<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// Props
	export let columns: Array<{
		key: string;
		displayName: string;
		pillName: string;
		hasSearch: boolean;
	}>;
	export let visibleColumns: Record<string, boolean>;
	export let usernameFilterText: string;
	export let emailFilterText: string;
	export let parsedUsernameFilter: string[];
	export let parsedEmailFilter: string[];

	// Event handlers
	export let onToggleColumn: (column: string) => void;
	export let onShowAllColumns: () => void;
	export let onHideAllColumns: () => void;

	// Local state for collapsible panel
	let isExpanded = false;
	let panelHeight = '0px';
	let contentRef: HTMLElement;
	let isAnimating = false;

	// Toggle panel expansion
	function togglePanel() {
		if (isAnimating) return;

		isExpanded = !isExpanded;
		isAnimating = true;

		// Force reflow to ensure transition works
		if (contentRef) {
			contentRef.style.height = isExpanded ? '0px' : contentRef.scrollHeight + 'px';
		}

		// Reset animation flag after transition
		setTimeout(() => {
			isAnimating = false;
			if (contentRef) {
				contentRef.style.height = isExpanded ? 'auto' : '0px';
			}
		}, 300); // Match transition duration
	}

	// Handle keyboard navigation for toggle button
	function handleToggleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			togglePanel();
		}
	}

	// Handle keyboard navigation for column visibility buttons
	function handleColumnKeydown(event: KeyboardEvent, columnKey: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onToggleColumn(columnKey);
		}
	}

	// Handle keyboard navigation for show/hide all buttons
	function handleBulkKeydown(event: KeyboardEvent, action: 'show' | 'hide') {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (action === 'show') {
				onShowAllColumns();
			} else {
				onHideAllColumns();
			}
		}
	}

	// Focus management
	function focusFirstFocusableElement() {
		if (!contentRef) return;

		const focusableElements = contentRef.querySelectorAll(
			'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
		);
		const firstElement = focusableElements[0] as HTMLElement;
		if (firstElement) {
			firstElement.focus();
		}
	}

	// Update panel height when content changes
	$: if (contentRef && isExpanded && !isAnimating) {
		contentRef.style.height = 'auto';
		const height = contentRef.scrollHeight;
		contentRef.style.height = height + 'px';
	}
</script>

<div class="mb-6 rounded-lg bg-white shadow-md">
	<!-- Filter Panel Header with Toggle Button -->
	<div class="border-b border-gray-200 px-6 py-4">
		<button
			on:click={togglePanel}
			on:keydown={handleToggleKeydown}
			class="flex w-full items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1"
			aria-expanded={isExpanded}
			aria-controls="filter-content"
			aria-label="{isExpanded ? 'Collapse' : 'Expand'} filter controls"
		>
			<div>
				<h3 class="text-lg font-medium text-gray-900">Filters & Column Visibility</h3>
				<p class="mt-1 text-sm text-gray-600">
					{isExpanded ? 'Hide' : 'Show'} filtering and column visibility options
				</p>
			</div>
			<div class="flex-shrink-0 ml-4">
				<svg
					class="h-5 w-5 text-gray-400 transition-transform duration-300 {isExpanded ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</div>
		</button>
	</div>

	<!-- Collapsible Filter Content -->
	<div
		bind:this={contentRef}
		id="filter-content"
		class="overflow-hidden transition-all duration-300 ease-in-out"
		style="height: {panelHeight}"
		aria-labelledby="filter-toggle"
		role="region"
	>
		<div class="px-6 py-6">
			<!-- Two-Column Layout -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- Left Column: Column Visibility Controls -->
				<div class="space-y-4">
					<div>
						<h4 class="text-base font-medium text-gray-900 mb-3">Column Visibility</h4>
						<p class="text-sm text-gray-600 mb-4">
							Choose which columns to display in the table. Click column names to toggle visibility.
						</p>

						<!-- Bulk Action Buttons -->
						<div class="mb-4 flex flex-wrap gap-2">
							<button
								on:click={onShowAllColumns}
								on:keydown={(e) => handleBulkKeydown(e, 'show')}
								class="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 transition-colors duration-200 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
								aria-label="Show all columns"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
								Show All
							</button>
							<button
								on:click={onHideAllColumns}
								on:keydown={(e) => handleBulkKeydown(e, 'hide')}
								class="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 transition-colors duration-200 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
								aria-label="Hide all columns"
							>
								<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
								</svg>
								Hide All
							</button>
						</div>

						<!-- Column Visibility Checkboxes -->
						<div class="space-y-3" role="group" aria-labelledby="column-visibility-heading">
							<h5 id="column-visibility-heading" class="sr-only">Column Visibility Options</h5>
							{#each columns as column (column.key)}
								<div class="flex items-center">
									<input
										type="checkbox"
										id="column-{column.key}"
										checked={visibleColumns[column.key]}
										on:change={() => onToggleColumn(column.key)}
										class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
										aria-describedby="column-{column.key}-label"
									/>
									<label
										for="column-{column.key}"
										id="column-{column.key}-label"
										class="ml-3 text-sm font-medium text-gray-700 cursor-pointer select-none"
										on:keydown={(e) => handleColumnKeydown(e, column.key)}
										tabindex="0"
									>
										{column.displayName}
									</label>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Right Column: Username and Email Filters -->
				<div class="space-y-6">
					<!-- Username Filter -->
					<div>
						<label for="username-filter" class="block text-sm font-medium text-gray-700 mb-2">
							Filter by Usernames
						</label>
						<textarea
							id="username-filter"
							bind:value={usernameFilterText}
							placeholder="Enter usernames, one per line or separated by commas&#10;Example:&#10;john.doe&#10;jane.smith, bob.wilson"
							rows="3"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm transition-colors duration-200"
							aria-describedby="username-filter-description"
						/>
						<p id="username-filter-description" class="mt-2 text-sm text-gray-500">
							Separate usernames with commas (,) or new lines. Whitespace will be trimmed automatically.
						</p>

						{#if parsedUsernameFilter.length > 0}
							<div class="mt-3 rounded-md bg-blue-50 p-3">
								<div class="flex">
									<div class="flex-shrink-0">
										<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
										</svg>
									</div>
									<div class="ml-3">
										<h4 class="text-sm font-medium text-blue-800">
											Filtering by {parsedUsernameFilter.length} username{parsedUsernameFilter.length === 1 ? '' : 's'}
										</h4>
										<div class="mt-1 text-sm text-blue-700">
											<p>Showing only customers with usernames: {parsedUsernameFilter.join(', ')}</p>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Email Filter -->
					<div>
						<label for="email-filter" class="block text-sm font-medium text-gray-700 mb-2">
							Filter by Emails
						</label>
						<textarea
							id="email-filter"
							bind:value={emailFilterText}
							placeholder="Enter email addresses, one per line or separated by commas&#10;Example:&#10;john.doe@company.com&#10;jane.smith@company.com, bob.wilson@company.com"
							rows="3"
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm transition-colors duration-200"
							aria-describedby="email-filter-description"
						/>
						<p id="email-filter-description" class="mt-2 text-sm text-gray-500">
							Separate email addresses with commas (,) or new lines. Whitespace will be trimmed automatically.
						</p>

						{#if parsedEmailFilter.length > 0}
							<div class="mt-3 rounded-md bg-green-50 p-3">
								<div class="flex">
									<div class="flex-shrink-0">
										<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
										</svg>
									</div>
									<div class="ml-3">
										<h4 class="text-sm font-medium text-green-800">
											Filtering by {parsedEmailFilter.length} email{parsedEmailFilter.length === 1 ? '' : 's'}
										</h4>
										<div class="mt-1 text-sm text-green-700">
											<p>Showing only customers with email addresses: {parsedEmailFilter.join(', ')}</p>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Ensure smooth height transitions */
	#filter-content {
		will-change: height;
	}

	/* Focus styles for keyboard navigation */
	button:focus-visible,
	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* Custom scrollbar for filter content if needed */
	#filter-content::-webkit-scrollbar {
		width: 6px;
	}

	#filter-content::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 3px;
	}

	#filter-content::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 3px;
	}

	#filter-content::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>