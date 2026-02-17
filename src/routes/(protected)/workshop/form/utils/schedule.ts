/**
 * Schedule utilities for workshop form
 */

/**
 * Get the schedule key based on the action
 * Maps action to the corresponding schedule property name
 */
export function getScheduleKey(action: string): string {
	return action === 'Pickup'
		? 'pickup_schedule'
		: action === 'Repair'
			? 'repair_schedule'
			: action === 'Deliver to Workshop'
				? 'delivery_schedule'
				: 'pickup_schedule';
}

/**
 * Format pickup schedule for display
 * Converts ISO datetime string to readable format like "Sep 17, 2:30 PM"
 */
export function formatPickupSchedule(datetimeString: string): string {
	if (!datetimeString) return '';

	try {
		const date = new Date(datetimeString);

		// Format as "Sep 17, 2:30 PM"
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	} catch (error) {
		console.warn('Error formatting pickup schedule:', error);
		return datetimeString; // Return original string if formatting fails
	}
}

/**
 * Get the minimum date/time for schedule input (current date/time)
 * Returns ISO string for datetime-local input
 */
export function getMinDateTime(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get the schedule label based on the action
 * Returns appropriate label for the schedule input field
 */
export function getScheduleLabel(action: string): string {
	return action === 'Pickup'
		? 'Pickup Schedule'
		: action === 'Repair'
			? 'Repair Schedule'
			: action === 'Deliver to Workshop'
				? 'Delivery Schedule'
				: 'Schedule';
}