import type { BatchPayment, PaymentSession } from './types';

let nextPaymentId = 1;

export function createEmptyPayment(): BatchPayment {
	return {
		id: nextPaymentId++,
		reference: '',
		amount: 0,
		paymentMode: 'Direct Deposit',
		isOverCredit: false,
		creditError: '',
		balance: 0
	};
}

export function getPaymentRemaining(payment: BatchPayment): number {
	return (payment.balance || 0) - (payment.amount || 0);
}

export function hasValidPayments(session: PaymentSession): boolean {
	return Array.isArray(session.payments) && session.payments.length > 0;
}

export function getSessionTotalAmount(session: PaymentSession): number {
	return session.payments?.reduce((total, payment) => total + (payment.amount || 0), 0) ?? 0;
}

export function computePaymentTotals(payments: BatchPayment[]) {
	return payments.reduce(
		(acc, payment) => ({
			totalBalance: acc.totalBalance + (payment.balance || 0),
			totalPayments: acc.totalPayments + (payment.amount || 0)
		}),
		{ totalBalance: 0, totalPayments: 0 }
	);
}

export function formatSessionDate(
	dateCreated: PaymentSession['dateCreated']
): string {
	return dateCreated?.toDate ? dateCreated.toDate().toLocaleString() : 'N/A';
}
