export interface Product {
	sku: string;
	name: string;
	price: string;
	image: string | null;
	description: string;
	certifications: string[];
}

export interface Category {
	name: string;
	products: Product[];
}

export interface ProductRange {
	type: 'productRange';
	title: string;
	categories: Category[];
}

export interface PageHeader {
	type: 'pageHeader';
	title: string;
	categories: []; // Empty array as per user requirement
}

export type HierarchyItem = ProductRange | PageHeader;

export interface PrintSettings {
	pageSize: string;
	margin: string;
	productsPerPage: number;
	repeatHeaderOnNewPage: boolean;
}

export interface CatalogueData {
	hierarchy: HierarchyItem[];
	printSettings: PrintSettings;
}
