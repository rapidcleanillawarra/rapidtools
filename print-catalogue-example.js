// Example: How to POST JSON data to the catalogue print page
// This script demonstrates how to send catalogue data to the print endpoint

const catalogueData = {
  "productRanges": [
    {
      "title": "CLEANING AND LAUNDRY SOLUTIONS",
      "categories": [
        {
          "name": "Washroom Cleaner",
          "products": [
            {
              "sku": "hi-genic-h4",
              "name": "HI-GENIC H4",
              "price": "$29.99",
              "image": "https://www.rapidsupplies.com.au/assets/full/140370.jpg?20240719121930&1759111621806",
              "description": "Hi-Genic is formulated using safe acids and anionic surfactants: a combination that has proven to be the least corrosive to all metals yet gives excellent performance. The regular use of Hi-Genic brightens stainless steel and porcelain surfaces. Hi-Genic Washroom Cleaner can be used safely on a wide variety of surfaces including stainless steel and porcelain toilet bowls, urinals and stone bench tops.",
              "certifications": ["environmentally_friendly", "food_safe", "recognized"]
            },
            {
              "sku": "deep-clean-pro",
              "name": "DEEP CLEAN PRO",
              "price": "$34.50",
              "image": null,
              "description": "Deep Clean Pro is a heavy-duty cleaner designed for tough industrial applications. Its powerful formula penetrates deep into surfaces to remove stubborn stains, grease, and grime. Perfect for manufacturing facilities, garages, and heavy equipment maintenance.",
              "certifications": ["environmentally_friendly", "food_safe"]
            }
          ]
        }
      ]
    }
  ],
  "printSettings": {
    "pageSize": "A4",
    "margin": "1cm",
    "productsPerPage": 3,
    "repeatHeaderOnNewPage": true
  }
};

// Method 1: POST to API endpoint and redirect to print page with data
async function printCatalogueViaAPI(data) {
  try {
    // First, send data to API endpoint
    const apiResponse = await fetch('/api/catalogue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await apiResponse.json();

    if (result.success) {
      // Redirect to print page with data as URL parameter
      const encodedData = encodeURIComponent(JSON.stringify(data));
      window.location.href = `/catalogue/print?data=${encodedData}`;
    } else {
      console.error('Failed to process catalogue data:', result.error);
    }
  } catch (error) {
    console.error('Error sending catalogue data:', error);
  }
}

// Method 2: Direct redirect to print page with data (simpler approach)
function printCatalogueDirect(data) {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  window.location.href = `/catalogue/print?data=${encodedData}`;
}

// Usage examples:
// printCatalogueViaAPI(catalogueData);  // Uses API endpoint
// printCatalogueDirect(catalogueData);  // Direct approach (recommended for most cases)

// For testing, you can call:
printCatalogueDirect(catalogueData);
