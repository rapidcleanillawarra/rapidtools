import { supabase } from '$lib/supabase';
import type { CustomerGroup, PriceGroupProduct } from '../types';

/**
 * Fetches all customer groups from the 'maropost_customer_groups' collection in Firestore.
 */
export async function fetchCustomerGroups(): Promise<CustomerGroup[]> {
	console.log('Fetching customer groups...');
	// Get price groups from the price_groups table
	const { data, error } = await supabase.from('price_groups').select('price_group_id, group_name');

	if (error) {
		console.error('Error fetching customer groups:', error);
		throw new Error('Failed to fetch customer groups');
	}

	const groups = data ? data.map((g) => ({ id: g.price_group_id, name: g.group_name })) : [];

	console.log(`Successfully fetched ${groups.length} customer groups.`);
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
		.from('pricegroups_list')
		.select('*', { count: 'exact' })
		.eq('price_group_id', groupId)
		.eq('price_match', false)
		.neq('price', 0);

	// Apply filters
	for (const key in filters) {
		const value = filters[key as keyof PriceGroupProduct];
		if (value && value.trim() !== '') {
			// Using ilike for case-insensitive search on text fields
			if (key === 'sku' || key === 'multiple') {
				query = query.ilike(key, `%${value}%`);
			} else {
				// Using textSearch for numeric fields. This assumes FTS is enabled on these columns.
				// We construct a query that does prefix matching on each term entered by the user.
				const queryText = value
					.split(' ')
					.filter((v) => v)
					.map((v) => `${v}:*`)
					.join(' & ');

				if (queryText) {
					query = query.textSearch(key, queryText);
				}
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