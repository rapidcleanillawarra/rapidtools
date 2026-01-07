<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProcessedOrder } from '../pastDueAccounts';

	export let showModal = false;
	export let order: ProcessedOrder | null = null;

	const dispatch = createEventDispatcher();

	let to = '';
	let cc = '';
	let bcc = '';
	let subject = '';
	let body = '';
	let isLoading = false;

	$: if (order && showModal) {
		to = order.email || '';
		subject = `Past Due Payment Reminder - Invoice ${order.invoice}`;
		body = `Dear ${order.customer},

This is a reminder that payment for invoice ${order.invoice} in the amount of $${order.amount} is ${order.pdCounter} days past due.

Please arrange payment as soon as possible to avoid any disruptions to our continued service.

Thank you for your attention to this matter.

Best regards,
Rapid Clean Team`;
	}

	function sendEmail() {
		if (!to || !subject || !body) return;

		isLoading = true;

		// Construct mailto URL with all fields
		let mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

		if (cc) {
			mailtoUrl += `&cc=${encodeURIComponent(cc)}`;
		}

		if (bcc) {
			mailtoUrl += `&bcc=${encodeURIComponent(bcc)}`;
		}

		// Open email client
		window.open(mailtoUrl, '_blank');

		// Close modal after a short delay to allow email client to open
		setTimeout(() => {
			dispatch('close');
			isLoading = false;
		}, 500);
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		to = '';
		cc = '';
		bcc = '';
		subject = '';
		body = '';
		isLoading = false;
	}

	// Close modal when clicking outside
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

{#if showModal}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby="email-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
	>
		<div class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
			<div
				class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
				aria-hidden="true"
			></div>

			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

			<div
				class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle"
			>
				<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<h3
								class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
								id="email-modal-title"
							>
								Compose Email - {order?.customer}
							</h3>
							<div class="mt-4 space-y-4">
								<!-- To Field -->
								<div>
									<label for="email-to" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										To:
									</label>
									<input
										type="email"
										id="email-to"
										bind:value={to}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="recipient@example.com"
										required
									/>
								</div>

								<!-- CC Field -->
								<div>
									<label for="email-cc" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										CC:
									</label>
									<input
										type="email"
										id="email-cc"
										bind:value={cc}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="cc@example.com"
										multiple
									/>
								</div>

								<!-- BCC Field -->
								<div>
									<label for="email-bcc" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										BCC:
									</label>
									<input
										type="email"
										id="email-bcc"
										bind:value={bcc}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="bcc@example.com"
										multiple
									/>
								</div>

								<!-- Subject Field -->
								<div>
									<label for="email-subject" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Subject:
									</label>
									<input
										type="text"
										id="email-subject"
										bind:value={subject}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										required
									/>
								</div>

								<!-- Body Field -->
								<div>
									<label for="email-body" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Message:
									</label>
									<textarea
										id="email-body"
										rows="8"
										bind:value={body}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Enter your email message here..."
										required
									></textarea>
								</div>

								<!-- Invoice Details Summary -->
								{#if order}
									<div class="rounded-md bg-gray-50 p-3 dark:bg-gray-700">
										<p class="text-sm text-gray-600 dark:text-gray-400">
											<strong>Invoice:</strong> {order.invoice} |
											<strong>Amount:</strong> ${order.amount} |
											<strong>Days Past Due:</strong> {order.pdCounter}
										</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
				<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						on:click={sendEmail}
						disabled={!to || !subject || !body || isLoading}
						class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
					>
						{#if isLoading}
							Sending...
						{:else}
							Send Email
						{/if}
					</button>
					<button
						type="button"
						on:click={closeModal}
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
