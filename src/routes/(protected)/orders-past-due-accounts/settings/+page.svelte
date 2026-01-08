<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import TemplateEditor from './TemplateEditor.svelte';
	import {
		type EmailSettings,
		fetchEmailSettings,
		saveEmailSettings,
		getDefaultSettings,
		validateSettings
	} from './emailSettings';

	let user: import('firebase/auth').User | null = null;
	let settings: EmailSettings = getDefaultSettings();
	let loading = true;
	let saving = false;
	let activeTab: 'email' | 'templates' = 'email';
	let activeTemplateTab: '15-25' | '26-40' | '41-59' | '60+' = '15-25';

	async function loadSettings() {
		if (!user?.email) return;

		try {
			loading = true;
			settings = await fetchEmailSettings(user.email);
		} catch (error) {
			console.error('Error loading settings:', error);
			toastError('Failed to load settings');
		} finally {
			loading = false;
		}
	}

	async function handleSave() {
		if (!user?.email) {
			toastError('User not authenticated');
			return;
		}

		// Validate settings
		const validation = validateSettings(settings);
		if (!validation.valid) {
			toastError(validation.errors.join(', '));
			return;
		}

		try {
			saving = true;
			settings.user_email = user.email;
			const result = await saveEmailSettings(settings);

			if (result.success) {
				toastSuccess('Settings saved successfully');
			} else {
				toastError(result.error || 'Failed to save settings');
			}
		} catch (error) {
			console.error('Error saving settings:', error);
			toastError('Failed to save settings');
		} finally {
			saving = false;
		}
	}

	function handleReset() {
		if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
			settings = getDefaultSettings(user?.email || '');
			toastSuccess('Settings reset to defaults');
		}
	}

	onMount(() => {
		const unsubscribe = currentUser.subscribe((value) => {
			user = value;
			if (value) {
				loadSettings();
			}
		});

		return unsubscribe;
	});
</script>

<ToastContainer />

<div class="px-4 sm:px-6 lg:px-8">
	<div class="mb-6">
		<div class="sm:flex sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
					Email Settings
				</h1>
				<p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
					Configure default email composition settings for past due account reminders.
				</p>
			</div>
			<div class="mt-4 sm:mt-0">
				<a
					href=".."
					class="inline-flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						></path>
					</svg>
					Back to Orders
				</a>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="text-gray-500 dark:text-gray-400">Loading settings...</div>
		</div>
	{:else}
		<!-- Tab Navigation -->
		<div class="mb-6 border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex space-x-8" aria-label="Tabs">
				<button
					type="button"
					on:click={() => (activeTab = 'email')}
					class="whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium {activeTab === 'email'
						? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
				>
					Email Fields
				</button>
				<button
					type="button"
					on:click={() => (activeTab = 'templates')}
					class="whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium {activeTab === 'templates'
						? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
				>
					Message Templates
				</button>
			</nav>
		</div>

		<!-- Email Fields Tab -->
		{#if activeTab === 'email'}
			<div class="space-y-6">
				<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
					<h2 class="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
						Default Email Fields
					</h2>
					<div class="space-y-4">
						<!-- From -->
						<div>
							<label
								for="default-from"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								From <span class="text-red-500">*</span>
							</label>
							<input
								type="email"
								id="default-from"
								bind:value={settings.default_from}
								required
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
								placeholder="accounts@example.com"
							/>
						</div>

						<!-- To -->
						<div>
							<label
								for="default-to"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								To (default)
							</label>
							<input
								type="email"
								id="default-to"
								bind:value={settings.default_to}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
								placeholder="Leave empty to use customer's email"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Optional: If empty, customer's email will be used automatically
							</p>
						</div>

						<!-- CC -->
						<div>
							<label
								for="default-cc"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								CC
							</label>
							<input
								type="email"
								id="default-cc"
								bind:value={settings.default_cc}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
								placeholder="cc@example.com"
							/>
						</div>

						<!-- BCC -->
						<div>
							<label
								for="default-bcc"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								BCC
							</label>
							<input
								type="email"
								id="default-bcc"
								bind:value={settings.default_bcc}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
								placeholder="bcc@example.com"
							/>
						</div>

						<!-- Subject -->
						<div>
							<label
								for="default-subject"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Subject <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								id="default-subject"
								bind:value={settings.default_subject}
								required
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
								placeholder="Past Due Payment Reminder - Invoice &#123;invoice&#125;"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Use <code class="rounded bg-gray-100 px-1 dark:bg-gray-700">&#123;invoice&#125;</code> for
								invoice number
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Message Templates Tab -->
		{#if activeTab === 'templates'}
			<div class="space-y-6">
				<!-- Template Range Tabs -->
				<div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
					<div class="mb-4 border-b border-gray-200 dark:border-gray-700">
						<nav class="-mb-px flex space-x-4" aria-label="Template tabs">
							<button
								type="button"
								on:click={() => (activeTemplateTab = '15-25')}
								class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium {activeTemplateTab === '15-25'
									? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
									: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
							>
								15-25 Days
							</button>
							<button
								type="button"
								on:click={() => (activeTemplateTab = '26-40')}
								class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium {activeTemplateTab === '26-40'
									? 'border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400'
									: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
							>
								26-40 Days
							</button>
							<button
								type="button"
								on:click={() => (activeTemplateTab = '41-59')}
								class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium {activeTemplateTab === '41-59'
									? 'border-orange-500 text-orange-600 dark:border-orange-400 dark:text-orange-400'
									: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
							>
								41-59 Days
							</button>
							<button
								type="button"
								on:click={() => (activeTemplateTab = '60+')}
								class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium {activeTemplateTab === '60+'
									? 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400'
									: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
							>
								60+ Days
							</button>
						</nav>
					</div>

					<!-- Template Editors -->
					{#if activeTemplateTab === '15-25'}
						<TemplateEditor
							label="Friendly Reminder (15-25 days)"
							rangeDescription="Used when payment is 15-25 days overdue"
							bind:value={settings.template_15_25_days}
						/>
					{:else if activeTemplateTab === '26-40'}
						<TemplateEditor
							label="2nd Follow & Warning (26-40 days)"
							rangeDescription="Used when payment is 26-40 days overdue"
							bind:value={settings.template_26_40_days}
						/>
					{:else if activeTemplateTab === '41-59'}
						<TemplateEditor
							label="Urgent Payment Required (41-59 days)"
							rangeDescription="Used when payment is 41-59 days overdue"
							bind:value={settings.template_41_59_days}
						/>
					{:else if activeTemplateTab === '60+'}
						<TemplateEditor
							label="Final Notice (60+ days)"
							rangeDescription="Used when payment is 60 or more days overdue"
							bind:value={settings.template_60_plus_days}
						/>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
			<button
				type="button"
				on:click={handleReset}
				disabled={saving}
				class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					></path>
				</svg>
				Reset to Defaults
			</button>

			<button
				type="button"
				on:click={handleSave}
				disabled={saving}
				class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if saving}
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Saving...
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						></path>
					</svg>
					Save Settings
				{/if}
			</button>
		</div>
	{/if}
</div>

