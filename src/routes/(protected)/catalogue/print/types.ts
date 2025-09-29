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
	title: string;
	categories: Category[];
}

export interface PrintSettings {
	pageSize: string;
	margin: string;
	productsPerPage: number;
	repeatHeaderOnNewPage: boolean;
}

export interface CatalogueData {
	productRanges: ProductRange[];
	printSettings: PrintSettings;
}
