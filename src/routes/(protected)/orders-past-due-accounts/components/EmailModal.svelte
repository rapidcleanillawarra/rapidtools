<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProcessedOrder } from '../pastDueAccounts';
	import Quill from 'quill';
	import 'quill/dist/quill.snow.css';

	export let showModal = false;
	export let order: ProcessedOrder | null = null;

	const dispatch = createEventDispatcher();

	let sender = 'accounts@rapidcleanillawarra.com.au';
	let to = '';
	let cc = '';
	let bcc = '';
	let subject = '';
	let body = '';
	let isLoading = false;
	let editorElement: HTMLDivElement;
	let quillEditor: Quill | null = null;

	function getEmailTemplate(pdCounter: number, customer: string, invoice: string, amount: string): string {
		const days = pdCounter;

		if (days >= 15 && days <= 25) {
			// Friendly Reminder (15-25 days)
			return `Dear ${customer},

I hope this email finds you well. This is a friendly reminder that payment for invoice ${invoice} in the amount of $${amount} is now ${days} days past due.

We value our relationship with you and understand that payments can sometimes be delayed. Please arrange payment at your earliest convenience to avoid any impact on our continued service.

If you have any questions or need to discuss payment arrangements, please don't hesitate to contact us.

Thank you for your attention to this matter.

Best regards,
Rapid Clean Team`;
		} else if (days >= 26 && days <= 40) {
			// 2nd follow & Warning for Hold (26-40 days)
			return `Dear ${customer},

This is our second follow-up regarding payment for invoice ${invoice} in the amount of $${amount}, which is now ${days} days past due.

We appreciate your business and understand that circumstances can affect payment timing. However, continued delays may result in service interruptions or holds on future orders.

Please arrange payment as soon as possible. If you need to discuss payment arrangements or have any concerns, please contact us immediately.

Thank you for your prompt attention to this matter.

Best regards,
Rapid Clean Team`;
		} else if (days >= 41 && days <= 59) {
			// Urgent payment required (41-59 days)
			return `Dear ${customer},

URGENT: Payment for invoice ${invoice} in the amount of $${amount} is now ${days} days past due and requires immediate attention.

This extended delay is causing significant concern and may affect our ability to continue providing service. We kindly request that you arrange payment without further delay.

Please contact us immediately if there are any issues preventing payment or if you need to discuss alternative arrangements.

We appreciate your urgent attention to this matter.

Best regards,
Rapid Clean Team`;
		} else if (days >= 60) {
			// Matigas pa sa bato! walang hiya! (60+ days)
			return `Dear ${customer},

FINAL NOTICE: Payment for invoice ${invoice} in the amount of $${amount} is now ${days} days past due.

This prolonged delay is unacceptable and severely impacts our operations. Immediate payment is required to restore service and avoid further escalation.

Please arrange payment TODAY. Contact us immediately if there are legitimate circumstances preventing payment.

We expect your urgent cooperation in this matter.

Best regards,
Rapid Clean Team

NOTE: Continued non-payment may result in collection actions and service termination.`;
		} else {
			// Default template for any other cases
			return `Dear ${customer},

This is a reminder that payment for invoice ${invoice} in the amount of $${amount} is ${days} days past due.

Please arrange payment as soon as possible to avoid any disruptions to our continued service.

Thank you for your attention to this matter.

Best regards,
Rapid Clean Team`;
		}
	}

	function textToHtml(text: string): string {
		return text
			.split('\n\n')
			.map(para => para.trim())
			.filter(para => para.length > 0)
			.map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
			.join('');
	}

	// Initialize Quill editor when modal is shown and element exists
	$: if (showModal && editorElement && !quillEditor) {
		quillEditor = new Quill(editorElement, {
			theme: 'snow',
			modules: {
				toolbar: [
					['bold', 'italic', 'underline'],
					[{ 'list': 'ordered'}, { 'list': 'bullet' }],
					[{ 'header': [1, 2, 3, false] }],
					['clean']
				]
			},
			placeholder: 'Enter your email message here...'
		});
	}

	// Load email template when order changes
	$: if (order && showModal && quillEditor) {
		to = order.email || '';
		cc = '';
		bcc = 'mario@rapidcleanillawarra.com.au';
		subject = `Past Due Payment Reminder - Invoice ${order.invoice}`;
		const plainTextBody = getEmailTemplate(order.pdCounter, order.customer, order.invoice, order.amount);
		const htmlContent = textToHtml(plainTextBody);
		quillEditor.root.innerHTML = htmlContent;
	}

	async function sendEmail() {
		// Get the HTML content from Quill editor
		if (quillEditor) {
			body = quillEditor.root.innerHTML;
		}
		
		if (!to || !subject || !body) return;

		isLoading = true;

		try {
			const response = await fetch('https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7a1c480fddea4e1caeba5b84ea04d19d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sOuoBDGjTVPm3CGEZyLsLgBc1WFzapeZkzi8xl-IBI4', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					sender,
					email: {
						to,
						cc,
						bcc,
						subject,
						body
					}
				})
			});

			if (!response.ok) {
				throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
			}

			// Email sent successfully
			dispatch('close');
			resetForm();
		} catch (error) {
			console.error('Error sending email:', error);
			alert('Failed to send email. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	function closeModal() {
		// Clean up Quill instance before closing
		if (quillEditor) {
			quillEditor = null;
		}
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		sender = 'accounts@rapidcleanillawarra.com.au';
		to = '';
		cc = '';
		bcc = '';
		subject = '';
		body = '';
		isLoading = false;
	}
	
	// Clean up Quill when modal closes
	$: if (!showModal && quillEditor) {
		quillEditor = null;
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
								<!-- Sender Field -->
								<div>
									<label for="email-sender" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										From:
									</label>
									<input
										type="email"
										id="email-sender"
										bind:value={sender}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="sender@example.com"
										required
									/>
								</div>

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

								<!-- Body Field with Quill Editor -->
								<div>
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Message:
									</label>
									<div bind:this={editorElement} class="mt-1 min-h-[250px] bg-white"></div>
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
						disabled={!sender || !to || !subject || isLoading}
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

<style>
	:global(.ql-container) {
		min-height: 200px;
		font-size: 14px;
	}
	
	:global(.ql-editor) {
		min-height: 200px;
		max-height: 300px;
		overflow-y: auto;
	}
	
	:global(.ql-toolbar) {
		border-top-left-radius: 0.375rem;
		border-top-right-radius: 0.375rem;
	}
	
	:global(.ql-container) {
		border-bottom-left-radius: 0.375rem;
		border-bottom-right-radius: 0.375rem;
	}
</style>
