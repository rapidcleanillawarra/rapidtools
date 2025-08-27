feat(workshop-camera): Allow nullable fields and empty work order

This commit updates the workshop camera functionality to allow location of repair, product name, and customer name fields to be nullable, and sets the client's work order to an empty string when capturing photos. This aligns the frontend behavior with recent database schema changes.

### Files Modified:

#### 1. `src/lib/services/workshop.ts`
- **Changes**:
  - Updated `WorkshopFormData` interface: `locationOfRepair`, `productName`, and `customerName` are now `string | null` or `'Site' | 'Workshop' | null`.
  - Updated `WorkshopRecord` interface: `location_of_repair`, `product_name`, and `customer_name` are now `string | null` or `'Site' | 'Workshop' | null`.
  - Modified `createWorkshop` function to use `data.locationOfRepair || null`, `data.productName || null`, and `data.customerName || null` to store null values if the incoming data is null or empty.
  - Modified `updateWorkshop` function to use `data.locationOfRepair || null`, `data.productName || null`, and `data.customerName || null` for the same reason.
  - Added explicit type annotations (`string[]` and `(url: string)`) to `photoUrls` variables and `url` parameters in `uploadWorkshopPhotos`, `cleanupOrphanedPhotos`, `getPhotoStatistics`, and `cleanupWorkshopPhotos` functions.
- **Why**: To accommodate the database schema changes making these columns nullable, and to fix TypeScript linter errors related to implicit `any` types.
- **Impact**: Allows workshop records to be created and updated with null values for location of repair, product name, and customer name. Improves code quality and type safety.

- **Diff for WorkshopFormData interface update**:
```diff
--- a/src/lib/services/workshop.ts
+++ b/src/lib/services/workshop.ts
@@ -8,11 +8,11 @@
 // Workshop form data interface
 export interface WorkshopFormData {
   // Machine Information
-  locationOfRepair: 'Site' | 'Workshop';
-  productName: string;
+  locationOfRepair: 'Site' | 'Workshop' | null;
+  productName: string | null;
   clientsWorkOrder: string;
   makeModel: string;
   serialNumber: string;
   siteLocation: string; // Now optional
   faultDescription: string;
 
-  customerName: string;
+  customerName: string | null;
   contactEmail: string;
   contactNumber: string;
   selectedCustomer: Customer | null;
```

- **Diff for createWorkshop function update**:
```diff
--- a/src/lib/services/workshop.ts
+++ b/src/lib/services/workshop.ts
@@ -143,13 +143,13 @@
    
     // Prepare workshop data
     const workshopData = {
-      location_of_repair: data.locationOfRepair,
-      product_name: data.productName,
+      location_of_repair: data.locationOfRepair || null,
+      product_name: data.productName || null,
       clients_work_order: data.clientsWorkOrder,
       make_model: data.makeModel,
       serial_number: data.serialNumber,
       site_location: data.siteLocation?.trim() || null, // Store null for empty values
       fault_description: data.faultDescription,
-      customer_name: data.customerName,
+      customer_name: data.customerName || null,
       contact_email: data.contactEmail,
       contact_number: data.contactNumber,
       customer_data: data.selectedCustomer,
```

#### 2. `src/routes/(protected)/workshop/camera/+page.svelte`
- **Changes**:
  - Modified the `createWorkshopDataFromPhotos` function to set `locationOfRepair`, `productName`, `customerName` to `null`.
  - Modified the `createWorkshopDataFromPhotos` function to set `clientsWorkOrder` to an empty string (`''`) instead of a generated unique ID.
- **Why**: To reflect the nullable database columns and to allow for an empty work order when photos are captured directly from the camera, giving more flexibility in initial data entry.
- **Impact**: When a user captures photos through the camera interface, these fields will no longer be pre-filled with default values but will be saved as `null` or an empty string, allowing them to be filled in later if needed.

- **Diff for createWorkshopDataFromPhotos function update**:
```diff
--- a/src/routes/(protected)/workshop/camera/+page.svelte
+++ b/src/routes/(protected)/workshop/camera/+page.svelte
@@ -120,11 +120,11 @@
 
   function createWorkshopDataFromPhotos() {
     return {
-      locationOfRepair: 'Workshop' as const,
-      productName: 'Photos captured via camera', // Required field - provide default
-      clientsWorkOrder: `camera_${Date.now()}`, // Generate a unique work order
+      locationOfRepair: null,
+      productName: null,
+      clientsWorkOrder: '', // Empty work order
       makeModel: '',
       serialNumber: '',
       siteLocation: '',
       faultDescription: 'Photos captured via camera',
-      customerName: 'Camera Capture', // Required field - provide default
+      customerName: null,
       contactEmail: '',
       contactNumber: '',
       selectedCustomer: null,
```

### Technical Improvements:
- **BEFORE**: TypeScript linter reported implicit `any` type errors in `src/lib/services/workshop.ts` due to undeclared types for function parameters and variables.
- **AFTER**: Explicit type annotations (`string[]`, `(url: string)`) were added, resolving the linter errors and improving code maintainability and readability.

### Endpoints Modified:
- The `createWorkshop` and `updateWorkshop` functions within `src/lib/services/workshop.ts` interact with the `supabase` client to perform database operations on the `workshop` table. No new endpoints were added, but the data sent to existing insert/update operations was modified.

### Testing Instructions:
1.  Navigate to the camera page (e.g., `/workshop/camera`).
2.  Take or upload one or more photos.
3.  Click the "Done" button to save the photos to the database.
4.  Verify that a new workshop record is created in your Supabase `public.workshop` table.
5.  Check the `location_of_repair`, `product_name`, `customer_name`, and `clients_work_order` columns for the newly created record. They should be `null`, `null`, `null`, and an empty string (`''`) respectively.
6.  (Optional) If you have an existing workshop record, try updating it through another interface to ensure that `null` values can still be passed for these fields.