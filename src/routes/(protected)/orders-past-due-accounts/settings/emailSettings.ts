import { supabase } from '$lib/supabase';

export interface EmailSettings {
	id?: string;
	user_email: string;
	is_global?: boolean;
	default_from: string;
	default_to: string;
	default_cc: string;
	default_bcc: string;
	default_subject: string;
	template_15_25_days: string;
	template_26_40_days: string;
	template_41_59_days: string;
	template_60_plus_days: string;
	created_at?: string;
	updated_at?: string;
	created_by?: string;
}

/**
 * Get default email settings (fallback when DB is unavailable)
 */
export function getDefaultSettings(userEmail: string = ''): EmailSettings {
	return {
		user_email: userEmail,
		is_global: false,
		default_from: 'accounts@rapidcleanillawarra.com.au',
		default_to: '',
		default_cc: '',
		default_bcc: 'mario@rapidcleanillawarra.com.au',
		default_subject: 'Past Due Payment Reminder - Invoice {invoice}',
		template_15_25_days: `Dear {customer},

I hope this email finds you well. This is a friendly reminder that payment for invoice {invoice} in the amount of $\{amount} is now {days} days past due.

We value our relationship with you and understand that payments can sometimes be delayed. Please arrange payment at your earliest convenience to avoid any impact on our continued service.

If you have any questions or need to discuss payment arrangements, please don't hesitate to contact us.

Thank you for your attention to this matter.

Best regards,
Rapid Clean Team`,
		template_26_40_days: `Dear {customer},

This is our second follow-up regarding payment for invoice {invoice} in the amount of $\{amount}, which is now {days} days past due.

We appreciate your business and understand that circumstances can affect payment timing. However, continued delays may result in service interruptions or holds on future orders.

Please arrange payment as soon as possible. If you need to discuss payment arrangements or have any concerns, please contact us immediately.

Thank you for your prompt attention to this matter.

Best regards,
Rapid Clean Team`,
		template_41_59_days: `Dear {customer},

URGENT: Payment for invoice {invoice} in the amount of $\{amount} is now {days} days past due and requires immediate attention.

This extended delay is causing significant concern and may affect our ability to continue providing service. We kindly request that you arrange payment without further delay.

Please contact us immediately if there are any issues preventing payment or if you need to discuss alternative arrangements.

We appreciate your urgent attention to this matter.

Best regards,
Rapid Clean Team`,
		template_60_plus_days: `Dear {customer},

FINAL NOTICE: Payment for invoice {invoice} in the amount of $\{amount} is now {days} days past due.

This prolonged delay is unacceptable and severely impacts our operations. Immediate payment is required to restore service and avoid further escalation.

Please arrange payment TODAY. Contact us immediately if there are legitimate circumstances preventing payment.

We expect your urgent cooperation in this matter.

Best regards,
Rapid Clean Team

NOTE: Continued non-payment may result in collection actions and service termination.`
	};
}

/**
 * Fetch email settings for a specific user, with fallback to global settings
 */
export async function fetchEmailSettings(userEmail: string): Promise<EmailSettings> {
	try {
		// First, try to fetch user-specific settings
		const { data: userSettings, error: userError } = await supabase
			.from('orders_past_due_accounts_email_settings')
			.select('*')
			.eq('user_email', userEmail)
			.single();

		if (!userError && userSettings) {
			return userSettings;
		}

		// If no user settings, fetch global settings
		const { data: globalSettings, error: globalError } = await supabase
			.from('orders_past_due_accounts_email_settings')
			.select('*')
			.eq('is_global', true)
			.single();

		if (!globalError && globalSettings) {
			// Return global settings but with user's email for future saves
			return {
				...globalSettings,
				user_email: userEmail,
				id: undefined // Remove ID so it creates a new record when saved
			};
		}

		// If both fail, return default settings
		console.warn('No settings found in database, using defaults');
		return getDefaultSettings(userEmail);
	} catch (error) {
		console.error('Error fetching email settings:', error);
		return getDefaultSettings(userEmail);
	}
}

/**
 * Save or update email settings for a user
 */
