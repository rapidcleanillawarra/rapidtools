import { supabase } from '$lib/supabase';
import type { CustomerGroup, PriceGroupProduct } from '../types';

/**
 * Fetches all customer groups from the 'maropost_customer_groups' collection in Firestore.
 */
export async function fetchCustomerGroups(): Promise<CustomerGroup[]> {
	console.log('Fetching customer groups...');
	// Get unique price groups from the summary table
	const { data, error } = await supabase.from('pricegroups_summary').select('price_group_id, group_name');

	if (error) {
		console.error('Error fetching customer groups:', error);
		throw new Error('Failed to fetch customer groups');
	}

	// Get unique groups by using a Map to ensure uniqueness by id
	const uniqueGroupsMap = new Map();
	data.forEach((group) => {
		if (!uniqueGroupsMap.has(group.price_group_id)) {
			uniqueGroupsMap.set(group.price_group_id, { id: group.price_group_id, name: group.group_name });
		}
	});

	const groups = Array.from(uniqueGroupsMap.values());
	console.log(`Successfully fetched ${groups.length} unique customer groups.`);
	return groups;
}

/**
 * Fetches products associated with a specific customer group.
 *
 * This is a placeholder. In a real application, you would have a specific query
 * to fetch products linked to the given customerGroupId. This might involve:
 * - A subcollection on the customer group document.
 * - A linking collection (e.g., 'customer_group_products').
 * - An array of product IDs on the customer group document.
 *
 * For now, it fetches all products from a generic 'products' collection
 * and should be adapted once the data structure is finalized.
 */
export async function fetchProductsForGroup(
	groupId: number,
	page: number,
	itemsPerPage: number,
	sort: { field: keyof PriceGroupProduct | ''; direction: 'asc' | 'desc' },
	filters: Partial<Record<keyof PriceGroupProduct, string>>
): Promise<{ data: PriceGroupProduct[]; count: number }> {
	console.log('Fetching products for group:', { groupId, page, itemsPerPage, sort, filters });

	const from = (page - 1) * itemsPerPage;
	const to = from + itemsPerPage - 1;

	let query = supabase
		.from('pricegroups_summary')
		.select('*', { count: 'exact' })
		.eq('price_group_id', groupId);

	// Apply filters
	for (const key in filters) {
		const value = filters[key as keyof PriceGroupProduct];
		if (value) {
			// Using ilike for case-insensitive search on text fields
			if (key === 'sku' || key === 'multiple') {
				query = query.ilike(key, `%${value}%`);
			} else {
				// Using textSearch for numeric fields after casting them to text, not ideal but works for basic search
				query = query.textSearch(key, `'${value}'`);
			}
		}
	}

	// Apply sorting
	if (sort.field) {
		// Handle the special case for sorting by the existence of multilevel bands
		if (sort.field === 'multilevel_bands') {
			// Sorts by whether the column is null or not. `nullsFirst: false` puts non-null values first in ascending order.
			query = query.order(sort.field, { ascending: sort.direction === 'asc', nullsFirst: false });
		} else {
			query = query.order(sort.field, { ascending: sort.direction === 'asc' });
		}
	}

	// Apply pagination
	query = query.range(from, to);

	const { data, error, count } = await query;

	if (error) {
		console.error('Error fetching products:', error);
		throw new Error('Failed to fetch products');
	}

	console.log(`Successfully fetched ${data?.length} products. Total count: ${count}`);
	return { data: data || [], count: count || 0 };
} 