<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { supabase } from '$lib/supabase';
	import type { ProcessedOrder } from '../pastDueAccounts';
	import {
		type EmailSettings,
		fetchEmailSettings,
		getDefaultSettings,
		getEmailTemplate,
		replacePlaceholders
	} from '../settings/emailSettings';
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
	let settingsLoading = false;
	let editorElement: HTMLDivElement;
	let quillEditor: Quill | null = null;
	let attachments: File[] = [];
	let fileInput: HTMLInputElement;
	let emailSettings: EmailSettings | null = null;
	let user: import('firebase/auth').User | null = null;

	// Subscribe to current user
	currentUser.subscribe((value) => {
		user = value;
	});

	async function loadEmailSettings() {
		if (!user?.email) {
			console.warn('No user email available, using default settings');
			emailSettings = getDefaultSettings();
			return;
		}

		try {
			settingsLoading = true;
			emailSettings = await fetchEmailSettings(user.email);
		} catch (error) {
			console.error('Error loading email settings:', error);
			emailSettings = getDefaultSettings(user.email);
		} finally {
			settingsLoading = false;
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

	// Load email settings and template when modal opens
	$: if (showModal && !emailSettings) {
		loadEmailSettings();
	}

	// Load email template when order, settings, and editor are ready
	$: if (order && showModal && quillEditor && emailSettings && !settingsLoading) {
		// Use settings defaults with fallback to order email
		sender = emailSettings.default_from;
		// If order has email, use it; otherwise leave empty for manual entry
		to = order.email || '';
		cc = emailSettings.default_cc;
		bcc = emailSettings.default_bcc;
		
		// Replace {invoice} placeholder in subject
		subject = replacePlaceholders(emailSettings.default_subject, {
			customer: order.customer,
			invoice: order.invoice,
			amount: order.amount,
			days: order.pdCounter
		});
		
		// Get template based on PD counter and replace placeholders
		const plainTextBody = getEmailTemplate(
			order.pdCounter,
			order.customer,
			order.invoice,
			order.amount,
			emailSettings
		);
		const htmlContent = textToHtml(plainTextBody);
		quillEditor.root.innerHTML = htmlContent;
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (files) {
			// Add new files to existing attachments
			attachments = [...attachments, ...Array.from(files)];
		}
		// Clear the input so the same file can be selected again if needed
		if (fileInput) fileInput.value = '';
	}

	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				const result = reader.result as string;
				// Remove the data URL prefix (e.g., "data:application/pdf;base64,")
				const base64 = result.split(',')[1];
				resolve(base64);
			};
			reader.onerror = error => reject(error);
		});
	}

	async function sendEmail() {
		// Get the HTML content from Quill editor
		if (quillEditor) {
			body = quillEditor.root.innerHTML;
		}

		if (!to || !subject || !body) return;

		isLoading = true;

		try {
			// Convert attachments to the required format
			const attachmentPromises = attachments.map(async (file) => ({
				name: file.name,
				contentBytes: await fileToBase64(file)
			}));

			const emailAttachments = await Promise.all(attachmentPromises);

			const emailData = {
				sender,
				email: {
					to,
					cc,
					bcc,
					subject,
					body,
					attachments: emailAttachments
				}
			};

			const response = await fetch('https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7a1c480fddea4e1caeba5b84ea04d19d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sOuoBDGjTVPm3CGEZyLsLgBc1WFzapeZkzi8xl-IBI4', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(emailData)
			});

			// Try to log response body if available
			try {
				const responseClone = response.clone();
				const responseBody = await responseClone.text();
			} catch (logError) {
				// Could not log response body
			}

			if (!response.ok) {
				throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
			}

			// Email sent successfully

			// IMPORTANT: Set email_initialized = true immediately after successful email send
			// This tracks that an email has been sent for this invoice
			if (order?.invoice) {
				try {

					// First check if record exists
					const { data: existingRecord, error: fetchError } = await supabase
						.from('orders_past_due_accounts_invoice_tracking')
						.select('id, email_initialized')
						.eq('order_id', order.invoice)
						.single();

					if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
						console.error('Error checking existing record:', fetchError);
						alert(`Email sent successfully, but failed to update tracking: ${fetchError.message}`);
						return;
					}

					let trackingError;

					if (existingRecord) {
						// Record exists, update it
						const { error } = await supabase
							.from('orders_past_due_accounts_invoice_tracking')
							.update({
								email_initialized: true,
								updated_at: new Date().toISOString()
							})
							.eq('order_id', order.invoice);
						trackingError = error;
					} else {
						// Record doesn't exist, insert it
						const { error } = await supabase
							.from('orders_past_due_accounts_invoice_tracking')
							.insert({
								order_id: order.invoice,
								email_initialized: true,
								does_exists: true,
								completed: false
							});
						trackingError = error;
					}

					if (trackingError) {
						console.error('Failed to log email initialization:', trackingError);
						alert(`Email sent successfully, but failed to update tracking: ${trackingError.message}`);
					}
				} catch (trackingErr) {
					console.error('Error logging email initialization:', trackingErr);
					alert(`Email sent successfully, but failed to update tracking: ${String(trackingErr)}`);
				}
			}

			// Close modal and reset form AFTER email sent and tracking updated
			dispatch('close');
			resetForm();
		} catch (error) {
			console.error('❌ Error sending email:', {
				order: order?.invoice,
				customer: order?.customer,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date().toISOString()
			});
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
		sender = emailSettings?.default_from || 'accounts@rapidcleanillawarra.com.au';
		to = '';
		cc = '';
		bcc = '';
		subject = '';
		body = '';
		attachments = [];
		isLoading = false;
		emailSettings = null; // Reset settings so they reload next time
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
							<div class="flex items-center justify-between">
								<h3
									class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
									id="email-modal-title"
								>
									Compose Email - {order?.customer}
								</h3>
								{#if settingsLoading}
									<span class="text-xs text-gray-500 dark:text-gray-400">Loading settings...</span>
								{/if}
							</div>
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

								<!-- Attachments Field -->
								<div>
									<label for="email-attachments" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Attachments:
									</label>
									<div class="mt-1">
										<input
											type="file"
											id="email-attachments"
											bind:this={fileInput}
											on:change={handleFileSelect}
											multiple
											class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300 dark:hover:file:bg-indigo-800"
											accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
										/>
										{#if attachments.length > 0}
											<div class="mt-2 space-y-1">
												<p class="text-xs text-gray-500 dark:text-gray-400">Selected files:</p>
												{#each attachments as attachment, index}
													<div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
														<span class="text-sm text-gray-900 dark:text-gray-100 truncate">{attachment.name}</span>
														<button
															type="button"
															on:click={() => removeAttachment(index)}
															class="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
															title="Remove attachment"
														>
															<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
															</svg>
														</button>
													</div>
												{/each}
											</div>
										{/if}
									</div>
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
