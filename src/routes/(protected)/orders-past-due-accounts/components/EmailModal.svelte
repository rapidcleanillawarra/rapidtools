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
	let cc: string[] = [];
	let bcc: string[] = [];
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
		// Convert default CC/BCC strings to arrays, filtering out empty values
		cc = emailSettings.default_cc ? emailSettings.default_cc.split(';').filter(email => email.trim()) : [];
		bcc = emailSettings.default_bcc ? emailSettings.default_bcc.split(';').filter(email => email.trim()) : [];
		
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

	function addEmailToList(list: string[], email: string): string[] {
		const trimmedEmail = email.trim();
		if (trimmedEmail && !list.includes(trimmedEmail)) {
			// Basic email validation
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (emailRegex.test(trimmedEmail)) {
				return [...list, trimmedEmail];
			}
		}
		return list;
	}

	function removeEmailFromList(list: string[], emailToRemove: string): string[] {
		return list.filter(email => email !== emailToRemove);
	}

	function handleEmailKeydown(event: KeyboardEvent, list: string[], inputElement: EventTarget | null) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			const input = inputElement as HTMLInputElement;
			const email = input.value.trim();
			if (email) {
				if (list === cc) {
					cc = addEmailToList(cc, email);
				} else if (list === bcc) {
					bcc = addEmailToList(bcc, email);
				}
				input.value = '';
			}
		}
	}

	function handleEmailBlur(event: FocusEvent, list: string[]) {
		const input = event.target as HTMLInputElement;
		const email = input.value.trim();
		if (email) {
			if (list === cc) {
				cc = addEmailToList(cc, email);
			} else if (list === bcc) {
				bcc = addEmailToList(bcc, email);
			}
			input.value = '';
		}
	}

	async function sendEmail() {
		// Get the HTML content from Quill editor
		if (quillEditor) {
			body = quillEditor.root.innerHTML;
		}

		if (!to || !subject || !body) return;

		isLoading = true;

		try {
			// Retry configuration
			const maxRetries = 2;
			const baseDelay = 1000; // 1 second

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
						cc: cc.join(';'),
						bcc: bcc.join(';'),
						subject,
						body,
						attachments: emailAttachments
					}
				};

				// Create AbortController for timeout handling
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

				let response;
				try {
					response = await fetch('https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7a1c480fddea4e1caeba5b84ea04d19d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sOuoBDGjTVPm3CGEZyLsLgBc1WFzapeZkzi8xl-IBI4', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(emailData),
						signal: controller.signal
					});
				} finally {
					clearTimeout(timeoutId);
				}

				// Try to log response body if available
				try {
					const responseClone = response.clone();
					const responseBody = await responseClone.text();
				} catch (logError) {
					// Could not log response body
				}

				if (!response.ok) {
					// For 5xx errors, retry if we have attempts left
					if (response.status >= 500 && attempt < maxRetries) {
						const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
						console.warn(`Email send failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
						await new Promise(resolve => setTimeout(resolve, delay));
						continue;
					}
					throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
				}

				// Success - break out of retry loop
				break;

			} catch (fetchError) {
				// Handle different types of errors
				const error = fetchError as Error;

				if (error.name === 'AbortError') {
					// Timeout occurred
					if (attempt < maxRetries) {
						const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
						console.warn(`Email send timed out, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
						await new Promise(resolve => setTimeout(resolve, delay));
						continue;
					}
					throw new Error('Email send timed out after multiple attempts. The email service may be experiencing issues.');
				}

				// Network errors - retry if we have attempts left
				if ((error.message.includes('fetch') || error.message.includes('network')) && attempt < maxRetries) {
					const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
					console.warn(`Network error during email send, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}

				// Re-throw the error if no more retries or it's not a retryable error
				throw error;
			}
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

			// Provide user-friendly error messages based on error type
			let errorMessage = 'Failed to send email. Please try again.';

			if (error instanceof Error) {
				if (error.message.includes('timed out')) {
					errorMessage = 'Email service is taking too long to respond. This may be due to high server load. Please try again in a few minutes.';
				} else if (error.message.includes('Failed to send email: 504')) {
					errorMessage = 'Email service temporarily unavailable (Gateway Timeout). Please try again in a few minutes.';
				} else if (error.message.includes('Failed to send email: 502') || error.message.includes('Failed to send email: 503')) {
					errorMessage = 'Email service is currently experiencing issues. Please try again later.';
				} else if (error.message.includes('Failed to send email: 500')) {
					errorMessage = 'Internal server error occurred while sending email. Please contact support if this persists.';
				} else if (error.message.includes('fetch') || error.message.includes('network')) {
					errorMessage = 'Network connection issue. Please check your internet connection and try again.';
				}
			}

			alert(errorMessage);
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
		cc = [];
		bcc = [];
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
		class="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		aria-labelledby="email-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
	>
		<div
			class="relative w-full max-w-2xl rounded-2xl border border-[#262a30] bg-[#141619] p-6 text-left shadow-2xl transition-all"
		>
			<div class="flex items-center justify-between">
				<h3
					class="text-lg font-bold text-white"
					id="email-modal-title"
				>
					Compose Email - {order?.customer}
				</h3>
				{#if settingsLoading}
					<span class="text-xs text-gray-400">Loading settings...</span>
				{/if}
			</div>

			<div class="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
				<!-- Sender Field -->
				<div>
					<label for="email-sender" class="block text-sm font-medium text-gray-300 mb-1.5">
						From:
					</label>
					<input
						type="email"
						id="email-sender"
						bind:value={sender}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						placeholder="sender@example.com"
						required
					/>
				</div>

				<!-- To Field -->
				<div>
					<label for="email-to" class="block text-sm font-medium text-gray-300 mb-1.5">
						To:
					</label>
					<input
						type="email"
						id="email-to"
						bind:value={to}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						placeholder="recipient@example.com"
						required
					/>
				</div>

				<!-- CC Field -->
				<div>
					<label for="email-cc" class="block text-sm font-medium text-gray-300 mb-1.5">
						CC:
					</label>
					<div>
						<!-- CC Pills -->
						{#if cc.length > 0}
							<div class="flex flex-wrap gap-2 mb-2">
								{#each cc as email}
									<span class="inline-flex items-center rounded-full border border-lime-500/30 bg-lime-500/10 px-2.5 py-0.5 text-xs font-medium text-lime-400">
										{email}
										<button
											type="button"
											class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-lime-500/20 focus:outline-none"
											on:click={() => cc = removeEmailFromList(cc, email)}
											aria-label="Remove {email}"
										>
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
											</svg>
										</button>
									</span>
								{/each}
							</div>
						{/if}
						<!-- CC Input -->
						<input
							type="email"
							id="email-cc"
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							placeholder="Type email and press Enter, comma, or leave field to add"
							on:keydown={(event) => handleEmailKeydown(event, cc, event.target)}
							on:blur={(event) => handleEmailBlur(event, cc)}
						/>
					</div>
				</div>

				<!-- BCC Field -->
				<div>
					<label for="email-bcc" class="block text-sm font-medium text-gray-300 mb-1.5">
						BCC:
					</label>
					<div>
						<!-- BCC Pills -->
						{#if bcc.length > 0}
							<div class="flex flex-wrap gap-2 mb-2">
								{#each bcc as email}
									<span class="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
										{email}
										<button
											type="button"
											class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-emerald-500/20 focus:outline-none"
											on:click={() => bcc = removeEmailFromList(bcc, email)}
											aria-label="Remove {email}"
										>
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
											</svg>
										</button>
									</span>
								{/each}
							</div>
						{/if}
						<!-- BCC Input -->
						<input
							type="email"
							id="email-bcc"
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							placeholder="Type email and press Enter, comma, or leave field to add"
							on:keydown={(event) => handleEmailKeydown(event, bcc, event.target)}
							on:blur={(event) => handleEmailBlur(event, bcc)}
						/>
					</div>
				</div>

				<!-- Attachments Field -->
				<div>
					<label for="email-attachments" class="block text-sm font-medium text-gray-300 mb-1.5">
						Attachments:
					</label>
					<div>
						<input
							type="file"
							id="email-attachments"
							bind:this={fileInput}
							on:change={handleFileSelect}
							multiple
							class="block w-full text-sm text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1f2329] file:text-lime-400 hover:file:bg-[#262a30]"
							accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
						/>
						{#if attachments.length > 0}
							<div class="mt-2 space-y-1">
								<p class="text-xs text-gray-400">Selected files:</p>
								{#each attachments as attachment, index}
									<div class="flex items-center justify-between bg-[#181b20] border border-[#262a30] px-3 py-2 rounded-lg">
										<span class="text-sm text-gray-200 truncate">{attachment.name}</span>
										<button
											type="button"
											on:click={() => removeAttachment(index)}
											class="ml-2 text-red-400 hover:text-red-300"
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
					<label for="email-subject" class="block text-sm font-medium text-gray-300 mb-1.5">
						Subject:
					</label>
					<input
						type="text"
						id="email-subject"
						bind:value={subject}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						required
					/>
				</div>

				<!-- Body Field with Quill Editor -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1.5">
						Message:
					</label>
					<div bind:this={editorElement} class="rounded-lg overflow-hidden border border-[#262a30]"></div>
				</div>

				<!-- Invoice Details Summary -->
				{#if order}
					<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-3 text-sm text-gray-300">
						<p>
							<strong class="text-white">Invoice:</strong> {order.invoice} |
							<strong class="text-white">Amount:</strong> ${order.amount} |
							<strong class="text-white">Days Past Due:</strong> {order.pdCounter}
						</p>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-[#262a30] pt-4">
				<button
					type="button"
					on:click={closeModal}
					class="btn-secondary text-sm"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={sendEmail}
					disabled={!sender || !to || !subject || isLoading}
					class="btn-primary text-sm"
				>
					{#if isLoading}
						Sending...
					{:else}
						Send Email
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.ql-toolbar.ql-snow) {
		background-color: #181b20;
		border-color: #262a30 !important;
		border-top-left-radius: 0.5rem;
		border-top-right-radius: 0.5rem;
	}
	:global(.ql-toolbar.ql-snow .ql-stroke) {
		stroke: #9ca3af !important;
	}
	:global(.ql-toolbar.ql-snow .ql-fill) {
		fill: #9ca3af !important;
	}
	:global(.ql-toolbar.ql-snow .ql-picker) {
		color: #9ca3af !important;
	}
	:global(.ql-toolbar.ql-snow .ql-picker-options) {
		background-color: #181b20 !important;
		border-color: #262a30 !important;
	}
	:global(.ql-toolbar.ql-snow button:hover .ql-stroke),
	:global(.ql-toolbar.ql-snow button.ql-active .ql-stroke) {
		stroke: #84cc16 !important;
	}
	:global(.ql-toolbar.ql-snow button:hover .ql-fill),
	:global(.ql-toolbar.ql-snow button.ql-active .ql-fill) {
		fill: #84cc16 !important;
	}
	:global(.ql-container.ql-snow) {
		background-color: #0e1012;
		color: #e5e7eb;
		border-color: #262a30 !important;
		border-bottom-left-radius: 0.5rem;
		border-bottom-right-radius: 0.5rem;
		min-height: 200px;
		font-size: 14px;
	}
	:global(.ql-editor) {
		min-height: 200px;
		max-height: 300px;
		overflow-y: auto;
	}
	:global(.ql-editor.ql-blank::before) {
		color: #6b7280 !important;
		font-style: normal;
	}
</style>
