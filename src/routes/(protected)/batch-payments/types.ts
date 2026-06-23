export interface BatchPayment {
	id: number;
	reference: string;
	amount: number;
	paymentMode: 'Direct Deposit' | 'Credit Payment';
	isOverCredit?: boolean;
	creditError?: string;
	balance?: number;
}

export interface SessionPayment {
	orderId: string;
	paymentId: string;
	paymentMode: string;
	amount: number;
	dateProcessed: string;
}

export interface PaymentSession {
	sessionId: string;
	dateCreated: { toDate?: () => Date } | null | undefined;
	userId: string;
	userEmail: string;
	performedBy: {
		firstName: string;
		lastName: string;
	};
	payments: SessionPayment[];
}

export interface SessionRow extends PaymentSession {
	totalAmount: number;
}

export interface NotificationState {
	show: boolean;
	message: string;
	type: string;
}

export interface ApiPaymentResult {
	Payment?: unknown;
	CurrentTime?: string;
	message?: string;
}
