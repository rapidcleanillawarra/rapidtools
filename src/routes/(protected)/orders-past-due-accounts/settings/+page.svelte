<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
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

<svelte:head>
	<title>Email Settings - Past Due Accounts - Rapid Tools</title>
</svelte:head>

<ToastContainer />

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
	<div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8">
		<div class="mb-6">
			<div class="sm:flex sm:items-center sm:justify-between">
				<div>
					<h1 class="text-3xl font-extrabold tracking-tight text-white">
						Email Settings
					</h1>
					<p class="mt-2 text-sm text-gray-400">
						Configure default email composition settings for past due account reminders.
					</p>
				</div>
				<div class="mt-4 sm:mt-0">
					<a
						href="{base}/orders-past-due-accounts"
						class="btn-secondary text-sm inline-flex items-center gap-2"
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
				<div class="text-gray-400">Loading settings...</div>
			</div>
		{:else}
			<!-- Tab Navigation -->
			<div class="mb-6 border-b border-[#262a30]">
				<nav class="-mb-px flex space-x-8" aria-label="Tabs">
					<button
						type="button"
						on:click={() => (activeTab = 'email')}
						class="whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition {activeTab === 'email'
							? 'border-lime-500 text-lime-400 font-semibold'
							: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
					>
						Email Fields
					</button>
					<button
						type="button"
						on:click={() => (activeTab = 'templates')}
						class="whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition {activeTab === 'templates'
							? 'border-lime-500 text-lime-400 font-semibold'
							: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
					>
						Message Templates
					</button>
				</nav>
			</div>

			<!-- Email Fields Tab -->
			{#if activeTab === 'email'}
				<div class="space-y-6">
					<div class="rounded-2xl border border-[#262a30] bg-[#181b20] p-6 shadow-xl">
						<h2 class="mb-4 text-lg font-bold text-white">
							Default Email Fields
						</h2>
						<div class="space-y-4">
							<!-- From -->
							<div>
								<label
									for="default-from"
									class="block text-sm font-medium text-gray-300 mb-1.5"
								>
									From <span class="text-red-400">*</span>
								</label>
								<input
									type="email"
									id="default-from"
									bind:value={settings.default_from}
									required
									class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
									placeholder="accounts@example.com"
								/>
							</div>

							<!-- To -->
							<div>
								<label
									for="default-to"
									class="block text-sm font-medium text-gray-300 mb-1.5"
								>
									To (default)
								</label>
								<input
									type="email"
									id="default-to"
									bind:value={settings.default_to}
									class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
									placeholder="Leave empty to use customer's email"
								/>
								<p class="mt-1 text-xs text-gray-500">
									Optional: If empty, customer's email will be used automatically
								</p>
							</div>

							<!-- CC -->
							<div>
								<label
									for="default-cc"
									class="block text-sm font-medium text-gray-300 mb-1.5"
								>
									CC
								</label>
								<input
									type="email"
									id="default-cc"
									bind:value={settings.default_cc}
									class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
									placeholder="cc@example.com"
								/>
							</div>

							<!-- BCC -->
							<div>
								<label
									for="default-bcc"
									class="block text-sm font-medium text-gray-300 mb-1.5"
								>
									BCC
								</label>
								<input
									type="email"
									id="default-bcc"
									bind:value={settings.default_bcc}
									class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
									placeholder="bcc@example.com"
								/>
							</div>

							<!-- Subject -->
							<div>
								<label
									for="default-subject"
									class="block text-sm font-medium text-gray-300 mb-1.5"
								>
									Subject <span class="text-red-400">*</span>
								</label>
								<input
									type="text"
									id="default-subject"
									bind:value={settings.default_subject}
									required
									class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
									placeholder="Past Due Payment Reminder - Invoice &#123;invoice&#125;"
								/>
								<p class="mt-1 text-xs text-gray-500">
									Use <code class="rounded bg-[#0e1012] border border-[#262a30] px-1 text-lime-400">&#123;invoice&#125;</code> for
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
					<div class="rounded-2xl border border-[#262a30] bg-[#181b20] p-6 shadow-xl">
						<div class="mb-4 border-b border-[#262a30]">
							<nav class="-mb-px flex space-x-4" aria-label="Template tabs">
								<button
									type="button"
									on:click={() => (activeTemplateTab = '15-25')}
									class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition {activeTemplateTab === '15-25'
										? 'border-lime-500 text-lime-400 font-semibold'
										: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
								>
									15-25 Days
								</button>
								<button
									type="button"
									on:click={() => (activeTemplateTab = '26-40')}
									class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition {activeTemplateTab === '26-40'
										? 'border-lime-500 text-lime-400 font-semibold'
										: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
								>
									26-40 Days
								</button>
								<button
									type="button"
									on:click={() => (activeTemplateTab = '41-59')}
									class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition {activeTemplateTab === '41-59'
										? 'border-lime-500 text-lime-400 font-semibold'
										: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
								>
									41-59 Days
								</button>
								<button
									type="button"
									on:click={() => (activeTemplateTab = '60+')}
									class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition {activeTemplateTab === '60+'
										? 'border-lime-500 text-lime-400 font-semibold'
										: 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
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
			<div class="mt-6 flex items-center justify-between border-t border-[#262a30] pt-6">
				<button
					type="button"
					on:click={handleReset}
					disabled={saving}
					class="btn-secondary text-sm inline-flex items-center gap-2"
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
					class="btn-primary text-sm inline-flex items-center gap-2"
				>
					{#if saving}
						<svg class="h-4 w-4 animate-spin text-gray-950" fill="none" viewBox="0 0 24 24">
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
</div>