export async function saveEmailSettings(settings: EmailSettings): Promise<{ success: boolean; error?: string }> {
	try {
		// Check if settings already exist for this user
		const { data: existing } = await supabase
			.from('orders_past_due_accounts_email_settings')
			.select('id')
			.eq('user_email', settings.user_email)
			.single();

		if (existing) {
			// Update existing settings
			const { error } = await supabase
				.from('orders_past_due_accounts_email_settings')
				.update({
					default_from: settings.default_from,
					default_to: settings.default_to,
					default_cc: settings.default_cc,
					default_bcc: settings.default_bcc,
					default_subject: settings.default_subject,
					template_15_25_days: settings.template_15_25_days,
					template_26_40_days: settings.template_26_40_days,
					template_41_59_days: settings.template_41_59_days,
					template_60_plus_days: settings.template_60_plus_days,
					updated_at: new Date().toISOString()
				})
				.eq('user_email', settings.user_email);

			if (error) {
				console.error('Error updating settings:', error);
				return { success: false, error: error.message };
			}
		} else {
			// Insert new settings
			const { error } = await supabase
				.from('orders_past_due_accounts_email_settings')
				.insert({
					user_email: settings.user_email,
					is_global: false,
					default_from: settings.default_from,
					default_to: settings.default_to,
					default_cc: settings.default_cc,
					default_bcc: settings.default_bcc,
					default_subject: settings.default_subject,
					template_15_25_days: settings.template_15_25_days,
					template_26_40_days: settings.template_26_40_days,
					template_41_59_days: settings.template_41_59_days,
					template_60_plus_days: settings.template_60_plus_days,
					created_by: settings.user_email
				});

			if (error) {
				console.error('Error inserting settings:', error);
				return { success: false, error: error.message };
			}
		}

		return { success: true };
	} catch (error) {
		console.error('Error saving email settings:', error);
		return { success: false, error: String(error) };
	}
}

/**
 * Get the appropriate template based on PD counter value
 */
export function getTemplateForPdCounter(pdCounter: number, settings: EmailSettings): string {
	if (pdCounter >= 15 && pdCounter <= 25) return settings.template_15_25_days;
	if (pdCounter >= 26 && pdCounter <= 40) return settings.template_26_40_days;
	if (pdCounter >= 41 && pdCounter <= 59) return settings.template_41_59_days;
	if (pdCounter >= 60) return settings.template_60_plus_days;
	// Default to friendly reminder for anything below 15 days
	return settings.template_15_25_days;
}

/**
 * Replace placeholders in template with actual values
 */
export function replacePlaceholders(
	template: string,
	values: {
		customer: string;
		invoice: string;
		amount: string;
		days: number;
	}
): string {
	return template
		.replace(/\{customer\}/g, values.customer)
		.replace(/\{invoice\}/g, values.invoice)
		.replace(/\{amount\}/g, values.amount)
		.replace(/\{days\}/g, String(values.days));
}

/**
 * Get email template with placeholders replaced
 */
export function getEmailTemplate(
	pdCounter: number,
	customer: string,
	invoice: string,
	amount: string,
	settings: EmailSettings
): string {
	const template = getTemplateForPdCounter(pdCounter, settings);
	return replacePlaceholders(template, {
		customer,
		invoice,
		amount,
		days: pdCounter
	});
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
	if (!email) return true; // Empty is allowed for optional fields
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate email settings
 */
export function validateSettings(settings: EmailSettings): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!settings.default_from) {
		errors.push('From email is required');
	} else if (!isValidEmail(settings.default_from)) {
		errors.push('From email is not valid');
	}

	if (settings.default_to && !isValidEmail(settings.default_to)) {
		errors.push('To email is not valid');
	}

	if (settings.default_cc && !isValidEmail(settings.default_cc)) {
		errors.push('CC email is not valid');
	}

	if (settings.default_bcc && !isValidEmail(settings.default_bcc)) {
		errors.push('BCC email is not valid');
	}

	if (!settings.default_subject) {
		errors.push('Subject is required');
	}

	if (!settings.template_15_25_days) {
		errors.push('Template for 15-25 days is required');
	}

	if (!settings.template_26_40_days) {
		errors.push('Template for 26-40 days is required');
	}

	if (!settings.template_41_59_days) {
		errors.push('Template for 41-59 days is required');
	}

	if (!settings.template_60_plus_days) {
		errors.push('Template for 60+ days is required');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

