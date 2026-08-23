<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { db } from '$lib/firebase';
	import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import type { ProductRequest, Brand, Supplier, Category, Markup } from '$lib/types';
	import { userProfile, type UserProfile } from '$lib/userProfile';
	import {
		loadProductRequestImagesBySku,
		persistProductRequestImageDrafts,
		savedImageToDraft,
		toMaropostImages,
		type ProductRequestImage
	} from '$lib/product-request/imageUpload';
	import { updateProductImages } from '$lib/services/products';
	import ProductRequestImages from '../product-request/ProductRequestImages.svelte';
	import Select from 'svelte-select';

	interface SelectOption {
		value: string;
		label: string;
	}

	// API Endpoints
	const brandsUrl =
		'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
	const suppliersUrl =
		'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
	const teamsNotificationUrl =
		'https://prod-41.australiasoutheast.logic.azure.com:443/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Fgu75prN-vWpPg5JKVcWpt3zcOL4V76TI_ssXhgPk8I';
	const customerGroupsUrl =
		'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

	let productRequests: ProductRequest[] = [];
	let brands: SelectOption[] = [];
	let suppliers: SelectOption[] = [];
	let categoriesList: Category[] = [];
	let markupResults: Record<string, Markup[]> = {};
	let customerGroups: CustomerGroup[] = [];
	let loading = false;
	let loadingBrands = false;
	let loadingSuppliers = false;
	let loadingCustomerGroups = false;
	let brandError = '';
	let supplierError = '';
	let customerGroupsError = '';
	let selectedRows: Set<string> = new Set();
	let selectAll = false;
	let deleteLoading = false;
	let submitLoading = false;
	let profile: UserProfile | null = null;
	let previewImage: string | null = null;

	const applyToAllIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
	</svg>`;

	interface SkuToRequestMap {
		[key: string]: ProductRequest[];
	}

	interface ApiItem {
		SKU: string;
		[key: string]: any;
	}

	interface ApiResponseItem {
		InventoryID: string;
		SKU: string;
	}

	interface ApiResponse {
		Item: ApiResponseItem[];
		CurrentTime: string;
		Ack: string;
		message?: string;
	}

	interface ProductRequestPayload {
		SKU: string;
		Model: string;
		Brand: string;
		PrimarySupplier: string;
		DefaultPurchasePrice: number;
		Category: number;
		RRP: number;
		ClientMUP: number;
		RetailMUP: number;
		PriceGroup: number;
		requestor_email: string;
		requestor_firstname: string;
		requestor_lastname: string;
		TaxIncluded: boolean;
		SortOrder1: number;
		SortOrder2: number;
	}

	interface CustomerGroup {
		Group: string;
		GroupID: string;
		Price: string;
		Multiple: string;
		MaximumQuantity: string;
		MinimumQuantity: string;
		MultipleStartQuantity: string;
	}

	interface CustomerGroupsResponse {
		Item: Array<{
			InventoryID: string;
			SKU: string;
			PriceGroups: Array<{
				PriceGroup: CustomerGroup[];
			}>;
		}>;
		CurrentTime: string;
		Ack: string;
	}

	// Function to calculate prices - prioritizes the field that was changed
	function calculatePrices(
		request: ProductRequest,
		changedField?: 'retail_mup' | 'list_price' | 'rrp'
	) {
		const purchasePrice = parseFloat(request.purchase_price?.toString() || '0');

		console.log(`=== CALCULATING PRICES - prioritizing ${changedField || 'general change'} ===`);
		console.log('Input values:', {
			purchase_price: request.purchase_price,
			retail_mup: request.retail_mup,
			list_price: request.list_price,
			rrp: request.rrp
		});

		// Prioritize the field that was changed by the user
		if (
			changedField === 'retail_mup' &&
			request.retail_mup !== undefined &&
			request.retail_mup !== null
		) {
			// User changed retail MUP - use it to calculate list_price and RRP
			if (purchasePrice > 0) {
				request.list_price = parseFloat((purchasePrice * request.retail_mup).toFixed(2));
				request.rrp = parseFloat((request.list_price * 1.1).toFixed(2));
				console.log('Prioritized retail_mup change - calculated list_price and rrp');
			}
		} else if (
			changedField === 'list_price' &&
			request.list_price !== undefined &&
			request.list_price !== null
		) {
			// User changed list price - use it to calculate retail MUP and RRP
			if (purchasePrice > 0) {
				request.retail_mup = parseFloat((request.list_price / purchasePrice).toFixed(2));
				request.rrp = parseFloat((request.list_price * 1.1).toFixed(2));
				console.log('Prioritized list_price change - calculated retail_mup and rrp');
			}
		} else if (changedField === 'rrp' && request.rrp !== undefined && request.rrp !== null) {
			// User changed RRP - use it to calculate list_price, then retail MUP
			request.list_price = parseFloat((request.rrp / 1.1).toFixed(2));
			if (purchasePrice > 0) {
				request.retail_mup = parseFloat((request.list_price / purchasePrice).toFixed(2));
				console.log('Prioritized rrp change - calculated list_price and retail_mup');
			} else {
				console.log(
					'Prioritized rrp change - calculated list_price (no purchase_price for retail_mup)'
				);
			}
		} else {
			// General change (like purchase_price) or no specific field - recalculate based on available data
			if (purchasePrice > 0) {
				// If we have purchase_price and retail_mup, calculate others
				if (request.retail_mup && request.retail_mup > 0) {
					request.list_price = parseFloat((purchasePrice * request.retail_mup).toFixed(2));
					request.rrp = parseFloat((request.list_price * 1.1).toFixed(2));
					console.log('General calc: used purchase_price + retail_mup');
				}
				// If we have purchase_price and list_price, calculate others
				else if (request.list_price && request.list_price > 0) {
					request.retail_mup = parseFloat((request.list_price / purchasePrice).toFixed(2));
					request.rrp = parseFloat((request.list_price * 1.1).toFixed(2));
					console.log('General calc: used purchase_price + list_price');
				}
				// Default case with purchase_price
				else {
					request.retail_mup = 1.0; // Default markup
					request.list_price = parseFloat((purchasePrice * request.retail_mup).toFixed(2));
					request.rrp = parseFloat((request.list_price * 1.1).toFixed(2));
					console.log('General calc: set defaults with purchase_price');
				}
			}
			// If no purchase_price but we have RRP, calculate backwards
			else if (request.rrp && request.rrp > 0) {
				request.list_price = parseFloat((request.rrp / 1.1).toFixed(2));
				console.log('General calc: calculated list_price from rrp (no purchase_price)');
			}
		}

		// Always update client fields to match the main fields
		request.client_price = request.list_price || 0.0;
		request.client_mup = request.retail_mup || 1.0;

		console.log('Final calculated values:', {
			retail_mup: request.retail_mup,
			list_price: request.list_price,
			rrp: request.rrp,
			client_price: request.client_price,
			client_mup: request.client_mup
		});
		console.log('=====================================');

		// Force Svelte reactivity
		productRequests = productRequests;

		// Ensure all values are properly formatted to 2 decimal places
		if (request.purchase_price !== undefined && request.purchase_price !== null) {
			request.purchase_price = parseFloat(request.purchase_price.toFixed(2));
		}
		if (request.retail_mup !== undefined && request.retail_mup !== null) {
			request.retail_mup = parseFloat(request.retail_mup.toFixed(2));
		}
		if (request.list_price !== undefined && request.list_price !== null) {
			request.list_price = parseFloat(request.list_price.toFixed(2));
		} else {
			request.list_price = 0.0;
		}
		if (request.rrp !== undefined && request.rrp !== null) {
			request.rrp = parseFloat(request.rrp.toFixed(2));
		} else {
			request.rrp = 0.0;
		}
		if (request.client_price !== undefined && request.client_price !== null) {
			request.client_price = parseFloat(request.client_price.toFixed(2));
		} else {
			request.client_price = 0.0;
		}
		if (request.client_mup !== undefined && request.client_mup !== null) {
			request.client_mup = parseFloat(request.client_mup.toFixed(2));
		}
	}

	function getMarkupPercent(request: ProductRequest): number | '' {
		if (request.retail_mup === undefined || request.retail_mup === null) return '';
		return parseFloat(((request.retail_mup - 1) * 100).toFixed(2));
	}

	function applyMarkupPercent(request: ProductRequest, rawValue: string) {
		const percent = parseFloat(rawValue);
		if (isNaN(percent)) return;
		request.retail_mup = parseFloat((1 + percent / 100).toFixed(4));
		calculatePrices(request, 'retail_mup');
	}

	function getGPP(request: ProductRequest): number | '' {
		const purchase = parseFloat(request.purchase_price?.toString() || '0');
		const list = parseFloat(request.list_price?.toString() || '0');
		if (purchase <= 0 || list <= 0) return '';
		return parseFloat((((list - purchase) / list) * 100).toFixed(2));
	}

	function applyGPP(request: ProductRequest, rawValue: string) {
		const gpp = parseFloat(rawValue);
		const purchasePrice = parseFloat(request.purchase_price?.toString() || '0');
		if (isNaN(gpp) || purchasePrice <= 0) return;
		if (gpp >= 100) {
			toastError('GPP must be less than 100%');
			productRequests = productRequests;
			return;
		}
		request.list_price = parseFloat((purchasePrice / (1 - gpp / 100)).toFixed(2));
		calculatePrices(request, 'list_price');
	}

	// Function to apply retail MUP to all rows
	function applyRetailMupToAll() {
		if (productRequests.length === 0) {
			toastError('No data rows available');
			return;
		}
		const firstRequest = productRequests[0];
		const retailMupVal = firstRequest.retail_mup;

		productRequests = productRequests.map((req, idx) => {
			if (idx === 0) return req;
			req.retail_mup = retailMupVal;
			calculatePrices(req, 'retail_mup');
			return req;
		});
	}

	// Function to apply category to all rows
	function applyCategoryToAll() {
		if (productRequests.length === 0) {
			toastError('No data rows available');
			return;
		}
		const firstRequest = productRequests[0];
		const categoryVal = firstRequest.category;

		productRequests = productRequests.map((req, idx) => {
			if (idx === 0) return req;
			req.category = categoryVal;
			return req;
		});
	}

	// Function to fetch brands
	async function fetchBrands() {
		loadingBrands = true;
		brandError = '';
		try {
			const response = await fetch(brandsUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			if (
				data.status === 200 &&
				data.message?.Ack === 'Success' &&
				Array.isArray(data.message.Content)
			) {
				brands = data.message.Content.filter(
					(brand: { ContentID: string; ContentName: string }) => brand.ContentName
				)
					.map((brand: { ContentID: string; ContentName: string }) => ({
						value: brand.ContentName,
						label: brand.ContentName
					}))
					.sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
			} else {
				throw new Error('Failed to load brands: Invalid response format');
			}
		} catch (err: unknown) {
			const error = err as Error;
			brandError = error.message || 'Failed to load brands';
			brands = [];
		} finally {
			loadingBrands = false;
		}
	}

	// Function to fetch suppliers
	async function fetchSuppliers() {
		loadingSuppliers = true;
		supplierError = '';
		try {
			const response = await fetch(suppliersUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			const data = await response.json();

			if (data.status === 200 && data.message.Ack === 'Success') {
				suppliers = data.message.Supplier.filter(
					(supplier: { SupplierID: string }) => supplier.SupplierID !== '0'
				)
					.map((supplier: { SupplierID: string }) => ({
						value: supplier.SupplierID,
						label: supplier.SupplierID
					}))
					.sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
			} else {
				throw new Error('Failed to load suppliers: Invalid response format');
			}
		} catch (err: unknown) {
			const error = err as Error;
			supplierError = error.message || 'Failed to load suppliers';
		} finally {
			loadingSuppliers = false;
		}
	}

	// Function to fetch customer groups
	async function fetchCustomerGroups() {
		loadingCustomerGroups = true;
		customerGroupsError = '';
		try {
			const payload = {
				Filter: {
					SKU: 'customer_groups',
					OutputSelector: ['PriceGroups']
				},
				action: 'GetItem'
			};

			const response = await fetch(customerGroupsUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: CustomerGroupsResponse = await response.json();

			if (data.Ack === 'Success' && data.Item && data.Item.length > 0) {
				const priceGroups = data.Item[0].PriceGroups;
				if (priceGroups && priceGroups.length > 0) {
					customerGroups = priceGroups[0].PriceGroup;
					console.log('Fetched customer groups:', customerGroups);
				} else {
					throw new Error('No price groups found in response');
				}
			} else {
				throw new Error('Failed to load customer groups: Invalid response format');
			}
		} catch (err: unknown) {
			const error = err as Error;
			customerGroupsError = error.message || 'Failed to load customer groups';
			customerGroups = [];
			console.error('Error fetching customer groups:', error);
		} finally {
			loadingCustomerGroups = false;
		}
	}

	// Fetch data from APIs
	async function loadData() {
		try {
			const response = await fetch(
				'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({})
				}
			);

			const data = await response.json();

			if (
				data.status === 200 &&
				data.message?.Ack === 'Success' &&
				Array.isArray(data.message.Category)
			) {
				categoriesList = data.message.Category.map(
					(category: { CategoryID: string; CategoryName: string }) => ({
						value: category.CategoryID,
						label: category.CategoryName
					})
				).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
			} else {
				throw new Error('Failed to load categories: Invalid response format');
			}
		} catch (err: unknown) {
			toastError('Failed to load reference data');
		}
	}

	// Load product requests from Firestore
	async function loadProductRequests() {
		try {
			const q = query(collection(db, 'product_requests'), where('status', '==', 'request'));

			const querySnapshot = await getDocs(q);
			productRequests = querySnapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					...data
				};
			}) as ProductRequest[];

			const imagesBySku = await loadProductRequestImagesBySku(productRequests.map((request) => request.sku));
			productRequests = productRequests.map((request) => {
				const images = imagesBySku[request.sku] ?? [];
				return {
					...request,
					images,
					imageDrafts: images.map(savedImageToDraft)
				};
			});

			// Enhanced logging of fetched data
			console.log('=== Fetched Product Requests from Firebase ===');
			console.log('Total requests found:', productRequests.length);
			productRequests.forEach((request, index) => {
				console.log(`Request #${index + 1}:`, {
					id: request.id,
					sku: request.sku,
					product_name: request.product_name,
					brand: request.brand,
					primary_supplier: request.primary_supplier,
					category: request.category,
					purchase_price: request.purchase_price,
					client_mup: request.client_mup,
					retail_mup: request.retail_mup,
					client_price: request.client_price,
					list_price: request.list_price,
					rrp: request.rrp,
					tax_included: request.tax_included,
					requestor_email: request.requestor_email,
					requestor_firstName: request.requestor_firstName,
					requestor_lastName: request.requestor_lastName,
					status: request.status
				});
			});
			console.log('=======================================');
		} catch (err: unknown) {
			toastError('Failed to load product requests');
		}
	}

	// Search markups based on product request terms
	async function searchMarkups() {
		try {
			const brandTerms = productRequests.map((req) => (req.brand || '').trim());
			const supplierTerms = productRequests.map((req) => (req.primary_supplier || '').trim());
			const searchTerms = Array.from(new Set([...brandTerms, ...supplierTerms])).filter(
				(term) => term !== ''
			);

			const markupsSnapshot = await getDocs(collection(db, 'markups'));
			const allMarkups = markupsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			})) as Markup[];

			markupResults = {};
			searchTerms.forEach((term) => {
				markupResults[term] = allMarkups.filter((markup) =>
					markup.brand?.toLowerCase().includes(term.toLowerCase())
				);
			});
		} catch (err: unknown) {
			toastError('Failed to search markups');
		}
	}

	function handleSelectAll() {
		if (selectAll) {
			productRequests.forEach((req) => selectedRows.add(req.id));
		} else {
			selectedRows.clear();
		}
		selectedRows = selectedRows; // trigger reactivity
	}

	async function handleSubmitChecked() {
		if (selectedRows.size === 0) {
			toastError('Please select at least one request');
			return;
		}

		submitLoading = true;
		const successfulSubmits: string[] = [];
		const failedSubmits: string[] = [];

		try {
			const selectedRequests = productRequests.filter((req) => selectedRows.has(req.id));

			const createProductUrl =
				'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

			// Validate all requests first
			const invalidRequests = selectedRequests.filter(
				(request) =>
					!request.sku ||
					!request.product_name ||
					!request.brand ||
					!request.primary_supplier ||
					!request.category ||
					!request.purchase_price ||
					!request.client_mup ||
					!request.retail_mup
			);

			if (invalidRequests.length > 0) {
				invalidRequests.forEach((request) => {
					failedSubmits.push(`${request.sku || 'Unknown SKU'} (missing required fields)`);
				});
			} else {
				const imagesByRequestId: Record<string, ProductRequestImage[]> = {};
				const requestsToSubmit: ProductRequest[] = [];

				for (const request of selectedRequests) {
					const persistResult = await persistProductRequestImageDrafts(
						request.sku,
						request.imageDrafts ?? (request.images ?? []).map(savedImageToDraft),
						request.images ?? [],
						{ requestId: request.id }
					);
					if (persistResult.error) {
						failedSubmits.push(
							`${request.sku || 'Unknown SKU'} (image save failed: ${persistResult.error})`
						);
						continue;
					}
					imagesByRequestId[request.id] = persistResult.images;
					request.images = persistResult.images;
					requestsToSubmit.push(request);
				}

				if (requestsToSubmit.length > 0) {
				// Create a single payload for all valid requests
				const payload = {
					Item: requestsToSubmit.map((request) => {
						// Generate PriceGroups dynamically from customer groups data
						const priceGroups = customerGroups.map((group) => {
							if (group.GroupID === '2') {
								// New Customers group - use client_price
								return {
									Group: group.GroupID,
									Price: parseFloat(request.client_price.toString())
								};
							} else if (group.GroupID === '1') {
								// List Price group - use list_price, fallback to calculated price if missing
								const listPrice =
									request.list_price ||
									(request.purchase_price && request.retail_mup
										? parseFloat((request.purchase_price * request.retail_mup).toFixed(2))
										: 0);
								return {
									Group: group.GroupID,
									Price: parseFloat(listPrice.toString())
								};
							} else {
								// All other groups - use client_price
								return {
									Group: group.GroupID,
									Price: parseFloat(request.client_price.toString())
								};
							}
						});

						const maropostImages = toMaropostImages(imagesByRequestId[request.id] ?? []);

						return {
							SKU: request.sku,
							Model: request.product_name,
							Brand: request.brand,
							PrimarySupplier: request.primary_supplier,
							DefaultPurchasePrice: parseFloat(request.purchase_price.toString()),
							Category: parseInt(request.category, 10),
							RRP: request.rrp
								? parseFloat(request.rrp.toString())
								: request.list_price
									? parseFloat(request.list_price.toString())
									: request.purchase_price && request.retail_mup
										? parseFloat((request.purchase_price * request.retail_mup).toFixed(2))
										: 0,
							Misc02: parseFloat(request.client_mup.toString()),
							Misc09: parseFloat(request.retail_mup.toString()),
							Active: true,
							PriceGroups: {
								PriceGroup: priceGroups
							},
							TaxInclusive: false,
							TaxFreeItem: request.tax_included || false,
							SortOrder1: 99999,
							SortOrder2: 99999,
							...(maropostImages.length > 0
								? {
										Images: {
											Image: maropostImages
										}
									}
								: {})
						};
					}),
					action: 'AddItem'
				};

				console.log('Submitted payload:', payload);
				console.log('Target endpoint:', createProductUrl);
				// Enable API call
				const response = await fetch(createProductUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				const responseData = await response.json();

				// Log the full response structure
				console.log('API Response Structure:', JSON.stringify(responseData, null, 2));

				// Debug the response structure
				console.log('Response analysis:', {
					directAck: responseData.Ack,
					nestedAck: responseData.message?.Ack,
					directMessages: responseData.Messages,
					nestedMessages: responseData.message?.Messages,
					directItem: responseData.Item,
					nestedItem: responseData.message?.Item,
					responseOk: response.ok,
					responseStatus: response.status
				});

				interface MaropostItem {
					SKU: string;
					InventoryID: string;
				}

				interface MaropostResponse {
					status: number;
					message: {
						Ack: string;
						Item: MaropostItem[];
					};
				}

				// Handle both direct response and nested message response structures
				const ackStatus = responseData.Ack || responseData.message?.Ack;
				const messagesData = responseData.Messages || responseData.message?.Messages;
				const itemData = responseData.Item || responseData.message?.Item;

				if (response.ok && (ackStatus === 'Success' || ackStatus === 'Warning')) {
					// Store selected requests data for Teams notification before removing them
					const requestsForNotification = [...requestsToSubmit];
					const failedImageUpdates: string[] = [];

					// Handle existing products (Warning case)
					const existingSkus: string[] = [];
					if (ackStatus === 'Warning' && messagesData?.Warning) {
						messagesData.Warning.forEach((warning: any) => {
							if (warning.Message && warning.Message.includes('SKU already exists')) {
								const skuMatch = warning.Message.match(/SKU already exists - use UpdateItem (.+)/);
								if (skuMatch && skuMatch[1] && typeof skuMatch[1] === 'string') {
									existingSkus.push(skuMatch[1].trim());
								}
							}
						});
					}

					console.log('Extracted existing SKUs:', existingSkus);

					// Map SKUs to their inventory IDs from the response
					const skuToInventoryId: Record<string, string> = {};

					// Handle the Item field - it could be an array, empty string, or null
					if (itemData && Array.isArray(itemData) && itemData.length > 0) {
						console.log('Processing Item array from response:', itemData);
						(itemData as MaropostItem[]).forEach((item) => {
							if (item.SKU && item.InventoryID) {
								skuToInventoryId[item.SKU] = item.InventoryID;
							}
						});
					} else {
						console.log('No Item array in response, Item field:', itemData);
					}

					// For existing SKUs, we'll mark them as processed but note they already existed
					existingSkus.forEach((sku) => {
						skuToInventoryId[sku] = 'existing-product';
					});

					// Log the mapping process
					console.log('Mapped SKU to Inventory IDs:', skuToInventoryId);
					console.log(
						'Response type:',
						ackStatus === 'Warning'
							? 'Warning (some products exist)'
							: 'Success (new products created)'
					);

					for (const request of requestsToSubmit) {
						const inventoryId = skuToInventoryId[request.sku] || 'not-found';
						const isExistingProduct = existingSkus.includes(request.sku);
						const requestImages = toMaropostImages(imagesByRequestId[request.id] ?? []);

						if (isExistingProduct && requestImages.length > 0) {
							try {
								await updateProductImages(request.sku, requestImages);
							} catch (imageError) {
								console.error('Failed to update images for existing SKU:', request.sku, imageError);
								failedImageUpdates.push(request.sku);
							}
						}

						console.log('Would save to Firebase for request ID:', request.id, {
							status: 'product_created',
							product_creation_date: new Date().toISOString(),
							category: request.category,
							client_mup: request.client_mup,
							retail_mup: request.retail_mup,
							client_price: request.client_price,
							rrp: request.rrp,
							tax_included: false,
							approved_by: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User',
							approved_by_email: profile?.email || 'Unknown Email',
							inventory_id: inventoryId,
							product_already_existed: isExistingProduct
						});

						// Enable Firestore update
						const docRef = doc(db, 'product_requests', request.id);
						const updateData: any = {
							status: 'product_created',
							product_creation_date: new Date().toISOString(),
							category: request.category,
							client_mup: request.client_mup,
							retail_mup: request.retail_mup,
							client_price: request.client_price,
							tax_included: request.tax_included || false,
							approved_by: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User',
							approved_by_email: profile?.email || 'Unknown Email',
							inventory_id: inventoryId,
							product_already_existed: isExistingProduct
						};

						// Only include list_price if it exists
						if (request.list_price !== undefined && request.list_price !== null) {
							updateData.list_price = request.list_price;
						}

						// Only include rrp if it exists
						if (request.rrp !== undefined && request.rrp !== null) {
							updateData.rrp = request.rrp;
						}

						await updateDoc(docRef, updateData);

						successfulSubmits.push(
							isExistingProduct ? `${request.sku} (already existed)` : request.sku
						);
					}

					if (failedImageUpdates.length > 0) {
						toastError(
							`Products processed but images failed to save for: ${failedImageUpdates.join(', ')}`
						);
					}

					// Remove from local list and clear selections after processing all requests
					requestsToSubmit.forEach((request) => {
						productRequests = productRequests.filter((req) => req.id !== request.id);
						selectedRows.delete(request.id);
					});

					// Force reactivity updates
					productRequests = productRequests;
					selectedRows = selectedRows;
					selectAll = false;

					// Prepare and send Teams notification using stored data
					const tableRows = requestsForNotification
						.map((request) => {
							const isExisting = existingSkus.includes(request.sku || '');
							const statusIcon = isExisting ? '⚠️' : '✅';
							const sku = request.sku || 'Unknown SKU';
							const productName = request.product_name || 'Unknown Product';
							const brand = request.brand || 'Unknown Brand';
							const supplier = request.primary_supplier || 'Unknown Supplier';
							const clientPrice = request.client_price ? request.client_price.toFixed(2) : '0.00';
							const rrp = request.rrp ? request.rrp.toFixed(2) : '0.00';
							const taxInclusive = request.tax_included || false;

							return `<tr><td><a href="https://www.rapidsupplies.com.au/_cpanel/products/view?sku=${sku}">${sku}</a> ${statusIcon}</td><td>${productName}</td><td>${brand}</td><td>${supplier}</td><td>${clientPrice}</td><td>${rrp}</td><td>${taxInclusive}</td></tr>`;
						})
						.join('');

					const newProductCount = requestsForNotification.filter(
						(r) => r.sku && !existingSkus.includes(r.sku)
					).length;
					const existingProductCount = existingSkus.length;

					let statusMessage = '';
					if (newProductCount > 0 && existingProductCount > 0) {
						statusMessage = `✅${newProductCount} product(s) have been successfully created and ⚠️${existingProductCount} product(s) already existed in the system.`;
					} else if (newProductCount > 0) {
						statusMessage = `✅The following ${newProductCount} product(s) have been successfully created.`;
					} else {
						statusMessage = `⚠️All ${existingProductCount} product(s) already existed in the system.`;
					}

					const firstRequest = requestsForNotification[0];
					const requestorName = firstRequest
						? `${firstRequest.requestor_firstName || 'Unknown'} ${firstRequest.requestor_lastName || 'Name'}`
						: 'Unknown User';
					const requestorEmail = firstRequest?.requestor_email || 'Unknown Email';

					const notificationPayload = {
						action: 'product',
						body: `<h1 class=\"editor-heading-h3\"><b><strong class=\"editor-text-bold\">🔔 </strong></b><b><strong class=\"editor-text-bold\" style=\"color: rgb(65, 117, 5);\">Product Request Processed!</strong></b>✅</h1>
<p class=\"editor-paragraph\">${statusMessage} Approved by <b><strong class=\"editor-text-bold\">${profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User'}</strong></b>👤</p>
<p class=\"editor-paragraph\">👤<b><strong class=\"editor-text-bold\" style=\"color: rgb(139, 87, 42);\">Requestor Information:</strong></b></p>
<p class=\"editor-paragraph\">Name: <b><strong class=\"editor-text-bold\">${requestorName}</strong></b></p>
<p class=\"editor-paragraph\">Email: <b><strong class=\"editor-text-bold\">${requestorEmail}</strong></b></p>
<p class=\"editor-paragraph\">📦<b><strong class=\"editor-text-bold\" style=\"color: rgb(139, 87, 42);\">Processed Products:</strong></b></p>
<p class=\"editor-paragraph\"><small>✅ = Newly Created | ⚠️ = Already Existed</small></p>
<table><thead><tr><th><strong>SKU</strong></th><th><strong>Product Name</strong></th><th><strong>Brand</strong></th><th><strong>Primary Supplier</strong></th><th><strong>Client Price</strong></th><th><strong>RRP</strong></th><th><strong>Tax Inclusive</strong></th></tr></thead><tbody>${tableRows}</tbody></table>`
					};

					console.log('Would send Teams notification:', notificationPayload);

					// Enable Teams notification API call
					try {
						const teamsResponse = await fetch(teamsNotificationUrl, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(notificationPayload)
						});

						if (!teamsResponse.ok) {
							console.error('Failed to send Teams notification:', await teamsResponse.text());
							try {
								toastError('Products processed but failed to send Teams notification');
							} catch (toastErr) {
								console.error('Error showing toast notification:', toastErr);
							}
						} else {
							console.log('Teams notification sent successfully');
						}
					} catch (error) {
						console.error('Error sending Teams notification:', error);
						try {
							toastError('Products processed but failed to send Teams notification');
						} catch (toastErr) {
							console.error('Error showing toast notification:', toastErr);
						}
					}
				} else {
					// Handle other response scenarios (Error, etc.)
					console.error('API Response Error:', responseData);

					if (ackStatus === 'Error' && messagesData?.Error) {
						// Handle specific API errors
						messagesData.Error.forEach((error: any) => {
							console.error('API Error:', error.Message);
						});
						requestsToSubmit.forEach((request) => {
							failedSubmits.push(
								`${request.sku} (API Error: ${messagesData.Error[0]?.Message || 'Unknown error'})`
							);
						});
					} else if (!response.ok) {
						// HTTP response failed
						requestsToSubmit.forEach((request) => {
							failedSubmits.push(`${request.sku} (HTTP Error: ${response.status})`);
						});
					} else {
						// Unknown response format
						requestsToSubmit.forEach((request) => {
							failedSubmits.push(`${request.sku} (Unknown response format)`);
						});
					}
				}
				}
			}

			// Show success message for successful submits
			if (successfulSubmits.length > 0) {
				try {
					const newProducts = successfulSubmits.filter((sku) => !sku.includes('(already existed)'));
					const existingProducts = successfulSubmits.filter((sku) =>
						sku.includes('(already existed)')
					);

					let message = '';
					if (newProducts.length > 0 && existingProducts.length > 0) {
						message = `Successfully processed ${successfulSubmits.length} products: ${newProducts.length} newly created, ${existingProducts.length} already existed`;
					} else if (newProducts.length > 0) {
						message = `Successfully created ${newProducts.length} products: ${newProducts.join(', ')}`;
					} else {
						message = `Processed ${existingProducts.length} products (all already existed in system): ${existingProducts.map((s) => s.replace(' (already existed)', '')).join(', ')}`;
					}

					toastSuccess(message);
				} catch (error) {
					console.error('Error showing success toast:', error);
					// Fallback message without toast
					console.log(`Successfully processed ${successfulSubmits.length} products`);
				}
			}

			// Show error message for failed submits
			if (failedSubmits.length > 0) {
				try {
					if (failedSubmits.length === 1) {
						toastError(`Failed to process product: ${failedSubmits[0]}`);
					} else {
						toastError(
							`Failed to process ${failedSubmits.length} products: ${failedSubmits.join(', ')}`
						);
					}
				} catch (error) {
					console.error('Error showing error toast:', error);
					// Fallback message without toast
					console.error(`Failed to process ${failedSubmits.length} products`);
				}
			}
		} catch (error) {
			console.error('Unexpected error during submission:', error);
			try {
				toastError('Error during submission. Please try again later.');
			} catch (toastErr) {
				console.error('Error showing error toast:', toastErr);
				console.error('Submission failed due to unexpected error');
			}
		} finally {
			submitLoading = false;
			selectedRows = selectedRows;
			productRequests = productRequests;
		}
	}

	async function handleDeleteChecked() {
		if (selectedRows.size === 0) {
			toastError('Please select at least one request');
			return;
		}

		deleteLoading = true;
		const successfulDeletes: string[] = [];
		const failedDeletes: string[] = [];

		try {
			const selectedRequests = productRequests.filter((req) => selectedRows.has(req.id));

			for (const request of selectedRequests) {
				try {
					// Update status to "delete" in Firebase
					const docRef = doc(db, 'product_requests', request.id);
					await updateDoc(docRef, {
						status: 'delete'
					});

					// Remove from local list
					productRequests = productRequests.filter((req) => req.id !== request.id);
					selectedRows.delete(request.id);
					successfulDeletes.push(request.sku || request.id);
				} catch (error) {
					failedDeletes.push(request.sku || request.id);
				}
			}

			// Show success message for successful deletes
			if (successfulDeletes.length > 0) {
				if (successfulDeletes.length === 1) {
					toastSuccess(`Successfully deleted request: ${successfulDeletes[0]}`);
				} else {
					toastSuccess(
						`Successfully deleted ${successfulDeletes.length} requests: ${successfulDeletes.join(', ')}`
					);
				}
			}

			// Show error message for failed deletes
			if (failedDeletes.length > 0) {
				if (failedDeletes.length === 1) {
					toastError(`Failed to delete request: ${failedDeletes[0]}`);
				} else {
					toastError(
						`Failed to delete ${failedDeletes.length} requests: ${failedDeletes.join(', ')}`
					);
				}
			}
		} catch (error) {
			toastError('An unexpected error occurred during deletion. Please try again.');
		} finally {
			deleteLoading = false;
			selectedRows = selectedRows;
			productRequests = productRequests;
		}
	}

	onMount(() => {
		const unsubProfile = userProfile.subscribe((value) => {
			profile = value;
		});

		Promise.all([
			fetchBrands(),
			fetchSuppliers(),
			fetchCustomerGroups(),
			loadData(),
			loadProductRequests(),
			searchMarkups()
		]).then(() => {
			// Ensure client_mup and client_price match retail_mup and list_price for all requests
			productRequests.forEach((request) => {
				// Calculate list_price if it's missing but we have purchase_price and retail_mup
				if (
					(request.list_price === undefined || request.list_price === null) &&
					request.purchase_price &&
					request.retail_mup
				) {
					request.list_price = parseFloat((request.purchase_price * request.retail_mup).toFixed(2));
				}

				request.client_mup = request.retail_mup;
				request.client_price = request.list_price || 0;

				// Calculate retail MUP for any requests that have list_price but no retail MUP
				if (request.list_price && (!request.retail_mup || request.retail_mup === 0)) {
					calculatePrices(request);
				}

				// Ensure rrp has a default value if not present
				if (request.rrp === undefined || request.rrp === null) {
					request.rrp = request.list_price ? parseFloat((request.list_price * 1.1).toFixed(2)) : 0; // Use list_price * 1.1, or 0 if that's also missing
				}

				// Ensure all price fields are properly formatted to 2 decimal places
				calculatePrices(request);
			});

			loading = false;
		});

		return () => {
			unsubProfile();
		};
	});
