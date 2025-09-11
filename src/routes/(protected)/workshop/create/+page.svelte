<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import CustomerDropdown from '$lib/components/CustomerDropdown.svelte';
  import PhotoManager from '$lib/components/PhotoManager.svelte';
  import ContactsManager from '$lib/components/ContactsManager.svelte';
  import type { PhotoItem, Contact } from '$lib/types/workshop';
  import SuccessModal from '$lib/components/SuccessModal.svelte';
  import type { Customer } from '$lib/services/customers';
  import { getCustomerDisplayName } from '$lib/services/customers';
  import { createWorkshop, getPhotoStatistics, cleanupOrphanedPhotos, getWorkshop, updateWorkshop } from '$lib/services/workshop';
  import { fetchCustomerData, createOrder } from '$lib/services/maropost';
  import { validateWorkshopForm } from '$lib/utils/validation';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/firebase';
  import { get } from 'svelte/store';

  type LocationType = 'Site' | 'Workshop';

  // Machine Information
  let locationOfRepair: LocationType = 'Site';
  let productName = '';
  let clientsWorkOrder = '';
  let makeModel = '';
  let serialNumber = '';
  let siteLocation = '';
  let faultDescription = '';

  // User Information
  let customerName = '';
  let contactEmail = '';
  let contactNumber = '';

  // Customer selection
  let selectedCustomer: Customer | null = null;

  // Optional Contacts
  let optionalContacts: Contact[] = [];
  let contactError = '';

  // Photos (always visible Photos section)
  let photos: PhotoItem[] = [];
  let photoError = '';
  const MIN_PHOTOS_REQUIRED = 0; // Photos are now optional

  // Validation errors
  let siteLocationError = '';

  // Form submission state
  let isSubmitting = false;
  let submitError = '';
  let submitSuccess = false;

  // Success modal state
  let showSuccessModal = false;
  let successMessage = '';
  let generatedOrderId = '';

  // Customer data from API
  let customerApiData: any = null;
  // Order data from API
  let orderApiData: any = null;

  // Determine entry point
  let startedWith: 'form' | 'camera' = 'form';
  let existingWorkshopId: string | null = null;
  let workshopStatus: 'draft' | 'in_progress' | 'completed' | 'cancelled' | 'to_be_quoted' | null = null;

  // Debug modal state
  $: console.log('Modal state changed:', { showSuccessModal, successMessage, generatedOrderId });

  // Machine Information section state
  let isMachineInfoExpanded = true;

  // User Information section state
  let isUserInfoExpanded = true;


  // Generate summary for machine information
  $: machineInfoSummaryItems = (() => {
    const items = [];
    if (productName.trim()) items.push({ label: 'Product', value: productName, priority: 1 });
    if (locationOfRepair) items.push({ label: 'Location', value: locationOfRepair, priority: 2 });
    if (makeModel.trim()) items.push({ label: 'Make/Model', value: makeModel, priority: 3 });
    if (serialNumber.trim()) items.push({ label: 'Serial', value: serialNumber, priority: 4 });
    if (siteLocation.trim()) items.push({ label: 'Site', value: siteLocation, priority: 5 });
    return items.sort((a, b) => a.priority - b.priority);
  })();

  // Generate summary for user information
  $: userInfoSummaryItems = (() => {
    const items = [];
    if (customerName.trim()) items.push({ label: 'Customer', value: customerName, priority: 1 });
    if (contactEmail.trim()) items.push({ label: 'Email', value: contactEmail, priority: 2 });
    if (contactNumber.trim()) items.push({ label: 'Phone', value: contactNumber, priority: 3 });
    if (optionalContacts.length > 0) items.push({ label: 'Contacts', value: `${optionalContacts.length} additional`, priority: 4 });
    return items.sort((a, b) => a.priority - b.priority);
  })();


  // Check referrer to determine if user came from camera page
  $: if (typeof window !== 'undefined') {
    const referrer = document.referrer;
    const currentUrl = window.location.href;

    // Check if user came from camera page or if URL contains camera parameter
    if (referrer.includes('/workshop/camera') ||
        currentUrl.includes('from=camera') ||
        $page.url.searchParams.get('from') === 'camera') {
      startedWith = 'camera';
    } else {
      startedWith = 'form';
    }

    // Check if we have a workshop_id parameter to load existing workshop (regardless of entry point)
    const workshopId = $page.url.searchParams.get('workshop_id');
    if (workshopId) {
      existingWorkshopId = workshopId;
      loadExistingWorkshop(workshopId);
    }
  }

  async function loadExistingWorkshop(workshopId: string) {
    try {
      console.log('Loading workshop with ID:', workshopId);
      const workshop = await getWorkshop(workshopId);

      if (!workshop) {
        console.error('Workshop not found for ID:', workshopId);
        submitError = 'Workshop not found.';
        return;
      }

      console.log('Workshop loaded successfully:', workshop);

      // Set workshop status
      workshopStatus = workshop.status;

      // Populate form with existing workshop data
      locationOfRepair = workshop.location_of_repair || 'Site';
      productName = workshop.product_name || '';
      clientsWorkOrder = workshop.clients_work_order || '';
      makeModel = workshop.make_model || '';
      serialNumber = workshop.serial_number || '';
      siteLocation = workshop.site_location || '';
      faultDescription = workshop.fault_description || '';
      customerName = workshop.customer_name || '';
      contactEmail = workshop.contact_email || '';
      contactNumber = workshop.contact_number || '';
      selectedCustomer = workshop.customer_data;
      optionalContacts = workshop.optional_contacts || [];

      // Load existing photos (they're already saved in storage)
      // Note: We can't recreate File objects from URLs, so we'll show them differently
      if (workshop.photo_urls && workshop.photo_urls.length > 0) {
        // Create PhotoItem entries with the existing photo URLs
        photos = workshop.photo_urls.map(url => ({
          file: new File([], 'existing-photo.jpg', { type: 'image/jpeg' }), // Dummy file
          url: url,
          isExisting: true // Mark as existing photo
        }));
      }

      console.log('Loaded existing workshop:', workshop);
      console.log('Form populated with data:', {
        locationOfRepair,
        productName,
        customerName,
        contactEmail,
        workshopStatus,
        selectedCustomer: selectedCustomer ? 'Customer selected' : 'No customer selected'
      });
    } catch (error) {
      console.error('Error loading workshop:', error);
      submitError = 'Failed to load existing workshop. Please try again.';
    }
  }

  // Clear site location error when location changes or site location is entered
  $: if (locationOfRepair !== 'Site') {
    siteLocationError = '';
  }
  $: if (siteLocation.trim()) {
    siteLocationError = '';
  }


  // Event handlers for ContactsManager component
  function handleContactsUpdated(event: CustomEvent) {
    optionalContacts = event.detail.contacts;
  }

  function handleContactError(event: CustomEvent) {
    contactError = event.detail.message;
  }

  function handleCustomerSelect(event: CustomEvent) {
    const { customer } = event.detail;
    selectedCustomer = customer;
    customerName = customer.BillingAddress.BillFirstName + ' ' + customer.BillingAddress.BillLastName;
    contactEmail = customer.EmailAddress;
    contactNumber = customer.BillingAddress.BillPhone || '';
  }

  function handleCustomerClear() {
    selectedCustomer = null;
    customerName = '';
    contactEmail = '';
    contactNumber = '';
  }

  async function handleUpdateJob(event: Event) {
    event.preventDefault();

    // Reset previous states
    submitError = '';
    submitSuccess = false;

    // Validate required fields using validation utility
    const validation = validateWorkshopForm({
      productName,
      customerName,
      locationOfRepair,
      siteLocation
    });

    if (!validation.isValid) {
      submitError = `Please fill in all required fields: ${validation.errors.join(', ')}`;
      return;
    }

    // Clear any existing errors
    siteLocationError = '';
    photoError = '';

    // Start submission
    isSubmitting = true;

    // Separate new photos from existing photos
    const newPhotos = photos.filter(p => !p.isExisting).map(p => p.file);
    const existingPhotoUrls = photos.filter(p => p.isExisting).map(p => p.url);

    // Prepare form data for update only (no status changes, no order creation)
    const formData = {
      locationOfRepair,
      productName,
      clientsWorkOrder,
      makeModel,
      serialNumber,
      siteLocation,
      faultDescription,
      customerName,
      contactEmail,
      contactNumber,
      selectedCustomer,
      optionalContacts: optionalContacts || [],
      photos: newPhotos,
      existingPhotoUrls,
      startedWith
      // Note: No status changes, no order creation for update job
    };

    console.log('Update job form data:', formData);

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to update a workshop');
    }

    try {
      let workshop;
      if (existingWorkshopId) {
        // Update existing workshop
        workshop = await updateWorkshop(existingWorkshopId, formData);
        console.log('Workshop updated successfully:', workshop);
      } else {
        // Create new workshop
        workshop = await createWorkshop(formData, user.uid);
        console.log('Workshop created successfully:', workshop);
      }

      submitSuccess = true;
      successMessage = existingWorkshopId
        ? 'Workshop job updated successfully!'
        : 'Workshop job created successfully!';

      showSuccessModal = true;

      if (!existingWorkshopId) {
        // Reset form after successful creation
        resetForm();
      }
    } catch (error) {
      console.error('Error saving workshop:', error);
      submitError = (error instanceof Error ? error.message : 'Failed to save workshop. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    // Reset previous states
    submitError = '';
    submitSuccess = false;

    // Validate required fields using validation utility
    const validation = validateWorkshopForm({
      productName,
      customerName,
      locationOfRepair,
      siteLocation
    });

    if (!validation.isValid) {
      submitError = `Please fill in all required fields: ${validation.errors.join(', ')}`;
      return;
    }

    // Clear any existing errors
    siteLocationError = '';
    photoError = '';

    // Start submission
    isSubmitting = true;

    let shouldCreateOrder = false;

    // Only fetch customer data and create orders for existing workshops
    if (existingWorkshopId) {
      // Fetch customer data from API first
      try {
        console.log('Fetching customer data from API...');
        customerApiData = await fetchCustomerData();
        console.log('Customer data fetched successfully');
      } catch (error) {
        console.error('Failed to fetch customer data:', error);
        submitError = 'Failed to fetch customer data. Please try again.';
        isSubmitting = false;
        return;
      }

      // Check if this workshop already has an order_id
      shouldCreateOrder = true;
      try {
        console.log('Checking if workshop already has order_id...');
        const existingWorkshop = await getWorkshop(existingWorkshopId);

        if (existingWorkshop && existingWorkshop.order_id) {
          shouldCreateOrder = false;
          generatedOrderId = existingWorkshop.order_id;
          console.log('Workshop already has order_id:', generatedOrderId);
        } else {
          console.log('Workshop does not have an order_id, will create new order');
        }
      } catch (error) {
        console.error('Error checking existing workshop order_id:', error);
        // Continue with order creation if we can't check
      }

      if (shouldCreateOrder) {
        try {
          console.log('Creating order with customer data...');
          orderApiData = await createOrder(customerApiData);
          console.log('Order created successfully');

          // Store the generated order ID for the success message
          if (orderApiData && orderApiData.Order && orderApiData.Order.OrderID) {
            generatedOrderId = orderApiData.Order.OrderID;
          }
        } catch (error) {
          console.error('Failed to create order:', error);
          submitError = 'Failed to create order. Please try again.';
          isSubmitting = false;
          return;
        }
      }
    }

    // Log optional contacts before form submission
    console.log('Optional contacts before submission:', optionalContacts);

    // Separate new photos from existing photos
    const newPhotos = photos.filter(p => !p.isExisting).map(p => p.file);
    const existingPhotoUrls = photos.filter(p => p.isExisting).map(p => p.url);

    // Prepare form data
    const formData = {
      locationOfRepair,
      productName,
      clientsWorkOrder,
      makeModel,
      serialNumber,
      siteLocation,
      faultDescription,
      customerName,
      contactEmail,
      contactNumber,
      selectedCustomer,
      optionalContacts: optionalContacts || [],
      photos: newPhotos,
      existingPhotoUrls,
      startedWith,
      ...(existingWorkshopId && {
        customerApiData,
        orderApiData,
        order_id: generatedOrderId || null
      })
    };

    console.log('Submit form data:', formData);

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to create a workshop');
    }

    // Update status to "to_be_quoted" if current status is "draft" (only for existing workshops)
    if (existingWorkshopId && workshopStatus === 'draft') {
      (formData as any).status = 'to_be_quoted';
      console.log('Updating workshop status from draft to to_be_quoted');
    }

    // Submit to Supabase - either create new or update existing
    const submitPromise = existingWorkshopId
      ? updateWorkshop(existingWorkshopId, formData)
      : createWorkshop(formData, user.uid);

    submitPromise
      .then((workshop) => {
        console.log('Workshop saved successfully:', workshop);
        submitSuccess = true;

        // Show success modal with appropriate message
        const isUpdate = !!existingWorkshopId;
        const wasDraft = existingWorkshopId && workshopStatus === 'draft';
        const hadExistingOrder = !shouldCreateOrder && isUpdate;

        successMessage = isUpdate
          ? hadExistingOrder
            ? `Workshop updated successfully${wasDraft ? ' and status changed to "To Be Quoted"' : ''}!`
            : `Workshop updated successfully${wasDraft ? ' and status changed to "To Be Quoted"' : ''} and new order generated!`
          : 'Workshop created successfully!';

        showSuccessModal = true;

        if (!isUpdate) {
          // Reset form after successful creation
          resetForm();
        }
      })
      .catch((error) => {
        console.error('Error saving workshop:', error);
        submitError = error.message || 'Failed to save workshop. Please try again.';
      })
      .finally(() => {
        isSubmitting = false;
      });
  }

  function getSubmitButtonText() {
    if (!existingWorkshopId) {
      // New workshop creation - this should not happen since submit is only for existing workshops
      return 'Submit';
    }

    if (existingWorkshopId && workshopStatus === 'draft') {
      // Draft workshop - will create Maropost order and update status to 'to_be_quoted'
      return 'Create Maropost Order';
    }

    // Existing workshop that's not draft - will create order if needed
    return 'Create Order';
  }

  function getSubmitButtonLoadingText() {
    if (!existingWorkshopId) {
      // New workshop creation - this should not happen since submit is only for existing workshops
      return 'Submitting...';
    }

    if (existingWorkshopId && workshopStatus === 'draft') {
      // Draft workshop
      return 'Creating Maropost Order...';
    }

    // Existing workshop update
    return 'Creating Order...';
  }

  // API service functions are now imported from maropost service

  function resetForm() {
    // Reset all form fields
    locationOfRepair = 'Site';
    productName = '';
    clientsWorkOrder = '';
    makeModel = '';
    serialNumber = '';
    siteLocation = '';
    faultDescription = '';
    customerName = '';
    contactEmail = '';
    contactNumber = '';
    selectedCustomer = null;
    optionalContacts = [];
    workshopStatus = null;

    // Clear photos - only revoke URLs for new photos created with URL.createObjectURL
    photos.forEach(p => {
      if (!p.isExisting) {
        URL.revokeObjectURL(p.url);
      }
    });
    photos = [];

    // Clear errors
    siteLocationError = '';
    photoError = '';
    contactError = '';

    // Clear success modal state
    showSuccessModal = false;
    successMessage = '';
    generatedOrderId = '';
  }

  function closeSuccessModal() {
    showSuccessModal = false;
    successMessage = '';
    generatedOrderId = '';
  }
