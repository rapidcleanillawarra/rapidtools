<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
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
	const categoriesUrl =
		'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

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

	type PricingMethod = 'markup' | 'gpp' | 'list' | 'rrp';
	type PricingTrigger = PricingMethod | 'purchase' | 'tax';

	interface PricingIntent {
		method: PricingMethod;
		markupPercent: number;
		gppPercent: number;
		listPrice: number;
		rrp: number;
	}

	const GST_RATE = 0.1;
	const DEC_SCALE = 8n;
	const DEC_BASE = 10n ** DEC_SCALE;
	const pricingIntentById = new Map<string, PricingIntent>();

	function decimalFromNumber(value: number): bigint {
		if (!Number.isFinite(value)) return 0n;
		const negative = value < 0;
		const [intPart, frac = ''] = Math.abs(value).toFixed(Number(DEC_SCALE)).split('.');
		const raw = BigInt(intPart) * DEC_BASE + BigInt(frac);
		return negative ? -raw : raw;
	}

	function mulDec(a: bigint, b: bigint): bigint {
		return (a * b) / DEC_BASE;
	}

	function divDec(a: bigint, b: bigint): bigint {
		if (b === 0n) return 0n;
		return (a * DEC_BASE) / b;
	}

	function addDec(a: bigint, b: bigint): bigint {
		return a + b;
	}

	function subDec(a: bigint, b: bigint): bigint {
		return a - b;
	}

	function roundHalfUpDec(value: bigint, decimals: number): number {
		const factor = 10n ** (DEC_SCALE - BigInt(decimals));
		const half = factor / 2n;
		const sign = value < 0n ? -1n : 1n;
		const abs = value < 0n ? -value : value;
		const roundedUnits = (abs + half) / factor;
		return Number(sign * roundedUnits) / 10 ** decimals;
	}

	function toNumberDec(value: bigint): number {
		return Number(value) / Number(DEC_BASE);
	}

	function numericOrZero(value: number | undefined | null): number {
		return typeof value === 'number' && Number.isFinite(value) ? value : 0;
	}

	function getTaxRate(request: ProductRequest): number {
		return request.tax_included ? 0 : GST_RATE;
	}

	function getPurchase(request: ProductRequest): number {
		const purchase = numericOrZero(request.purchase_price);
		return roundHalfUpDec(decimalFromNumber(purchase), 4);
	}

	function ensurePricingIntent(request: ProductRequest): PricingIntent {
		const existing = pricingIntentById.get(request.id);
		if (existing) return existing;

		const purchase = getPurchase(request);
		const list = numericOrZero(request.list_price);
		const retailMup = numericOrZero(request.retail_mup);
		const intent: PricingIntent = {
			method: list > 0 ? 'list' : 'markup',
			markupPercent:
				purchase > 0 && list > 0
					? toNumberDec(mulDec(divDec(subDec(decimalFromNumber(list), decimalFromNumber(purchase)), decimalFromNumber(purchase)), decimalFromNumber(100)))
					: retailMup > 0
						? toNumberDec(mulDec(subDec(decimalFromNumber(retailMup), decimalFromNumber(1)), decimalFromNumber(100)))
						: 0,
			gppPercent:
				purchase > 0 && list > 0
					? toNumberDec(mulDec(divDec(subDec(decimalFromNumber(list), decimalFromNumber(purchase)), decimalFromNumber(list)), decimalFromNumber(100)))
					: 0,
			listPrice: list,
			rrp: numericOrZero(request.rrp)
		};
		pricingIntentById.set(request.id, intent);
		return intent;
	}

	function markupFromGpp(gppPercent: number): number {
		const remainder = subDec(decimalFromNumber(100), decimalFromNumber(gppPercent));
		if (remainder === 0n) return 0;
		return toNumberDec(mulDec(divDec(decimalFromNumber(gppPercent), remainder), decimalFromNumber(100)));
	}

	function gppFromMarkup(markupPercent: number): number {
		const divisor = addDec(decimalFromNumber(100), decimalFromNumber(markupPercent));
		if (divisor === 0n) return 0;
		return toNumberDec(mulDec(divDec(decimalFromNumber(markupPercent), divisor), decimalFromNumber(100)));
	}

	function percentsFromListAndPurchase(listPrice: number, purchase: number) {
		const listDec = decimalFromNumber(listPrice);
		const purchaseDec = decimalFromNumber(purchase);
		const hundred = decimalFromNumber(100);
		return {
			markupPercent:
				purchase > 0
					? toNumberDec(mulDec(divDec(subDec(listDec, purchaseDec), purchaseDec), hundred))
					: 0,
			gppPercent:
				listPrice > 0
					? toNumberDec(mulDec(divDec(subDec(listDec, purchaseDec), listDec), hundred))
					: 0
		};
	}

	function displayPercent(value: number): number {
		return roundHalfUpDec(decimalFromNumber(value), 2);
	}

	function listFromActiveMethod(purchase: number, taxRate: number, intent: PricingIntent): number {
		const purchaseDec = decimalFromNumber(purchase);
		const one = decimalFromNumber(1);
		const hundred = decimalFromNumber(100);

		if (intent.method === 'markup') {
			const factor = addDec(one, divDec(decimalFromNumber(intent.markupPercent), hundred));
			return toNumberDec(mulDec(purchaseDec, factor));
		}

		if (intent.method === 'gpp') {
			const remainder = subDec(one, divDec(decimalFromNumber(intent.gppPercent), hundred));
			if (remainder <= 0n) return intent.listPrice;
			return toNumberDec(divDec(purchaseDec, remainder));
		}

		if (intent.method === 'rrp') {
			const divisor = addDec(one, decimalFromNumber(taxRate));
			return toNumberDec(divDec(decimalFromNumber(intent.rrp), divisor));
		}

		return intent.listPrice;
	}

	function syncDerivedPrices(request: ProductRequest, listPrice: number) {
		const purchase = getPurchase(request);
		const taxRate = getTaxRate(request);
		const listDec = decimalFromNumber(listPrice);
		const intent = ensurePricingIntent(request);

		if (intent.method === 'markup') {
			intent.gppPercent = gppFromMarkup(intent.markupPercent);
		} else if (intent.method === 'gpp') {
			intent.markupPercent = markupFromGpp(intent.gppPercent);
		} else {
			const actual = percentsFromListAndPurchase(listPrice, purchase);
			intent.markupPercent = actual.markupPercent;
			intent.gppPercent = actual.gppPercent;
		}

		const rrp = roundHalfUpDec(
			mulDec(listDec, addDec(decimalFromNumber(1), decimalFromNumber(taxRate))),
			2
		);
		const retailMup =
			purchase > 0
				? toNumberDec(divDec(listDec, decimalFromNumber(purchase)))
				: numericOrZero(request.retail_mup) || 1;

		request.purchase_price = purchase;
		request.list_price = listPrice;
		request.rrp = rrp;
		request.retail_mup = retailMup;
		request.client_price = listPrice;
		request.client_mup = retailMup;

		if (intent.method !== 'list') intent.listPrice = listPrice;
		intent.rrp = rrp;
	}

	function calculatePrices(request: ProductRequest, trigger: PricingTrigger = 'purchase') {
		const intent = ensurePricingIntent(request);
		const purchase = getPurchase(request);
		const taxRate = getTaxRate(request);

		if (trigger === 'markup' || trigger === 'gpp' || trigger === 'list' || trigger === 'rrp') {
			intent.method = trigger;
		}

		let listPrice =
			trigger === 'tax' && intent.method !== 'rrp'
				? numericOrZero(request.list_price)
				: listFromActiveMethod(purchase, taxRate, intent);

		listPrice = roundHalfUpDec(decimalFromNumber(listPrice), 2);
		syncDerivedPrices(request, listPrice);
		productRequests = productRequests;
	}

	function getMarkupPercent(request: ProductRequest): number | '' {
		const intent = ensurePricingIntent(request);
		if (intent.method === 'markup' || intent.method === 'gpp') {
			return displayPercent(intent.markupPercent);
		}
		const purchase = getPurchase(request);
		const list = numericOrZero(request.list_price);
		if (purchase <= 0 || list <= 0) return '';
		return displayPercent(intent.markupPercent);
	}

	function applyMarkupPercent(request: ProductRequest, rawValue: string) {
		const percent = Number(rawValue);
		if (!Number.isFinite(percent)) return;
		const intent = ensurePricingIntent(request);
		intent.method = 'markup';
		intent.markupPercent = percent;
		calculatePrices(request, 'markup');
	}

	function getGPP(request: ProductRequest): number | '' {
		const intent = ensurePricingIntent(request);
		if (intent.method === 'markup' || intent.method === 'gpp') {
			return displayPercent(intent.gppPercent);
		}
		const purchase = getPurchase(request);
		const list = numericOrZero(request.list_price);
		if (purchase <= 0 || list <= 0) return '';
		return displayPercent(intent.gppPercent);
	}

	function applyGPP(request: ProductRequest, rawValue: string) {
		const gpp = Number(rawValue);
		const purchase = getPurchase(request);
		if (!Number.isFinite(gpp) || purchase <= 0) return;
		if (gpp >= 100) {
			toastError('GPP must be less than 100%');
			productRequests = productRequests;
			return;
		}
		const intent = ensurePricingIntent(request);
		intent.method = 'gpp';
		intent.gppPercent = gpp;
		calculatePrices(request, 'gpp');
	}

	function applyListPrice(request: ProductRequest) {
		const list = numericOrZero(request.list_price);
		const intent = ensurePricingIntent(request);
		intent.method = 'list';
		intent.listPrice = list;
		calculatePrices(request, 'list');
	}

	function applyRrp(request: ProductRequest) {
		const rrp = numericOrZero(request.rrp);
		const intent = ensurePricingIntent(request);
		intent.method = 'rrp';
		intent.rrp = rrp;
		calculatePrices(request, 'rrp');
	}

	function applyRetailMupToAll() {
		if (productRequests.length === 0) {
			toastError('No data rows available');
			return;
		}
		const firstIntent = ensurePricingIntent(productRequests[0]);
		const markupPercent = firstIntent.method === 'markup' ? firstIntent.markupPercent : getMarkupPercent(productRequests[0]);
		if (markupPercent === '') {
			toastError('First row does not have a markup to apply');
			return;
		}

		productRequests = productRequests.map((req, idx) => {
			if (idx === 0) return req;
			applyMarkupPercent(req, markupPercent.toString());
			return req;
		});
	}

	function applyGPPToAll() {
		if (productRequests.length === 0) {
			toastError('No data rows available');
			return;
		}
		const firstIntent = ensurePricingIntent(productRequests[0]);
		const gppVal = firstIntent.method === 'gpp' ? firstIntent.gppPercent : getGPP(productRequests[0]);
		if (gppVal === '') {
			toastError('First row does not have a GPP to apply');
			return;
		}

		productRequests = productRequests.map((req, idx) => {
			if (idx === 0) return req;
			applyGPP(req, gppVal.toString());
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

	interface RawContentItem {
		ContentID: string;
		ContentName: string;
		ContentType?: string;
		ContentParentID?: string;
		ParentContentID?: string;
		[key: string]: any;
	}

	function buildCategoryHierarchyOptions(items: RawContentItem[]): Category[] {
		const itemMap = new Map<string, RawContentItem>();
		items.forEach((item) => {
			if (item.ContentID) {
				itemMap.set(String(item.ContentID), item);
			}
		});

		const pathCache = new Map<string, string>();

		function getPath(id: string, visited = new Set<string>()): string {
			if (pathCache.has(id)) return pathCache.get(id)!;
			if (visited.has(id)) return '';

			const item = itemMap.get(id);
			if (!item) return '';

			visited.add(id);
			const parentId = item.ContentParentID || item.ParentContentID;

			let fullPath = item.ContentName;
			if (parentId && parentId !== '0' && parentId !== id && itemMap.has(String(parentId))) {
				const parentPath = getPath(String(parentId), visited);
				if (parentPath) {
					fullPath = `${parentPath} > ${item.ContentName}`;
				}
			}

			pathCache.set(id, fullPath);
			return fullPath;
		}

		return items
			.filter((item) => item.ContentID && item.ContentName)
			.map((item) => {
				const id = String(item.ContentID);
				const fullPath = getPath(id);
				return {
					id,
					name: item.ContentName,
					value: id,
					label: fullPath || item.ContentName
				};
			})
			.sort((a, b) => a.label.localeCompare(b.label));
	}

	// Fetch data from APIs
	async function loadData() {
		console.log('[Page Load] Starting loadData() for categories...');
		try {
			const payload = {
				Filter: {
					Active: true,
					ContentType: 1,
					OutputSelector: ['ContentID', 'ContentName', 'ContentType', 'ContentParentID']
				},
				action: 'GetContent'
			};

			console.log('[Categories] Fetching from URL:', categoriesUrl);
			console.log('[Categories] Request payload:', payload);

			const response = await fetch(categoriesUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			console.log('[Categories] HTTP response status:', response.status, response.statusText);

			if (!response.ok) {
				const errorBody = await response.text();
				console.error('[Categories] HTTP error body:', errorBody);
				throw new Error(`HTTP error! status: ${response.status} - ${errorBody}`);
			}

			const data = await response.json();
			console.log('[Categories] Raw response data:', data);

			const rawContent =
				data.Content || data.message?.Content || data.Category || data.message?.Category;

			if (Array.isArray(rawContent)) {
				categoriesList = buildCategoryHierarchyOptions(rawContent);
				console.log(
					'[Categories] Successfully loaded and mapped categories with hierarchy:',
					categoriesList
				);
			} else {
				console.warn('[Categories] Content array missing from response structure:', data);
				throw new Error('Failed to load categories: Invalid response format');
			}
		} catch (err: unknown) {
			console.error('[Categories] Exception in loadData:', err);
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

	function getMissingFields(request: ProductRequest): string[] {
		const missing: string[] = [];
		if (!request.sku) missing.push('SKU');
		if (!request.product_name) missing.push('Product Name');
		if (!request.brand) missing.push('Brand');
		if (!request.primary_supplier) missing.push('Supplier');
		if (!request.category) missing.push('Category');
		if (!request.purchase_price) missing.push('Purchase Price');
		if (!request.retail_mup) missing.push('Markup %');
		return missing;
	}

	const isDesktopLayout = new MediaQuery('min-width: 1024px');

	const textInputClass =
		'w-full min-w-0 bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors';
	const numberInputClass =
		'w-full min-w-0 bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors';
	const checkboxClass =
		'h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619] cursor-pointer';

	function handleSelectAll() {
		if (selectAll) {
			productRequests.forEach((req) => selectedRows.add(req.id));
		} else {
			selectedRows.clear();
		}
		selectedRows = selectedRows; // trigger reactivity
	}

	function toggleRequestSelected(id: string, checked: boolean) {
		if (checked) {
			selectedRows.add(id);
		} else {
			selectedRows.delete(id);
		}
		selectedRows = selectedRows;
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
					const missingFields = [
						!request.sku && 'sku',
						!request.product_name && 'product_name',
						!request.brand && 'brand',
						!request.primary_supplier && 'primary_supplier',
						!request.category && 'category',
						!request.purchase_price && 'purchase_price',
						!request.client_mup && 'client_mup',
						!request.retail_mup && 'retail_mup'
					].filter(Boolean);

					console.error(`[Product Request Approval] Missing required fields for SKU "${request.sku || 'Unknown SKU'}":`, {
						request,
						missingFields
					});

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
		console.log('[Page Load] onMount triggered in product-request-approval');
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
		])
			.then(() => {
				console.log('[Page Load] Promise.all completed. Categories count in state:', categoriesList.length);
			// Ensure client_mup and client_price match retail_mup and list_price for all requests
			productRequests.forEach((request) => {
				if (
					(request.list_price === undefined || request.list_price === null) &&
					request.purchase_price &&
					request.retail_mup
				) {
					const intent = ensurePricingIntent(request);
					intent.method = 'markup';
					intent.markupPercent = toNumberDec(
						mulDec(subDec(decimalFromNumber(request.retail_mup), decimalFromNumber(1)), decimalFromNumber(100))
					);
					calculatePrices(request, 'markup');
					return;
				}

				const intent = ensurePricingIntent(request);
				if (request.list_price) {
					intent.method = 'list';
					intent.listPrice = request.list_price;
					calculatePrices(request, 'list');
				} else {
					calculatePrices(request, 'markup');
				}
			});

			loading = false;
		}).catch((err) => {
			console.error('[Page Load] Error during onMount Promise.all:', err);
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

<div class="min-h-screen min-w-0 max-w-full overflow-x-hidden py-6 px-2 sm:px-4 lg:px-6">
	<div
		class="min-w-0 max-w-full w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8"
		transition:fade
	>
		<div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0">
				<h2 class="text-2xl font-bold text-white tracking-tight">Product Request Approval</h2>
				<p class="mt-1 text-sm text-gray-400">Review, edit, and approve pending product requests.</p>
			</div>
			{#if profile}
				<div class="shrink-0 text-sm text-gray-400">
					<span class="font-medium text-gray-300">Approver:</span>
					<span class="text-lime-400 font-semibold">{profile.firstName} {profile.lastName}</span>
				</div>
			{/if}
		</div>

		<div class="min-w-0 space-y-6">
			<div
				class="sticky top-14 z-30 flex flex-col-reverse gap-3 border-b border-[#262a30] bg-[#141619]/95 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between lg:top-[64px]"
			>
				<div class="flex min-w-0 flex-wrap items-center gap-3">
					<label
						class="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-[#262a30] bg-[#181b20] px-3.5 py-2 text-sm font-medium text-gray-300 transition hover:border-[#353a43] hover:bg-[#1f2329]"
					>
						<input
							type="checkbox"
							bind:checked={selectAll}
							onchange={handleSelectAll}
							class={checkboxClass}
						/>
						<span>Select All ({productRequests.length})</span>
					</label>

					<button
						type="button"
						class="inline-flex w-full items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 sm:w-auto sm:min-w-[160px]"
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
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-lime-500/20 bg-lime-500/10 px-3 py-1 text-xs font-semibold text-lime-400"
						>
							{selectedRows.size} selected
						</span>
					{/if}
				</div>
				<button
					type="button"
					class="btn-primary flex w-full items-center justify-center sm:w-auto sm:min-w-[160px]"
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
							class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-[#1f2329] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-400 shadow-sm transition hover:border-lime-500/50 hover:bg-lime-500/20"
							title="Apply category to all rows"
						>
							{@html applyToAllIcon}
							Category
						</button>
						<button
							type="button"
							onclick={applyRetailMupToAll}
							class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-[#1f2329] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-400 shadow-sm transition hover:border-lime-500/50 hover:bg-lime-500/20"
							title="Apply Markup % to all rows"
						>
							{@html applyToAllIcon}
							Markup %
						</button>
						<button
							type="button"
							onclick={applyGPPToAll}
							class="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-[#1f2329] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-lime-400 shadow-sm transition hover:border-lime-500/50 hover:bg-lime-500/20"
							title="Apply GPP to all rows"
						>
							{@html applyToAllIcon}
							GPP
						</button>
					</div>
				</div>
			</div>

			{#snippet skuField(request: ProductRequest)}
				<label
					class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
					for={`sku-${request.id}`}
				>
					SKU <span class="text-red-400">*</span>
				</label>
				<input
					id={`sku-${request.id}`}
					type="text"
					bind:value={request.sku}
					class={textInputClass}
					placeholder="e.g. SKU-1234"
				/>
			{/snippet}

			{#snippet productNameField(request: ProductRequest)}
				<label
					class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
					for={`product-name-${request.id}`}
				>
					Product Name <span class="text-red-400">*</span>
				</label>
				<input
					id={`product-name-${request.id}`}
					type="text"
					bind:value={request.product_name}
					class={textInputClass}
					placeholder="Enter product title..."
				/>
			{/snippet}

			{#snippet imagesField(request: ProductRequest)}
				<div class="mb-1.5 flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Images <span class="text-[10px] font-normal normal-case text-gray-500">(Optional)</span>
					</span>
				</div>
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
			{/snippet}

			{#snippet brandField(request: ProductRequest)}
				<div class="mb-1.5 flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Brand <span class="text-red-400">*</span>
					</span>
				</div>
				<div class="select-wrapper min-w-0">
					{#if loadingBrands}
						<div class="h-10 animate-pulse rounded-lg border border-[#262a30] bg-[#1f2329]"></div>
					{:else if brandError}
						<div class="text-sm text-red-400">{brandError}</div>
					{:else}
						<Select
							items={brands}
							value={brands.find((b) => b.value === request.brand) || null}
							placeholder="Select Brand"
							clearable={false}
							containerStyles="position: relative;"
							on:select={(e) => {
								const selectedVal = e.detail?.value || '';
								console.log(`[Product Request Approval] Brand selected for SKU "${request.sku}":`, { event: e, selectedVal });
								request.brand = selectedVal;
								searchMarkups();
							}}
							on:clear={() => {
								request.brand = '';
								searchMarkups();
							}}
						/>
					{/if}
				</div>
			{/snippet}

			{#snippet supplierField(request: ProductRequest)}
				<div class="mb-1.5 flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Supplier <span class="text-red-400">*</span>
					</span>
				</div>
				<div class="select-wrapper min-w-0">
					{#if loadingSuppliers}
						<div class="h-10 animate-pulse rounded-lg border border-[#262a30] bg-[#1f2329]"></div>
					{:else if supplierError}
						<div class="text-sm text-red-400">{supplierError}</div>
					{:else}
						<Select
							items={suppliers}
							value={suppliers.find((s) => s.value === request.primary_supplier) || null}
							placeholder="Select Supplier"
							clearable={false}
							containerStyles="position: relative;"
							on:select={(e) => {
								const selectedVal = e.detail?.value || '';
								console.log(`[Product Request Approval] Supplier selected for SKU "${request.sku}":`, { event: e, selectedVal });
								request.primary_supplier = selectedVal;
							}}
							on:clear={() => {
								request.primary_supplier = '';
							}}
						/>
					{/if}
				</div>
			{/snippet}

			{#snippet categoryField(request: ProductRequest)}
				<div class="mb-1.5 flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Category <span class="text-red-400">*</span>
					</span>
					{#if productRequests.length > 1 && request.id !== productRequests[0].id && productRequests[0].category}
						<button
							type="button"
							onclick={() => {
								request.category = productRequests[0].category;
							}}
							class="inline-flex items-center gap-1 text-[11px] font-medium text-lime-400 hover:text-lime-300 hover:underline"
							title="Copy category from Row #1"
						>
							{@html applyToAllIcon}
							Copy from #1
						</button>
					{/if}
				</div>
				<div class="select-wrapper min-w-0">
					<Select
						items={categoriesList}
						value={categoriesList.find((c) => c.value === request.category) || null}
						placeholder="Select Category"
						clearable={false}
						containerStyles="position: relative;"
						on:select={(e) => {
							const selectedVal = e.detail?.value || '';
							console.log(`[Product Request Approval] Category selected for SKU "${request.sku}":`, {
								event: e,
								detail: e.detail,
								selectedVal,
								currentRequestCategoryBefore: request.category
							});
							request.category = selectedVal;
							console.log(`[Product Request Approval] Category updated to:`, request.category);
						}}
						on:clear={() => {
							request.category = '';
						}}
					/>
				</div>
			{/snippet}

			{#snippet purchasePriceField(request: ProductRequest)}
				<label
					class="mb-1 block text-xs font-medium text-gray-400"
					for={`purchase-price-${request.id}`}
				>
					Purchase Price ($) <span class="text-red-400">*</span>
				</label>
				<input
					id={`purchase-price-${request.id}`}
					type="number"
					bind:value={request.purchase_price}
					onblur={() => calculatePrices(request, 'purchase')}
					step="0.0001"
					class={numberInputClass}
					placeholder="0.00"
				/>
			{/snippet}

			{#snippet markupPercentField(request: ProductRequest)}
				<label
					class="mb-1 block text-xs font-medium text-gray-400"
					for={`markup-percent-${request.id}`}
				>
					Markup % <span class="text-red-400">*</span>
				</label>
				<input
					id={`markup-percent-${request.id}`}
					type="number"
					value={getMarkupPercent(request)}
					onblur={(event) => applyMarkupPercent(request, (event.target as HTMLInputElement).value)}
					step="0.01"
					class={numberInputClass}
					placeholder="50"
				/>
			{/snippet}

			{#snippet gppField(request: ProductRequest)}
				<label
					class="mb-1 block text-xs font-medium text-gray-400"
					for={`gpp-${request.id}`}
				>
					GPP %
				</label>
				<input
					id={`gpp-${request.id}`}
					type="number"
					value={getGPP(request)}
					onblur={(event) => applyGPP(request, (event.target as HTMLInputElement).value)}
					step="0.01"
					class={numberInputClass}
					placeholder="33.3"
				/>
			{/snippet}

			{#snippet listPriceField(request: ProductRequest)}
				<label
					class="mb-1 block text-xs font-medium text-gray-400"
					for={`list-price-${request.id}`}
				>
					List Price ($)
				</label>
				<input
					id={`list-price-${request.id}`}
					type="number"
					bind:value={request.list_price}
					onblur={() => applyListPrice(request)}
					step="0.01"
					class={numberInputClass}
					placeholder="0.00"
				/>
			{/snippet}

			{#snippet rrpField(request: ProductRequest)}
				<label
					class="mb-1 block text-xs font-semibold uppercase tracking-wider text-lime-400"
					for={`rrp-${request.id}`}
				>
					RRP ($)
				</label>
				<input
					id={`rrp-${request.id}`}
					type="number"
					bind:value={request.rrp}
					onblur={() => applyRrp(request)}
					step="0.01"
					class={`${numberInputClass} font-semibold text-lime-400`}
					placeholder="0.00"
				/>
			{/snippet}

			{#snippet taxFreeField(request: ProductRequest)}
				<label class="mb-1 block text-xs font-medium text-gray-400">Tax</label>
				<label
					for={`tax-${request.id}`}
					class="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-[#262a30] bg-[#0e1012] px-3 transition hover:border-[#353a43]"
				>
					<input
						id={`tax-${request.id}`}
						type="checkbox"
						bind:checked={request.tax_included}
						onchange={() => calculatePrices(request, 'tax')}
						class={checkboxClass}
					/>
					<span class="select-none text-xs font-medium text-gray-300">Tax Free</span>
				</label>
			{/snippet}

			{#snippet requestCheckbox(request: ProductRequest)}
				<input
					type="checkbox"
					checked={selectedRows.has(request.id)}
					onchange={(event) => {
						const target = event.target as HTMLInputElement;
						toggleRequestSelected(request.id, target.checked);
					}}
					class={checkboxClass}
				/>
			{/snippet}

			{#if productRequests.length === 0}
				<div
					class="rounded-2xl border border-[#262a30] bg-[#141619] px-6 py-16 text-center shadow-xl"
				>
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1f2329] text-lime-400"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<p class="font-medium text-gray-300">No pending product requests</p>
					<p class="mt-1 text-sm text-gray-500">New requests will appear here for review.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each productRequests as request, index (request.id)}
						{@const missing = getMissingFields(request)}
						{@const isSelected = selectedRows.has(request.id)}
						<article
							class="request-card rounded-2xl border transition-all duration-200 {isSelected
								? 'border-lime-500/50 bg-[#16191e] shadow-lg shadow-lime-500/5 ring-1 ring-lime-500/30'
								: 'border-[#262a30] bg-[#141619] hover:border-[#353a43]'}"
						>
							<!-- Card Header -->
							<div
								class="flex flex-wrap items-center justify-between gap-3 border-b border-[#262a30] px-4 py-3 sm:px-6"
							>
								<div class="flex flex-wrap items-center gap-3">
									<label class="flex cursor-pointer select-none items-center gap-2.5">
										{@render requestCheckbox(request)}
										<span class="text-xs font-bold uppercase tracking-wider text-lime-400">
											Request #{index + 1}
										</span>
									</label>
									<span class="text-gray-600">|</span>
									<div class="flex items-center gap-1.5 text-xs text-gray-400">
										<span class="text-gray-500">Requested by:</span>
										<span class="font-medium text-gray-200">
											{request.requestor_firstName || 'Unknown'} {request.requestor_lastName || 'User'}
										</span>
										{#if request.requestor_email}
											<span class="hidden text-gray-500 sm:inline">({request.requestor_email})</span>
										{/if}
									</div>
								</div>

								<div class="flex items-center gap-2">
									{#if missing.length === 0}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-lime-500/30 bg-lime-500/10 px-2.5 py-0.5 text-xs font-medium text-lime-400"
										>
											<span class="h-1.5 w-1.5 rounded-full bg-lime-400"></span>
											Ready
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400"
											title={`Missing: ${missing.join(', ')}`}
										>
											<span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
											Missing {missing.length} {missing.length === 1 ? 'field' : 'fields'}
										</span>
									{/if}
								</div>
							</div>

							<!-- Card Body -->
							<div class="space-y-4 p-4 sm:p-6">
								<!-- Row 1: SKU, Product Name, Images -->
								<div class="flex flex-col gap-4 lg:flex-row lg:items-start">
									<div class="w-full shrink-0 sm:w-56 lg:w-60">
										{@render skuField(request)}
									</div>
									<div class="w-full min-w-0 flex-1">
										{@render productNameField(request)}
									</div>
									<div class="w-full shrink-0 lg:w-auto">
										{@render imagesField(request)}
									</div>
								</div>

								<!-- Row 2: Brand, Supplier, Category (Expansive Dropdowns) -->
								<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
									<div>{@render brandField(request)}</div>
									<div>{@render supplierField(request)}</div>
									<div>{@render categoryField(request)}</div>
								</div>

								<!-- Row 3: Pricing & Margins -->
								<div class="rounded-xl border border-[#262a30] bg-[#0e1012]/70 p-3.5 sm:p-4">
									<div
										class="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#262a30]/60 pb-2"
									>
										<span
											class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-lime-400"
										>
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
											Pricing & Margins
										</span>
										<span class="text-[11px] text-gray-500">
											Calculates automatically as values change
										</span>
									</div>
									<div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
										<div>{@render purchasePriceField(request)}</div>
										<div>{@render markupPercentField(request)}</div>
										<div>{@render gppField(request)}</div>
										<div>{@render listPriceField(request)}</div>
										<div>{@render rrpField(request)}</div>
										<div>{@render taxFreeField(request)}</div>
									</div>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}

			<div class="min-w-0">
				<h3 class="mb-4 text-xl font-bold tracking-tight text-white">Search Results from Markups</h3>
				<div class="min-w-0 overflow-hidden rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl">
					{#if Object.values(markupResults).every((markups) => markups.length === 0)}
						<p class="px-6 py-10 text-center text-sm text-gray-500">
							No markup matches for the current brands and suppliers.
						</p>
					{:else if isDesktopLayout.current}
						<div class="min-w-0 overflow-x-auto">
							<table class="w-full divide-y divide-[#262a30] text-sm">
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
					{:else}
						<div class="divide-y divide-[#262a30]">
							{#each Object.entries(markupResults) as [term, markups] (term)}
								{#each markups as markup, markupIndex (`${term}-${markup.id ?? markupIndex}`)}
									<div class="space-y-2 p-4">
										<div class="flex items-start justify-between gap-3">
											<p class="min-w-0 break-words font-medium text-gray-200">{markup.brand}</p>
											<p class="shrink-0 font-medium text-lime-400">{markup.rrp_markup}</p>
										</div>
										<p class="break-words text-sm text-gray-300">
											{markup.main_category}
											{#if markup.sub_category}
												<span class="text-gray-500"> / </span>{markup.sub_category}
											{/if}
										</p>
										{#if markup.description}
											<p class="break-words text-sm text-gray-400">{markup.description}</p>
										{/if}
									</div>
								{/each}
							{/each}
						</div>
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
		--height: 40px;
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
		--list-border: 1px solid #333842;
		--list-z-index: 1000;
		--list-max-height: 280px;
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
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	:global(.svelte-select.focused .selectContainer) {
		border-color: #a3e635;
		box-shadow: 0 0 0 1px rgba(163, 230, 53, 0.3);
	}

	:global(.svelte-select-list),
	:global(.svelte-select .items) {
		position: absolute !important;
		top: 100% !important;
		left: 0 !important;
		right: 0 !important;
		border: 1px solid #333842 !important;
		border-radius: 0.5rem !important;
		background: #141619 !important;
		margin-top: 4px !important;
		box-shadow:
			0 14px 28px rgba(0, 0, 0, 0.7),
			0 10px 10px rgba(0, 0, 0, 0.5) !important;
		z-index: 1000 !important;
		max-height: 280px !important;
		overflow-y: auto !important;
		color: #e5e7eb !important;
	}

	:global(.svelte-select-list .item),
	:global(.svelte-select .item) {
		font-size: 0.875rem !important;
		line-height: 1.35 !important;
		padding: 0.6rem 0.75rem !important;
		white-space: normal !important;
		word-break: break-word !important;
		color: #e5e7eb !important;
		height: auto !important;
		min-height: 38px !important;
		cursor: pointer !important;
	}

	:global(.svelte-select-list .item.hover),
	:global(.svelte-select .item.hover) {
		background-color: #1f2329 !important;
		color: #a3e635 !important;
	}

	:global(.svelte-select-list .item.active),
	:global(.svelte-select .item.active) {
		background-color: #262a30 !important;
		color: #a3e635 !important;
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
		z-index: 50;
	}

	.request-card {
		position: relative;
		z-index: 1;
	}

	.request-card:focus-within {
		z-index: 25;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