</script>

<svelte:head>
	<title>Product Request Approval - RapidTools</title>
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') previewImage = null;
	}}
/>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
	<div
		class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8"
		transition:fade
	>
		<div class="flex justify-between items-center mb-6">
			<div>
				<h2 class="text-2xl font-bold text-white tracking-tight">Product Request Approval</h2>
				<p class="mt-1 text-sm text-gray-400">Review, edit, and approve pending product requests.</p>
			</div>
			{#if profile}
				<div class="text-sm text-gray-400">
					<span class="font-medium text-gray-300">Approver:</span>
					<span class="text-lime-400 font-semibold">{profile.firstName} {profile.lastName}</span>
				</div>
			{/if}
		</div>

		<div class="space-y-6">
			<div
				class="flex justify-between items-center sticky top-[64px] bg-[#141619]/95 backdrop-blur-sm border-b border-[#262a30] py-4 z-30"
			>
				<div class="flex items-center gap-3">
					<button
						type="button"
						class="inline-flex min-w-[160px] items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition"
						onclick={handleDeleteChecked}
						disabled={selectedRows.size === 0 || deleteLoading}
					>
						{#if deleteLoading}
							<div
								class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent"
							></div>
							Deleting...
						{:else}
							Delete Selected
						{/if}
					</button>
					{#if selectedRows.size > 0}
						<span class="text-sm text-gray-400">{selectedRows.size} selected</span>
					{/if}
				</div>
				<button
					type="button"
					class="btn-primary flex min-w-[160px] items-center justify-center"
					onclick={handleSubmitChecked}
					disabled={selectedRows.size === 0 || submitLoading}
				>
					{#if submitLoading}
						<div
							class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-950 border-t-transparent"
						></div>
						Submitting...
					{:else}
						Submit Selected
					{/if}
				</button>
			</div>

			<div class="rounded-2xl border border-lime-500/20 bg-lime-500/5 p-4 text-sm text-gray-200 shadow-sm">
				<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<p class="text-base font-semibold text-lime-400">Bulk apply</p>
						<p class="text-xs text-gray-400">Copy the first-row values onto every request below.</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							onclick={applyCategoryToAll}
							class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-[#1f2329] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-400 shadow-sm hover:bg-lime-500/20 hover:border-lime-500/50 transition"
							title="Apply category to all rows"
						>
							{@html applyToAllIcon}
							Category
						</button>
						<button
							type="button"
							onclick={applyRetailMupToAll}
							class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-[#1f2329] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-400 shadow-sm hover:bg-lime-500/20 hover:border-lime-500/50 transition"
							title="Apply Markup % to all rows"
						>
							{@html applyToAllIcon}
							Markup %
						</button>
					</div>
				</div>
			</div>

			{#if productRequests.length === 0}
				<div
					class="rounded-2xl border border-[#262a30] bg-[#141619] px-6 py-16 text-center shadow-xl"
				>
					<p class="font-medium text-gray-300">No pending product requests</p>
					<p class="mt-1 text-sm text-gray-500">New requests will appear here for review.</p>
				</div>
			{:else}
				<div class="rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[1800px] divide-y divide-[#262a30] text-sm">
							<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
								<tr>
									<th class="py-3 pl-6 pr-3 text-left w-10">
										<input
											type="checkbox"
											bind:checked={selectAll}
											onchange={handleSelectAll}
											class="h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]"
										/>
									</th>
									<th class="px-3 py-3 text-left w-32">Requestor</th>
									<th class="px-3 py-3 text-left w-28">SKU</th>
									<th class="px-3 py-3 text-left w-48">Product Name</th>
									<th class="px-3 py-3 text-left w-36">
										Images
										<span
											class="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-gray-500"
											>Optional</span
										>
									</th>
									<th class="px-3 py-3 text-left w-52">Brand</th>
									<th class="px-3 py-3 text-left w-52">Supplier</th>
									<th class="px-3 py-3 text-left w-52">
										<div class="flex items-center gap-2">
											<span>Category</span>
											<button
												type="button"
												onclick={applyCategoryToAll}
												class="inline-flex items-center justify-center p-1 rounded-md text-lime-400 hover:bg-lime-500/20 hover:text-lime-300 transition-colors"
												title="Apply to all rows"
											>
												{@html applyToAllIcon}
											</button>
										</div>
									</th>
									<th class="px-3 py-3 text-left w-28">Purchase Price</th>
									<th class="px-3 py-3 text-left w-24">
										<div class="flex items-center gap-2">
											<span>Markup %</span>
											<button
												type="button"
												onclick={applyRetailMupToAll}
												class="inline-flex items-center justify-center p-1 rounded-md text-lime-400 hover:bg-lime-500/20 hover:text-lime-300 transition-colors"
												title="Apply to all rows"
											>
												{@html applyToAllIcon}
											</button>
										</div>
									</th>
									<th class="px-3 py-3 text-left w-24">GPP</th>
									<th class="px-3 py-3 text-left w-28">List Price</th>
									<th class="px-3 py-3 text-left w-28">RRP</th>
									<th class="py-3 pl-3 pr-6 text-center w-20">Tax Free</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-[#262a30] bg-[#141619]">
								{#each productRequests as request (request.id)}
									<tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
										<td class="py-4 pl-6 pr-3 align-middle">
											<input
												type="checkbox"
												checked={selectedRows.has(request.id)}
												onchange={(event) => {
													const target = event.target as HTMLInputElement;
													if (target.checked) {
														selectedRows.add(request.id);
													} else {
														selectedRows.delete(request.id);
													}
													selectedRows = selectedRows;
												}}
												class="h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]"
											/>
										</td>
										<td class="px-3 py-4 align-middle w-32">
											<span class="text-xs font-medium text-gray-200">
												{request.requestor_firstName}
												{request.requestor_lastName}
											</span>
										</td>
										<td class="px-3 py-4 align-top w-28">
											<label class="sr-only" for={`sku-${request.id}`}>SKU</label>
											<input
												id={`sku-${request.id}`}
												type="text"
												bind:value={request.sku}
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="SKU"
											/>
										</td>
										<td class="px-3 py-4 align-top w-48">
											<label class="sr-only" for={`product-name-${request.id}`}>Product Name</label>
											<input
												id={`product-name-${request.id}`}
												type="text"
												bind:value={request.product_name}
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="Product Name"
											/>
										</td>
										<td class="px-3 py-4 align-top w-36">
											<ProductRequestImages
												bind:images={
													() => request.imageDrafts ?? [],
													(value) => {
														request.imageDrafts = value;
													}
												}
												onPreview={(url) => (previewImage = url)}
												onError={(message) => toastError(message)}
											/>
										</td>
										<td class="px-3 py-4 align-top select-wrapper w-52">
											{#if loadingBrands}
												<div class="h-10 animate-pulse rounded-lg bg-[#1f2329] border border-[#262a30]"></div>
											{:else if brandError}
												<div class="text-sm text-red-400">{brandError}</div>
											{:else}
												<Select
													items={brands}
													value={brands.find((b) => b.value === request.brand) || null}
													placeholder="Select Brand"
													clearable={false}
													containerStyles="position: relative;"
													onchange={(e) => {
														request.brand = e.detail?.value || '';
														searchMarkups();
													}}
												/>
											{/if}
										</td>
										<td class="px-3 py-4 align-top select-wrapper w-52">
											{#if loadingSuppliers}
												<div class="h-10 animate-pulse rounded-lg bg-[#1f2329] border border-[#262a30]"></div>
											{:else if supplierError}
												<div class="text-sm text-red-400">{supplierError}</div>
											{:else}
												<Select
													items={suppliers}
													value={suppliers.find((s) => s.value === request.primary_supplier) || null}
													placeholder="Select Supplier"
													clearable={false}
													containerStyles="position: relative;"
													onchange={(e) => {
														request.primary_supplier = e.detail?.value || '';
													}}
												/>
											{/if}
										</td>
										<td class="px-3 py-4 align-top select-wrapper w-52">
											<Select
												items={categoriesList}
												value={categoriesList.find((c) => c.value === request.category) || null}
												placeholder="Select Category"
												clearable={false}
												containerStyles="position: relative;"
												onchange={(e) => {
													request.category = e.detail?.value || '';
												}}
											/>
										</td>
										<td class="px-3 py-4 align-top w-28">
											<label class="sr-only" for={`purchase-price-${request.id}`}>Purchase Price</label>
											<input
												id={`purchase-price-${request.id}`}
												type="number"
												bind:value={request.purchase_price}
												onblur={() => calculatePrices(request)}
												step="0.01"
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-2 py-1.5 text-xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="0.00"
											/>
										</td>
										<td class="px-3 py-4 align-top w-24">
											<label class="sr-only" for={`markup-percent-${request.id}`}>Markup %</label>
											<input
												id={`markup-percent-${request.id}`}
												type="number"
												value={getMarkupPercent(request)}
												onblur={(event) =>
													applyMarkupPercent(request, (event.target as HTMLInputElement).value)
												}
												step="0.01"
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-2 py-1.5 text-xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="50"
											/>
										</td>
										<td class="px-3 py-4 align-top w-24">
											<label class="sr-only" for={`gpp-${request.id}`}>GPP</label>
											<input
												id={`gpp-${request.id}`}
												type="number"
												value={getGPP(request)}
												onblur={(event) =>
													applyGPP(request, (event.target as HTMLInputElement).value)
												}
												step="0.01"
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-2 py-1.5 text-xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="33.33"
											/>
										</td>
										<td class="px-3 py-4 align-top w-28">
											<label class="sr-only" for={`list-price-${request.id}`}>List Price</label>
											<input
												id={`list-price-${request.id}`}
												type="number"
												bind:value={request.list_price}
												onblur={() => calculatePrices(request, 'list_price')}
												step="0.01"
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-2 py-1.5 text-xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="0.00"
											/>
										</td>
										<td class="px-3 py-4 align-top w-28">
											<label class="sr-only" for={`rrp-${request.id}`}>RRP</label>
											<input
												id={`rrp-${request.id}`}
												type="number"
												bind:value={request.rrp}
												onblur={() => calculatePrices(request, 'rrp')}
												step="0.01"
												class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-2 py-1.5 text-xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
												placeholder="0.00"
											/>
										</td>
										<td class="py-4 pl-3 pr-6 text-center align-middle w-20">
											<label class="sr-only" for={`tax-${request.id}`}>Tax Free</label>
											<input
												id={`tax-${request.id}`}
												type="checkbox"
												bind:checked={request.tax_included}
												onchange={() => calculatePrices(request)}
												class="h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]"
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<div>
				<h3 class="mb-4 text-xl font-bold text-white tracking-tight">Search Results from Markups</h3>
				<div class="rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[720px] divide-y divide-[#262a30] text-sm">
							<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
								<tr>
									<th class="px-6 py-3 text-left">Brand</th>
									<th class="px-6 py-3 text-left">Main Category</th>
									<th class="px-6 py-3 text-left">Sub Category</th>
									<th class="px-6 py-3 text-left">Description</th>
									<th class="px-6 py-3 text-left">RRP Markup</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-[#262a30] bg-[#141619]">
								{#each Object.entries(markupResults) as [term, markups] (term)}
									{#each markups as markup, markupIndex (`${term}-${markup.id ?? markupIndex}`)}
										<tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
											<td class="px-6 py-4 text-gray-200">{markup.brand}</td>
											<td class="px-6 py-4 text-gray-300">{markup.main_category}</td>
											<td class="px-6 py-4 text-gray-300">{markup.sub_category}</td>
											<td class="px-6 py-4 text-gray-300">{markup.description}</td>
											<td class="px-6 py-4 font-medium text-lime-400">{markup.rrp_markup}</td>
										</tr>
									{/each}
								{/each}
							</tbody>
						</table>
					</div>
					{#if Object.values(markupResults).every((markups) => markups.length === 0)}
						<p class="px-6 py-10 text-center text-sm text-gray-500">
							No markup matches for the current brands and suppliers.
						</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

{#if submitLoading || deleteLoading}
	<div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
		<div class="bg-[#141619] border border-[#262a30] p-6 rounded-2xl shadow-2xl text-center">
			<div
				class="animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent mx-auto"
			></div>
			<p class="mt-4 text-gray-300 font-medium">
				{deleteLoading ? 'Deleting requests...' : 'Processing products...'}
			</p>
		</div>
	</div>
{/if}

{#if previewImage}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close image preview"
			onclick={() => (previewImage = null)}
		></button>
		<img
			src={previewImage}
			alt="Product preview"
			class="relative z-10 max-h-[90vh] max-w-[90vw] rounded-xl border border-[#333842] shadow-2xl object-contain"
		/>
	</div>
{/if}

<div id="select-portal"></div>

<style>
	:global(.svelte-select) {
		--height: 38px;
		--border: 1px solid #262a30;
		--border-hover: 1px solid #84cc16;
		--border-focused: 1px solid #a3e635;
		--border-radius: 0.5rem;
		--background: #0e1012;
		--font-size: 0.875rem;
		--padding: 0 0.75rem;
		--placeholder-color: #6b7280;
		--input-color: #e5e7eb;
		--item-color: #e5e7eb;
		--item-hover-bg: #1f2329;
		--item-is-active-bg: #262a30;
		--item-is-active-color: #a3e635;
		--list-background: #141619;
		--list-border: 1px solid #262a30;
		--clear-select-color: #9ca3af;
		width: 100%;
		position: relative;
	}

	:global(.svelte-select .selectContainer) {
		border: var(--border);
		border-radius: var(--border-radius);
		height: var(--height);
		background: var(--background);
		min-height: var(--height);
		padding: 0;
		color: #e5e7eb;
	}

	:global(.svelte-select .items) {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		border: var(--list-border, 1px solid #262a30);
		border-radius: var(--border-radius);
		background: var(--list-background, #141619);
		margin-top: 4px;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.5),
			0 4px 6px -2px rgba(0, 0, 0, 0.4);
		z-index: 999;
		max-height: 300px;
		overflow-y: auto;
		color: #e5e7eb;
	}

	:global(.svelte-select .item) {
		font-size: var(--font-size);
		line-height: 1.25;
		padding: 0.5rem 0.75rem;
		white-space: normal;
		word-break: break-word;
		color: #e5e7eb;
	}

	:global(.svelte-select .item.hover) {
		background-color: #1f2329;
		color: #a3e635;
	}

	:global(.svelte-select .item.active) {
		background-color: #262a30;
		color: #a3e635;
	}

	#select-portal {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 0;
		overflow: visible;
		z-index: 999;
	}

	.select-wrapper {
		position: relative;
		z-index: 10;
	}

	.select-wrapper:focus-within {
		z-index: 20;
	}

	:global(.svelte-select .value-container) {
		padding: var(--padding);
		height: var(--height);
		line-height: var(--height);
		font-size: var(--font-size);
		display: flex;
		align-items: center;
		color: #e5e7eb;
	}

	:global(.svelte-select .selected-item) {
		display: flex;
		align-items: center;
		height: 100%;
		line-height: normal;
		color: #e5e7eb;
	}

	:global(.svelte-select input) {
		font-size: var(--font-size);
		padding: var(--padding);
		height: calc(var(--height) - 2px);
		display: flex;
		align-items: center;
		color: #e5e7eb;
	}

	:global(.svelte-select .placeholder) {
		color: var(--placeholder-color);
		font-size: var(--font-size);
	}

	:global(button:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
