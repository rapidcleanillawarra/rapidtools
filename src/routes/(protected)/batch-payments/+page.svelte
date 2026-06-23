<script lang="ts">
	import { fade } from 'svelte/transition';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import {
		calculateBalancesFromOrders,
		fetchUserSessions,
		savePaymentSession,
		submitCreditPayments,
		submitDirectDepositPayments
	} from './api';
	import NotificationBanner from './components/NotificationBanner.svelte';
	import PaymentDetailsModal from './components/PaymentDetailsModal.svelte';
	import PaymentsTable from './components/PaymentsTable.svelte';
	import PaymentToolbar from './components/PaymentToolbar.svelte';
	import PaymentTotalsBar from './components/PaymentTotalsBar.svelte';
	import TransactionHistoryModal from './components/TransactionHistoryModal.svelte';
	import type { ApiPaymentResult, BatchPayment, NotificationState, SessionRow } from './types';
	import { computePaymentTotals, createEmptyPayment } from './utils';

	let payments: BatchPayment[] = [createEmptyPayment()];
	let isLoading = false;
	let notification: NotificationState = { show: false, message: '', type: 'info' };
	let userSessions: SessionRow[] = [];
	let isModalOpen = false;
	let isPaymentDetailsModalOpen = false;
	let selectedSession: SessionRow | null = null;
	let paymentDate = '';

	$: paymentTotals = computePaymentTotals(payments);
	$: totalBalance = paymentTotals.totalBalance;
	$: totalPayments = paymentTotals.totalPayments;
	$: paymentDifference = totalBalance - totalPayments;

	function addPayment() {
		payments = [...payments, createEmptyPayment()];
	}

	function removePayment(index: number) {
		payments = payments.filter((_, i) => i !== index);
	}

	function applyPaymentModeToAll() {
		if (payments.length === 0) return;

		const firstPaymentMode = payments[0].paymentMode;
		payments = payments.map((payment) => ({
			...payment,
			paymentMode: firstPaymentMode
		}));
	}

	function applyBalanceToPayments() {
		payments = payments.map((payment) => ({
			...payment,
			amount: payment.balance || 0
		}));
	}

	async function loadUserSessions() {
		if (!$currentUser) return;

		try {
			userSessions = await fetchUserSessions($currentUser.uid);
		} catch (error) {
			console.error('Error fetching user payment sessions:', error);
		}
	}

	async function toggleModal() {
		isModalOpen = !isModalOpen;

		if (isModalOpen && $currentUser) {
			await loadUserSessions();
		}
	}

	function showPaymentDetails(session: SessionRow) {
		selectedSession = session;
		isPaymentDetailsModalOpen = true;
	}

	function closePaymentDetailsModal() {
		isPaymentDetailsModalOpen = false;
		selectedSession = null;
	}

	async function handleSubmit() {
		if (!paymentDate) {
			notification = {
				show: true,
				message: 'Please select a payment date before submitting.',
				type: 'error'
			};
			return;
		}

		isLoading = true;
		let creditResult: ApiPaymentResult | null = null;
		let directDepositResult: ApiPaymentResult | null = null;

		try {
			if (!$userProfile?.firstName || !$userProfile?.lastName) {
				throw new Error('User profile information not found. Please complete your profile first.');
			}

			if (!$currentUser) {
				throw new Error('User information not available');
			}

			const processedBy = `${$userProfile.firstName} ${$userProfile.lastName}`;
			const currentTime = new Date().toLocaleString('en-AU', {
				timeZone: 'Australia/Sydney',
				weekday: 'long',
				month: 'long',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit',
				hour12: true
			});

			const creditPayments = payments.filter((p) => p.paymentMode === 'Credit Payment');
			const directDepositPayments = payments.filter((p) => p.paymentMode === 'Direct Deposit');

			const transactionNotes = {
				TransactionNote: [
					{ Title: 'Processed By', Description: processedBy },
					{ Title: 'Accurate Date of Processing', Description: currentTime }
				]
			};

			if (creditPayments.length > 0) {
				creditResult = await submitCreditPayments(creditPayments, paymentDate, transactionNotes);
			}

			if (directDepositPayments.length > 0) {
				directDepositResult = await submitDirectDepositPayments(
					directDepositPayments,
					paymentDate,
					transactionNotes
				);
			}

			const sessionId = await savePaymentSession(
				creditResult,
				directDepositResult,
				creditPayments,
				directDepositPayments,
				$currentUser,
				$userProfile
			);

			await loadUserSessions();

			const paymentCount = creditPayments.length + directDepositPayments.length;

			notification = {
				show: true,
				message: `✅ Successfully processed ${creditPayments.length} credit payment(s) and ${directDepositPayments.length} direct deposit(s)
        
📊 Transaction Summary:
• Session ID: ${sessionId}
• Total Payments: ${paymentCount}
• Total Amount: $${totalPayments.toFixed(2)}
• Processed by: ${$userProfile.firstName} ${$userProfile.lastName}
• Date: ${new Date().toLocaleDateString()}`,
				type: 'success'
			};
		} catch (error) {
			console.error('Error:', error);
			notification = {
				show: true,
				message: error instanceof Error ? error.message : 'Failed to process payments',
				type: 'error'
			};
		} finally {
			isLoading = false;
		}
	}

	async function handlePaste(
		event: CustomEvent<{ event: ClipboardEvent; index: number; field: 'reference' | 'amount' }>
	) {
		const { event: clipboardEvent, index, field } = event.detail;
		clipboardEvent.preventDefault();

		const clipboardData = clipboardEvent.clipboardData?.getData('text') || '';
		if (!clipboardData) return;

		const lines = clipboardData
			.split(/[\n\r]/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		if (lines.length === 0) return;

		const updatedPayments = [...payments];

		for (const [lineIndex, line] of lines.entries()) {
			const values = line.split(/[\t\s]+/).filter((val) => val.length > 0);
			if (values.length === 0) continue;

			const currentIndex = index + lineIndex;

			while (updatedPayments.length <= currentIndex) {
				updatedPayments.push(createEmptyPayment());
			}

			const currentPayment = { ...updatedPayments[currentIndex] };

			if (field === 'reference') {
				currentPayment.reference = values[0];
				if (values[1]) {
					const amount = parseFloat(values[1].replace(/[^0-9.-]+/g, ''));
					if (!isNaN(amount)) currentPayment.amount = amount;
				}
			} else {
				const amount = parseFloat(values[0].replace(/[^0-9.-]+/g, ''));
				if (!isNaN(amount)) currentPayment.amount = amount;
				if (values[1]) currentPayment.reference = values[1];
			}

			updatedPayments[currentIndex] = currentPayment;
		}

		payments = updatedPayments;
		await fetchAndCalculateBalances();
	}

	async function fetchAndCalculateBalances() {
		try {
			const invoiceIds = payments
				.map((payment) => payment.reference)
				.filter((ref) => ref.trim() !== '');

			if (invoiceIds.length === 0) return;

			payments = await calculateBalancesFromOrders(payments, invoiceIds);
		} catch (error) {
			console.error('Error fetching order details and calculating balances:', error);
			notification = {
				show: true,
				message: 'Failed to fetch order details and calculate balances',
				type: 'error'
			};
		}
	}
</script>

<div class="container mx-auto px-4 py-8" in:fade>
	<PaymentToolbar
		bind:paymentDate
		{isLoading}
		on:transactionHistory={toggleModal}
		on:submit={handleSubmit}
	/>

	<NotificationBanner show={notification.show} message={notification.message} type={notification.type} />

	{#if isModalOpen}
		<TransactionHistoryModal
			sessions={userSessions}
			on:close={toggleModal}
			on:selectSession={(event) => showPaymentDetails(event.detail)}
		/>
	{/if}

	{#if isPaymentDetailsModalOpen && selectedSession}
		<PaymentDetailsModal session={selectedSession} on:close={closePaymentDetailsModal} />
	{/if}

	<PaymentTotalsBar {totalBalance} {totalPayments} {paymentDifference} />

	<PaymentsTable
		bind:payments
		on:paste={handlePaste}
		on:remove={(event) => removePayment(event.detail)}
		on:applyPaymentModeToAll={applyPaymentModeToAll}
		on:applyBalanceToPayments={applyBalanceToPayments}
		on:addPayment={addPayment}
	/>
</div>
