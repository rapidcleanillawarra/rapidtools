import { db } from '$lib/firebase';
import type { UserProfile } from '$lib/userProfile';
import {
	addDoc,
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	where
} from 'firebase/firestore';
import type { ApiPaymentResult, BatchPayment, PaymentSession, SessionRow } from './types';
import { getSessionTotalAmount, hasValidPayments } from './utils';

const GENERAL_API_ENDPOINT =
	'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

export async function postToGeneralApi(payload: Record<string, unknown>) {
	const response = await fetch(GENERAL_API_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const data = await response.json();
	return { response, data };
}

export async function fetchUserSessions(userId: string): Promise<SessionRow[]> {
	const q = query(
		collection(db, 'payment_sessions'),
		where('userId', '==', userId),
		orderBy('dateCreated', 'desc'),
		limit(5)
	);

	const querySnapshot = await getDocs(q);

	return querySnapshot.docs
		.map((doc) => doc.data() as PaymentSession)
		.filter(hasValidPayments)
		.map((session) => ({
			...session,
			totalAmount: getSessionTotalAmount(session)
		}));
}

export async function fetchOrderDetails(invoiceIds: string[]) {
	const payload = {
		Filter: {
			OrderID: invoiceIds,
			OutputSelector: ['Username', 'GrandTotal', 'OrderPayment', 'ID', 'OrderStatus']
		},
		action: 'GetOrder'
	};

	const { response, data } = await postToGeneralApi(payload);

	if (!response.ok) {
		throw new Error('Failed to fetch order details');
	}

	const uniqueUsernames = [...new Set(data.Order.map((order: { Username: string }) => order.Username))];

	return {
		uniqueUsernames,
		rawResponse: data
	};
}

function buildPaymentRecords(
	result: ApiPaymentResult | null,
	sourcePayments: BatchPayment[],
	paymentMode: 'Credit Payment' | 'Direct Deposit'
) {
	if (!result?.Payment || sourcePayments.length === 0) return [];

	const apiPayments = Array.isArray(result.Payment) ? result.Payment : [result.Payment];

	return apiPayments.flatMap((payment: { OrderID?: string; PaymentID?: string }, index: number) => {
		if (!payment.OrderID || !payment.PaymentID || !sourcePayments[index]) return [];

		return [
			{
				orderId: payment.OrderID,
				paymentId: payment.PaymentID,
				paymentMode,
				amount: Number(sourcePayments[index].amount) || 0,
				dateProcessed: result.CurrentTime || new Date().toISOString()
			}
		];
	});
}

export async function savePaymentSession(
	creditResult: ApiPaymentResult | null,
	directDepositResult: ApiPaymentResult | null,
	creditPayments: BatchPayment[],
	directDepositPayments: BatchPayment[],
	user: { uid: string; email: string | null },
	profile: UserProfile
) {
	const paymentRecords = [
		...buildPaymentRecords(creditResult, creditPayments, 'Credit Payment'),
		...buildPaymentRecords(directDepositResult, directDepositPayments, 'Direct Deposit')
	];

	if (paymentRecords.length === 0) {
		throw new Error('No valid payment records to save - check API responses');
	}

	const invalidRecords = paymentRecords.filter(
		(record) => !record.orderId || !record.paymentId || !record.amount
	);

	if (invalidRecords.length > 0) {
		throw new Error(`${invalidRecords.length} payment records are missing required fields`);
	}

	const sessionData = {
		sessionId: `PS_${Date.now()}`,
		dateCreated: serverTimestamp(),
		userId: user.uid || '',
		userEmail: user.email || '',
		performedBy: {
			firstName: profile.firstName || '',
			lastName: profile.lastName || ''
		},
		payments: paymentRecords.map((record) => ({
			orderId: record.orderId || '',
			paymentId: record.paymentId || '',
			paymentMode: record.paymentMode || '',
			amount: record.amount || 0,
			dateProcessed: record.dateProcessed || new Date().toISOString()
		}))
	};

	const docRef = await addDoc(collection(db, 'payment_sessions'), sessionData);
	return docRef.id;
}

export async function submitCreditPayments(
	creditPayments: BatchPayment[],
	paymentDate: string,
	transactionNotes: { TransactionNote: { Title: string; Description: string }[] }
) {
	const { response, data } = await postToGeneralApi({
		Payment: creditPayments.map((payment) => ({
			OrderID: payment.reference,
			AmountPaid: parseFloat(payment.amount.toString()),
			DatePaid: paymentDate,
			IsCreditPayment: true,
			TransactionNotes: transactionNotes
		})),
		action: 'AddPayment'
	});

	if (!response.ok) {
		throw new Error(`Failed to process credit payments: ${data.message || 'Unknown error'}`);
	}

	return data as ApiPaymentResult;
}

export async function submitDirectDepositPayments(
	directDepositPayments: BatchPayment[],
	paymentDate: string,
	transactionNotes: { TransactionNote: { Title: string; Description: string }[] }
) {
	const { response, data } = await postToGeneralApi({
		Payment: directDepositPayments.map((payment) => ({
			OrderID: payment.reference,
			PaymentMethodName: 'Direct Deposit',
			CardAuthorisation: Math.floor(Math.random() * 1000000000).toString(),
			AmountPaid: parseFloat(payment.amount.toString()),
			DatePaid: paymentDate,
			IsCreditPayment: false,
			TransactionNotes: transactionNotes
		})),
		action: 'AddPayment'
	});

	if (!response.ok) {
		throw new Error(`Failed to process direct deposit payments: ${data.message || 'Unknown error'}`);
	}

	return data as ApiPaymentResult;
}

export async function calculateBalancesFromOrders(
	payments: BatchPayment[],
	invoiceIds: string[]
): Promise<BatchPayment[]> {
	const orderResponse = await fetchOrderDetails(invoiceIds);
	const orders = orderResponse?.rawResponse?.Order;

	if (!orders) return payments;

	const balanceMap = new Map<string, number>();
	const orderStatusMap = new Map<string, string>();

	for (const order of orders) {
		const grandTotal = parseFloat(order.GrandTotal) || 0;
		const orderPayments = order.OrderPayment || [];
		const totalPaid = orderPayments.reduce(
			(sum: number, payment: { Amount?: string }) => sum + (parseFloat(payment.Amount ?? '') || 0),
			0
		);

		balanceMap.set(order.ID, grandTotal - totalPaid);
		orderStatusMap.set(order.ID, order.OrderStatus ?? '');
	}

	return payments.map((payment) => {
		if (payment.reference && balanceMap.has(payment.reference)) {
			return {
				...payment,
				balance: balanceMap.get(payment.reference) || 0,
				orderStatus: orderStatusMap.get(payment.reference) || ''
			};
		}
		return payment;
	});
}