</script>

  <div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">{existingWorkshopId ? 'Edit Workshop Job' : 'Create Workshop Job'}</h1>
        <div class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Started via: <span class="font-medium capitalize">{startedWith}</span>
          {#if startedWith === 'camera'}
            📷
          {:else}
            📝
          {/if}
        </div>
      </div>
    </div>

    <!-- Submission Status Messages -->
    {#if submitSuccess}
      <div class="mx-6 mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
        ✅ Workshop {existingWorkshopId ? 'updated' : 'created'} successfully! {existingWorkshopId ? 'Changes have been saved.' : 'The form has been reset.'}
      </div>
    {/if}

    {#if submitError}
      <div class="mx-6 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        ❌ {submitError}
      </div>
    {/if}

    <form class="p-6 space-y-8">
      <div class="text-sm text-gray-600 mb-4">
        Fields marked with <span class="text-red-500">*</span> are required
      </div>
      <!-- Machine Information -->
      <div>
        <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
          <h2 class="font-medium text-gray-800">Machine Information</h2>
          <button
            type="button"
            on:click={() => isMachineInfoExpanded = !isMachineInfoExpanded}
            class="text-gray-600 hover:text-gray-800 p-1"
            aria-label={isMachineInfoExpanded ? 'Collapse section' : 'Expand section'}
          >
            <svg class="w-5 h-5 transform transition-transform {isMachineInfoExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
        </div>

        {#if !isMachineInfoExpanded}
          <!-- Collapsed Summary View -->
          <div class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <div class="mb-3">
              <h3 class="text-sm font-medium text-gray-800 mb-2">Machine Information Summary</h3>
              {#if machineInfoSummaryItems.length > 0}
                <div class="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-6">
                  {#each machineInfoSummaryItems as item}
                    <div class="flex items-center justify-between text-sm py-0.5">
                      <span class="text-gray-600 font-medium">{item.label}:</span>
                      <span class="text-gray-900 truncate ml-2">{item.value}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-sm text-gray-500 italic">No information entered yet</div>
              {/if}
            </div>
            <button
              type="button"
              on:click={() => isMachineInfoExpanded = true}
              class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Edit machine information
            </button>
          </div>
        {:else}
          <!-- Expanded Form View -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <fieldset class="bg-gray-100 rounded px-4 py-3">
                <legend class="block text-sm font-medium text-gray-700 mb-1">Location of Repair</legend>
                <div class="flex items-center gap-6">
                  <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input id="loc-site" type="radio" name="locationOfRepair" value="Site" bind:group={locationOfRepair} class="h-4 w-4 text-blue-600" />
                    <span>Site</span>
                  </label>
                  <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input id="loc-workshop" type="radio" name="locationOfRepair" value="Workshop" bind:group={locationOfRepair} class="h-4 w-4 text-blue-600" />
                    <span>Workshop</span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="product-name">
                Product Name <span class="text-red-500">*</span>
              </label>
              <input
                id="product-name"
                type="text"
                bind:value={productName}
                class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 {!productName.trim() ? 'border border-red-300' : ''}"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="client-wo">Client’s Work Order</label>
              <input id="client-wo" type="text" bind:value={clientsWorkOrder} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="make-model">Make/Model</label>
              <input id="make-model" type="text" bind:value={makeModel} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="serial-number">Serial Number</label>
              <input id="serial-number" type="text" bind:value={serialNumber} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="site-location">
                Site/Location
                <span class="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                id="site-location"
                type="text"
                bind:value={siteLocation}
                class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 {siteLocationError ? 'border-red-500' : ''}"
                placeholder={locationOfRepair === 'Site' ? 'Enter site location (optional)' : 'Enter location details (optional)'}
              />
              {#if siteLocationError}
                <div class="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                  {siteLocationError}
                </div>
              {/if}
              {#if startedWith === 'camera' && locationOfRepair === 'Site'}
                <div class="mt-2 p-2 bg-blue-100 border border-blue-200 text-blue-700 rounded text-sm">
                  💡 Tip: You can add site location details later if needed
                </div>
              {/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="fault-description">Fault Description</label>
              <textarea id="fault-description" rows="3" bind:value={faultDescription} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>
          </div>

        {/if}
      </div>

      <!-- User Information -->
      <div>
        <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
          <h2 class="font-medium text-gray-800">User Information</h2>
          <button
            type="button"
            on:click={() => isUserInfoExpanded = !isUserInfoExpanded}
            class="text-gray-600 hover:text-gray-800 p-1"
            aria-label={isUserInfoExpanded ? 'Collapse section' : 'Expand section'}
          >
            <svg class="w-5 h-5 transform transition-transform {isUserInfoExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
        </div>

        {#if !isUserInfoExpanded}
          <!-- Collapsed Summary View -->
          <div class="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <div class="mb-3">
              <h3 class="text-sm font-medium text-gray-800 mb-2">User Information Summary</h3>
              {#if userInfoSummaryItems.length > 0}
                <div class="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-6">
                  {#each userInfoSummaryItems as item}
                    <div class="flex items-center justify-between text-sm py-0.5">
                      <span class="text-gray-600 font-medium">{item.label}:</span>
                      <span class="text-gray-900 truncate ml-2">{item.value}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-sm text-gray-500 italic">No information entered yet</div>
              {/if}
            </div>
            <button
              type="button"
              on:click={() => isUserInfoExpanded = true}
              class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Edit user information
            </button>
          </div>
        {:else}
          <!-- Expanded Form View -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="customer-name">
                Customer Name (Maropost) <span class="text-red-500">*</span>
              </label>
              <div class="{!customerName.trim() ? 'border border-red-300 rounded' : ''}">
                <CustomerDropdown
                  id="customer-name"
                  bind:value={customerName}
                  placeholder="Search customers..."
                  on:select={handleCustomerSelect}
                  on:clear={handleCustomerClear}
                />
              </div>

              <!-- Selected Customer Display -->
              {#if selectedCustomer}
                <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="font-medium text-blue-900">
                        {getCustomerDisplayName(selectedCustomer)}
                      </div>
                      <div class="text-sm text-blue-700 mt-1">
                        {selectedCustomer.EmailAddress}
                      </div>
                      {#if selectedCustomer.BillingAddress.BillPhone}
                        <div class="text-sm text-blue-600">
                          📞 {selectedCustomer.BillingAddress.BillPhone}
                        </div>
                      {/if}
                      {#if selectedCustomer.BillingAddress.BillCity}
                        <div class="text-sm text-blue-600">
                          📍 {selectedCustomer.BillingAddress.BillCity}
                        </div>
                      {/if}
                    </div>
                    <button
                      type="button"
                      on:click={handleCustomerClear}
                      class="text-blue-500 hover:text-blue-700 ml-2"
                      aria-label="Clear selected customer"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              {/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="contact-email">Contact Email</label>
              <input id="contact-email" type="email" bind:value={contactEmail} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div class="md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1" for="contact-number">Contact Number</label>
              <input id="contact-number" type="tel" bind:value={contactNumber} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        {/if}
      </div>

      <!-- Photos -->
      <PhotoManager
        bind:photos
        bind:error={photoError}
        minPhotosRequired={MIN_PHOTOS_REQUIRED}
        on:photosUpdated={event => photos = event.detail.photos}
        on:error={event => photoError = event.detail.message}
      />

      <!-- Optional Contacts -->
      <ContactsManager
        bind:contacts={optionalContacts}
        bind:error={contactError}
        on:contactsUpdated={handleContactsUpdated}
        on:error={handleContactError}
      />

      <div class="flex justify-end gap-3">
        <a href="{base}/workshop" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</a>

        <!-- Update Job Button - always visible for data updates only -->
        <button
          type="button"
          on:click={handleUpdateJob}
          disabled={isSubmitting}
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if isSubmitting}
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating Job...
          {:else}
            {existingWorkshopId ? 'Update Job' : 'Create Job'}
          {/if}
        </button>

        <!-- Submit Button - for order creation and status transitions -->
        {#if existingWorkshopId}
          <button
            type="button"
            on:click={handleSubmit}
            disabled={isSubmitting}
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {getSubmitButtonLoadingText()}
            {:else}
              {getSubmitButtonText()}
            {/if}
          </button>
        {/if}
      </div>
    </form>
  </div>

  <!-- Success Modal -->
  <SuccessModal
    show={showSuccessModal}
    message={successMessage}
    orderId={generatedOrderId}
    on:close={closeSuccessModal}
  />
</div>


