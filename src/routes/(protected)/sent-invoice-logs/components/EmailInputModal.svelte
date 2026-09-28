<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';

	const dispatch = createEventDispatcher<{
		close: void;
		submit: { email: string };
	}>();

	export let show = false;

	let email = '';
	let isSubmitting = false;

	function close() {
		email = '';
		dispatch('close');
	}

	function submit() {
		if (!email.trim()) return;

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email.trim())) {
			alert('Please enter a valid email address');
			return;
		}

		isSubmitting = true;

		try {
			dispatch('submit', { email: email.trim() });
			email = '';
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !isSubmitting) {
			submit();
		}
	}
</script>

<Modal {show} on:close={close} size="md">
	<span slot="header">Email Address Required</span>
	<div slot="body">
		<div class="space-y-4">
			<div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-gray-200">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-semibold text-amber-300">
							Email Address Required
						</h3>
						<div class="mt-1 text-sm text-gray-300">
							<p>The order and customer records do not have an email address. Please provide an email address to send the invoice.</p>
						</div>
					</div>
				</div>
			</div>

			<div>
				<label for="email-input" class="form-label">
					Email Address <span class="text-red-400">*</span>
				</label>
				<div class="mt-1">
					<input
						id="email-input"
						type="email"
						bind:value={email}
						on:keydown={handleKeydown}
						placeholder="customer@example.com"
						class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 transition-colors"
						required
					/>
				</div>
			</div>
		</div>
	</div>
	<div slot="footer" class="flex justify-end gap-3">
		<button
			type="button"
			on:click={close}
			class="btn-secondary text-sm"
		>
			Cancel
		</button>
		<button
			type="button"
			on:click={submit}
			disabled={!email.trim() || isSubmitting}
			class="btn-primary text-sm flex items-center gap-2"
		>
			{#if isSubmitting}
				<svg class="h-4 w-4 animate-spin text-gray-950" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Processing…
			{:else}
				Submit
			{/if}
		</button>
	</div>
</Modal>