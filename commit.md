feat(product-request): Add tax column with confirmation flow

This commit introduces a tax inclusion feature to the product request form, including UI elements, validation, and confirmation flow.

### Files Modified:

#### 1. `src/routes/(protected)/product-request/+page.svelte`
- ADDED: New "Tax" column with checkboxes as second-to-last column
- ADDED: "Apply to All" button for tax column header
- ADDED: Tax confirmation modal when all products are tax included
- MODIFIED: ProductRow interface to include taxIncluded property
- MODIFIED: createEmptyRow() to default taxIncluded to true
- MODIFIED: applyToAll() to support taxIncluded field
- MODIFIED: Firebase payload to include tax_included field
- ADDED: Tax status in email notification table

Key changes diff:
```diff
interface ProductRow {
  sku: string;
  productName: string;
  brand: SelectOption | null;
  supplier: SelectOption | null;
  purchasePrice: string;
  rrp: string;
+ taxIncluded: boolean;
  exists: boolean;
}

function createEmptyRow(): ProductRow {
  return {
    sku: '',
    productName: '',
    brand: null,
    supplier: null,
    purchasePrice: '',
    rrp: '',
+   taxIncluded: true,
    exists: false
  };
}

+ <div>
+   Tax
+   <button
+     on:click={() => applyToAll('taxIncluded', rows[0]?.taxIncluded)}
+     class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
+   >
+     Apply to All
+   </button>
+ </div>

+ <label class="mb-4 md:mb-0 flex items-center cursor-pointer">
+   <span class="block md:hidden text-sm font-medium text-gray-700 mb-1 mr-2">Tax</span>
+   <input
+     type="checkbox"
+     bind:checked={row.taxIncluded}
+     class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
+   />
+ </label>

+ {#if showTaxConfirmation}
+   <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
+     <!-- Tax confirmation modal content -->
+   </div>
+ {/if}
```

### Technical Improvements:
- BEFORE: No tax status tracking in product requests
- AFTER: Tax status included in UI, validation, and persistence
- IMPACT: 
  - Users can now specify tax inclusion per product
  - Added safety check for all-tax-included scenarios
  - Tax status included in Firebase payload and email notifications

### Testing Instructions:
1. Add multiple product rows
2. Verify tax checkbox is checked by default for new rows
3. Test "Apply to All" button for tax column
4. Submit form with all tax checkboxes checked to see confirmation modal
5. Verify tax status appears in Firebase documents under `tax_included` field

### Notes:
- The tax confirmation only appears when ALL products are marked tax included
- Mobile view shows "Tax" label above checkbox
- Email notifications now include tax status in product table
- No breaking changes introduced

feat(deploy): Add Supabase environment variables to GitHub workflow

This commit adds Supabase authentication environment variables to the GitHub Pages deployment workflow, enabling proper integration with the Supabase backend.

### Files Modified:

#### 1. `.github/workflows/deploy.yml`
- ADDED: Supabase URL environment variable for API endpoint configuration
- ADDED: Supabase anonymous key environment variable for client authentication
- DIFF:
```diff
   VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
   VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
   VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
+  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
+  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

### Technical Improvements:
- BEFORE: Deployment workflow only included Firebase environment variables
- AFTER: Workflow now includes both Firebase and Supabase environment variables
- IMPACT: Enables proper authentication and data fetching from Supabase in the deployed application

### Testing Instructions:
- Ensure GitHub repository has the Supabase secrets properly configured
- Verify that the Customer Group Products page loads data correctly after deployment
