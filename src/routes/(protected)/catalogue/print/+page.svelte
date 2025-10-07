<script lang="ts">
    import type { CatalogueData } from './types.ts';
    import { goto } from '$app/navigation';

    interface PageData {
        catalogueData: CatalogueData;
        sessionName?: string;
    }

    export let data: PageData;


    function printPage() {
        window.print();
    }

    function goBackToCatalogue() {
        goto('/catalogue');
    }

    // Helper function to get certification icon URL
    function getCertificationIcon(certification: string): string {
        const iconMap: Record<string, string> = {
            environmentally_friendly: "https://www.rapidsupplies.com.au/assets/images/environmentally_friendly.png",
            food_safe: "https://www.rapidsupplies.com.au/assets/images/food_safe.png",
            recognized: "https://www.rapidsupplies.com.au/assets/images/recognized.png"
        };
        return iconMap[certification] || "";
    }

</script>

<svelte:head>
    <title>{data.sessionName ? `${data.sessionName} - Print` : 'Cleaning and Laundry Solutions Catalogue - Print'}</title>
    <style>
        @page {
            size: A4;
            margin: 1cm;
        }

        /* Repeating headers for each page */
        .page-header-content {
            page-break-inside: avoid;
        }

        .repeat-header {
            margin-top: 30px;
        }

        .repeat-header:first-child {
            margin-top: 0;
        }

        /* Print-specific header repetition - let content flow naturally */
        @media print {
            .page-header-content {
                position: relative;
                z-index: 1;
                page-break-inside: avoid;
            }

            .repeat-header {
                page-break-before: auto; /* Allow natural page breaks */
                page-break-inside: avoid;
            }

            /* CSS page counters work in @page margin boxes, not content */
            /* For dynamic page numbering in content, JavaScript would be needed */
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 0;
            background: white;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .page-header {
            background: #272727;
            color: white;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 60px;
        }

        .logo {
            height: 32px;
            width: auto;
        }

        .contact-info {
            text-align: left;
            font-size: 9pt;
        }

        .contact-item {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            margin-bottom: 2px;
        }

        .contact-item span:first-child {
            margin-right: 6px;
        }

        .page-number {
            font-size: 20pt;
            font-weight: bold;
            color: white;
        }

        .product-range-title {
            font-size: 18pt;
            font-weight: bold;
            color: #94ba4d;
            text-decoration: underline;
            text-align: center;
            margin: 10px 0;
        }

        .category-header {
            background: #9db85e;
            color: white;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .category-title {
            font-size: 12pt;
            font-weight: bold;
        }

        .product-grid {
            display: grid;
            grid-template-columns: 0.6fr 2fr;
            gap: 10px;
            margin-bottom: 5px;
            min-height: 125px;
            max-height: 165px;
        }

        .product-image-section {
            border-radius: 8px;
            text-align: center;
        }

        .product-image {
            width: 100%;
            height: auto;
            min-height:125px;
            max-height: 165px;
            object-fit: contain;
            border-radius: 8px;
        }

        .certifications {
            display: flex;
            justify-content: flex-end;
            gap: 4px;
            width: 100%;
        }

        .certification-img {
            width: auto;
            height: 30px;
            object-fit: contain;
        }

        .product-details {
            background: #272727;
            color: white;
            border-radius: 8px;
            padding: 5px 10px;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .product-name {
            font-size: 9pt;
            font-weight: bold;
        }

        .product-price {
            font-size: 9pt;
            font-weight: bold;
        }

        .product-description-section {
            background: #f9f9f9;
            border-radius: 10px;
            padding: 5px 10px;
        }

        .description-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }

        .description-title {
            font-size: 9pt;
            font-weight: bold;
            color: #555;
            margin: 0;
            flex-shrink: 0;
            white-space: nowrap;
        }

        .description-text {
            font-size: 7pt;
            color: #666;
            line-height: 1.2;
        }

        .back-button {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #666;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14pt;
            font-weight: bold;
            z-index: 1000;
        }

        .back-button:hover {
            background: #555;
        }

        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #94ba4d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14pt;
            font-weight: bold;
            z-index: 1000;
        }

        .print-button:hover {
            background: #7a9a3d;
        }

        .page-break {
            page-break-before: always;
        }

        @media print {
            body {
                font-size: 11pt;
            }

            .back-button,
            .print-button {
                display: none;
            }

            .page-header {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }

            .category-header {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }

            .product-details {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }

            .product-range-title {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }
        }
    </style>
</svelte:head>

<button class="back-button" on:click={goBackToCatalogue}>Back to Catalogue</button>
<button class="print-button" on:click={printPage}>Print Catalogue</button>
<div class="container">
    {#each data.catalogueData.productRanges as productRange, rangeIndex}
        <!-- Page Header -->
        <div class="page-header">
            <img
                src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
                alt="Rapid Supplies Logo"
                class="logo"
            />
            <div class="header-right">
                <div class="contact-info">
                    <div class="contact-item">
                        <span>📞</span>
                        <span>4227 2833</span>
                    </div>
                    <div class="contact-item">
                        <span>📧</span>
                        <span>orders@rapidcleanillawarra.com.au</span>
                    </div>
                </div>
                <span class="page-number">{rangeIndex + 1}</span>
            </div>
        </div>

        <div class="page-header-content">
            <h2 class="product-range-title">{productRange.title}</h2>
        </div>

        {#each productRange.categories as category}
            <div class="category-header">
                <h3 class="category-title">{category.name}</h3>
            </div>

            {#each category.products as product, productIndex}
                <!-- Product Grid -->
                <div class="product-grid">
                    <div class="product-image-section">
                        {#if product.image}
                            <img
                                src={product.image}
                                alt="{product.name} Product"
                                class="product-image"
                            />
                        {:else}
                            <div class="image-placeholder">
                                Product Image
                            </div>
                        {/if}
                    </div>

                    <div>
                        <!-- Product Name and Price -->
                        <div class="product-details">
                            <h4 class="product-name">{product.name}</h4>
                            <div class="product-price">{product.price}</div>
                        </div>

                        <!-- Product Description -->
                        <div class="product-description-section">
                            <div class="description-header">
                                <h5 class="description-title">Product Description</h5>
                                <!-- Tags and Certifications -->
                                {#if product.certifications && product.certifications.length > 0}
                                    <div class="certifications">
                                        {#each product.certifications as certification}
                                            <img
                                                src={getCertificationIcon(certification)}
                                                alt={certification.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                class="certification-img"
                                            />
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <div class="description-text">
                                {@html product.description}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        {/each}

        <!-- Add page break for next product range if not the last one -->
        {#if rangeIndex < data.catalogueData.productRanges.length - 1}
            <div class="page-break"></div>
        {/if}
    {/each}
</div>
