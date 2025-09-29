<script>
    function printPage() {
        window.print();
    }
</script>

<svelte:head>
    <title>Cleaning and Laundry Solutions Catalogue - Print</title>
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
            background: #000;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 8px;
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
            font-size: 24pt;
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
            background: #1e1e1e;
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .category-title {
            font-size: 12pt;
            font-weight: bold;
        }

        .product-grid {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 20px;
            margin-bottom: 30px;
        }

        .product-image-section {
            border-radius: 8px;
            text-align: center;
        }

        .product-image {
            width: 100%;
            height: auto;
            max-height: 200px;
            object-fit: contain;
            border-radius: 8px;
            margin-bottom: 16px;
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
            background: #94ba4d;
            color: white;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .product-name {
            font-size: 12pt;
            font-weight: bold;
        }

        .product-price {
            font-size: 12pt;
            font-weight: bold;
        }

        .product-description-section {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 16px;
        }

        .description-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .description-title {
            font-size: 12pt;
            font-weight: bold;
            color: #555;
            margin: 0;
            flex-shrink: 0;
            white-space: nowrap;
        }

        .description-text {
            font-size: 9pt;
            color: #666;
            line-height: 1.5;
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

        @media print {
            body {
                font-size: 11pt;
            }

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

<button class="print-button" on:click={printPage}>Print Catalogue</button>
<div class="container">
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
                <span class="page-number">1</span>
            </div>
        </div>

        <div class="page-header-content">
            <h2 class="product-range-title">CLEANING AND LAUNDRY SOLUTIONS</h2>

            <div class="category-header">
                <h3 class="category-title">Washroom Cleaner</h3>
            </div>
        </div>

        <!-- Product 1 -->
        <div class="product-grid">
            <div class="product-image-section">
                <!-- Product Image -->
                <img
                    src="https://www.rapidsupplies.com.au/assets/full/140370.jpg?20240719121930&1759111621806"
                    alt="Washroom Cleaner Product"
                    class="product-image"
                />
            </div>

            <div>
                <!-- Product Name and Price -->
                <div class="product-details">
                    <h4 class="product-name">HI-GENIC H4</h4>
                    <div class="product-price">$29.99</div>
                </div>

                <!-- Product Description -->
                <div class="product-description-section">
                    <div class="description-header">
                        <h5 class="description-title">Product Description</h5>
                        <!-- Tags and Certifications -->
                        <div class="certifications">
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/environmentally_friendly.png"
                                alt="Environmentally Friendly"
                                class="certification-img"
                            />
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/food_safe.png"
                                alt="Food Safe"
                                class="certification-img"
                            />
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/recognized.png"
                                alt="Recognized"
                                class="certification-img"
                            />
                        </div>
                    </div>
                    <p class="description-text">
                        Hi-Genic is formulated using safe acids and anionic surfactants: a combination that has proven to be the least corrosive to all metals yet gives excellent performance. The regular use of Hi-Genic brightens stainless steel and porcelain surfaces. Hi-Genic Washroom Cleaner can be used safely on a wide variety of surfaces including stainless steel and porcelain toilet bowls, urinals and stone bench tops.
                    </p>
                </div>
            </div>
        </div>

        <!-- Product 2 -->
        <div class="product-grid">
            <div class="product-image-section">
                <!-- Product Image -->
                <div class="image-placeholder">
                    Product Image
                </div>
            </div>

            <div>
                <!-- Product Name and Price -->
                <div class="product-details">
                    <h4 class="product-name">DEEP CLEAN PRO</h4>
                    <div class="product-price">$34.50</div>
                </div>

                <!-- Product Description -->
                <div class="product-description-section">
                    <div class="description-header">
                        <h5 class="description-title">Product Description</h5>
                        <!-- Tags and Certifications -->
                        <div class="certifications">
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/environmentally_friendly.png"
                                alt="Environmentally Friendly"
                                class="certification-img"
                            />
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/food_safe.png"
                                alt="Food Safe"
                                class="certification-img"
                            />
                        </div>
                    </div>
                    <p class="description-text">
                        Deep Clean Pro is a heavy-duty cleaner designed for tough industrial applications. Its powerful formula penetrates deep into surfaces to remove stubborn stains, grease, and grime. Perfect for manufacturing facilities, garages, and heavy equipment maintenance.
                    </p>
                </div>
            </div>
        </div>

        <!-- Product 3 -->
        <div class="product-grid">
            <div class="product-image-section">
                <!-- Product Image -->
                <div class="image-placeholder">
                    Product Image
                </div>
            </div>

            <div>
                <!-- Product Name and Price -->
                <div class="product-details">
                    <h4 class="product-name">SHINE MASTER</h4>
                    <div class="product-price">$24.99</div>
                </div>

                <!-- Product Description -->
                <div class="product-description-section">
                    <div class="description-header">
                        <h5 class="description-title">Product Description</h5>
                        <!-- Tags and Certifications -->
                        <div class="certifications">
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/recognized.png"
                                alt="Recognized"
                                class="certification-img"
                            />
                        </div>
                    </div>
                    <p class="description-text">
                        Shine Master polish and protectant restores luster to metal surfaces while providing long-lasting protection against corrosion and fingerprints. Ideal for brass, chrome, and stainless steel fixtures in commercial and residential settings.
                    </p>
                </div>
            </div>
        </div>

        <!-- Repeating Header for Page 2 -->
        <div class="repeat-header">
            <!-- Page Header -->
            <div class="page-header">
                <img
                    src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
                    alt="Rapid Supplies Logo"
                    class="logo"
                />
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
                <span class="page-number">2</span>
            </div>

            <div class="page-header-content">
                <h2 class="product-range-title">CLEANING AND LAUNDRY SOLUTIONS</h2>

                <div class="category-header">
                    <h3 class="category-title">Washroom Cleaner</h3>
                </div>
            </div>
        </div>

        <!-- Product 4 -->
        <div class="product-grid">
            <div class="product-image-section">
                <!-- Product Image -->
                <div class="image-placeholder">
                    Product Image
                </div>
            </div>

            <div>
                <!-- Product Name and Price -->
                <div class="product-details">
                    <h4 class="product-name">FLOOR GUARD</h4>
                    <div class="product-price">$39.99</div>
                </div>

                <!-- Product Description -->
                <div class="product-description-section">
                    <div class="description-header">
                        <h5 class="description-title">Product Description</h5>
                        <!-- Tags and Certifications -->
                        <div class="certifications">
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/environmentally_friendly.png"
                                alt="Environmentally Friendly"
                                class="certification-img"
                            />
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/food_safe.png"
                                alt="Food Safe"
                                class="certification-img"
                            />
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/recognized.png"
                                alt="Recognized"
                                class="certification-img"
                            />
                        </div>
                    </div>
                    <p class="description-text">
                        Floor Guard provides superior protection for all types of flooring including tile, concrete, and vinyl. This sealant creates an invisible barrier that repels water, oil, and stains while maintaining the natural appearance of your floors.
                    </p>
                </div>
            </div>
        </div>

        <!-- Product 5 -->
        <div class="product-grid">
            <div class="product-image-section">
                <!-- Product Image -->
                <div class="image-placeholder">
                    Product Image
                </div>
            </div>

            <div>
                <!-- Product Name and Price -->
                <div class="product-details">
                    <h4 class="product-name">QUICK DRY</h4>
                    <div class="product-price">$19.99</div>
                </div>

                <!-- Product Description -->
                <div class="product-description-section">
                    <div class="description-header">
                        <h5 class="description-title">Product Description</h5>
                        <!-- Tags and Certifications -->
                        <div class="certifications">
                            <img
                                src="https://www.rapidsupplies.com.au/assets/images/food_safe.png"
                                alt="Food Safe"
                                class="certification-img"
                            />
                        </div>
                    </div>
                    <p class="description-text">
                        Quick Dry is a fast-evaporating cleaner that leaves no residue. Perfect for glass surfaces, mirrors, and stainless steel appliances. Its alcohol-based formula dries quickly, eliminating streaks and spots for a crystal-clear finish.
                    </p>
                </div>
            </div>
        </div>
    </div>
