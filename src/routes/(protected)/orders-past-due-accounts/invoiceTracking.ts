import { supabase } from '$lib/supabase';
import type { Order, ProcessedOrder } from './pastDueAccounts';

/**
 * Interface for invoice tracking records stored in the database
 */
export interface InvoiceTrackingRecord {
    order_id: string;
    does_exists: boolean;
    completed: boolean;
}

/**
 * Creates tracking records for the given orders
 * 
 * This function generates an array of tracking record objects that will be stored
 * in the database to maintain a persistent record of all past due invoices.
 * 
 * @param orders - Array of processed orders to create tracking records for
 * @returns Array of invoice tracking records
 */
export function createInvoiceTrackingRecords(
    orders: ProcessedOrder[]
): InvoiceTrackingRecord[] {
    return orders.map((order) => ({
        order_id: order.invoice,        // Unique invoice identifier
        does_exists: true,              // Invoice currently exists in external system
        completed: false                // Will be processed/displayed in the UI
    }));
}

/**
 * Synchronizes tracking records to the database using upsert
 * 
 * This function saves all tracking records to the Supabase database. It uses
 * upsert to handle both new records and updates to existing records based on
 * the order_id conflict resolution.
 * 
 * @param records - Array of tracking records to save
 * @returns Promise that resolves when the operation completes
 */
export async function syncTrackingRecordsToDatabase(
    records: InvoiceTrackingRecord[]
): Promise<void> {
    if (records.length === 0) {
        console.log('No tracking records to synchronize');
        return;
    }

    console.log(
        `Synchronizing ${records.length} orders to orders_past_due_accounts_invoice_tracking table`
    );

    try {
        const { error } = await supabase
            .from('orders_past_due_accounts_invoice_tracking')
            .upsert(records, { onConflict: 'order_id' });

        if (error) {
            console.error('Failed to save invoice tracking records:', error);
            throw error;
        }
    } catch (err) {
        console.error('Error saving invoice tracking records:', err);
        throw err;
    }
}

/**
 * Marks invoices that no longer appear in the API response as completed
 * 
 * This function handles cases where invoices are resolved externally (paid,
 * cancelled, etc.) by comparing the current API response with active tracking
 * records and marking any missing invoices as completed.
 * 
 * The process:
 * 1. Gets all order_ids from current API response
 * 2. Queries tracking table for active (uncompleted) records
 * 3. Finds invoices that exist in tracking table but not in current API response
 * 4. Marks those missing invoices as completed
 * 
 * @param allOrders - Array of all orders from the API response (raw Order data)
 * @returns Promise that resolves when the operation completes
 */
export async function markMissingOrdersAsCompleted(allOrders: Order[]): Promise<void> {
    if (!allOrders || allOrders.length === 0) {
        console.log('No orders in API response, skipping cleanup');
        return;
    }

    try {
        // Get all order_ids from current API response
        const currentOrderIds = allOrders.map((order) => order.ID);

        // Query tracking table for active (uncompleted) records
        const { data: allTrackingRecords, error: fetchError } = await supabase
            .from('orders_past_due_accounts_invoice_tracking')
            .select('order_id')
            .eq('completed', false); // Only check records that aren't already completed

        if (fetchError) {
            console.error('Error fetching tracking records:', fetchError);
            throw fetchError;
        }

        if (!allTrackingRecords || allTrackingRecords.length === 0) {
            console.log('No active tracking records found');
            return;
        }

        // Find invoices that exist in tracking table but not in current API response
        const trackedOrderIds = allTrackingRecords.map((record) => record.order_id);
        const missingOrderIds = trackedOrderIds.filter(
            (id: string) => !currentOrderIds.includes(id)
        );

        // Mark missing invoices as completed - they've been resolved externally
        if (missingOrderIds.length > 0) {
            console.log(`Marking ${missingOrderIds.length} missing orders as completed`);

            const { error: updateError } = await supabase
                .from('orders_past_due_accounts_invoice_tracking')
                .update({
                    completed: true,
                    updated_at: new Date().toISOString()
                })
                .in('order_id', missingOrderIds);

            if (updateError) {
                console.error('Error marking missing orders as completed:', updateError);
                throw updateError;
            }
        } else {
            console.log('No missing orders to mark as completed');
        }
    } catch (err) {
        console.error('Error processing missing orders:', err);
        throw err;
    }
}

/**
 * Main orchestrator function for the invoice tracking process
 * 
 * This process maintains a persistent record of all past due invoices in the
 * `orders_past_due_accounts_invoice_tracking` table. This allows the system to:
 * - Track invoice status changes over time
 * - Prevent duplicate processing of the same invoices
 * - Mark invoices as completed when they're resolved externally
 * - Maintain audit trail for compliance and reporting
 * 
 * The process runs in three steps:
 * 1. Create tracking records for current API response
 * 2. Synchronize tracking records to database
 * 3. Clean up resolved invoices by marking them as completed
 * 
 * @param filteredOrders - Orders that passed filtering (will be displayed in UI)
 * @param allOrders - All orders from the API response (used for cleanup)
 * @returns Promise that resolves when all tracking operations complete
 */
export async function processInvoiceTracking(
    filteredOrders: ProcessedOrder[],
    allOrders: Order[]
): Promise<void> {
    try {
        // STEP 1: Create tracking records for current API response
        // For each order that passed filters, create a tracking record to store in database
        const trackingRecords = createInvoiceTrackingRecords(filteredOrders);

        // STEP 2: Synchronize tracking records to database
        // Save all tracking records using upsert to handle new and existing records
        await syncTrackingRecordsToDatabase(trackingRecords);

        // STEP 3: Clean up resolved invoices
        // Mark invoices that no longer appear in API response as completed
        await markMissingOrdersAsCompleted(allOrders);

        console.log('Invoice tracking process completed successfully');
    } catch (error) {
        console.error('Error in invoice tracking process:', error);
        // Don't throw - we want the main data flow to continue even if tracking fails
    }
}
