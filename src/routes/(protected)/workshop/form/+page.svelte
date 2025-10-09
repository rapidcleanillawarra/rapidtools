<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import SuccessModal from '$lib/components/SuccessModal.svelte';
  import PostSubmissionModal from '$lib/components/PostSubmissionModal.svelte';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/firebase';
  import { get } from 'svelte/store';
  import { toastError, toastSuccess, toastInfo } from '$lib/utils/toast';

  // Import new services and components
  import { evaluateJobStatus, isPickupScheduleRequired, getSubmitButtonLoadingText } from './workshop-status.service';
  import {
    validateForm,
    determineSubmissionStatus,
    prepareFormData,
    getSuccessMessage,
    determineSuccessModal,
    handleCustomerSelect,
    handleCustomerClear,
    hasIncompleteContacts,
    validateAndPrepareSubmission
  } from './workshop-form.service';
  import { formStores, resetForm } from './workshop-form.store';

  // Import extracted components
  import MachineInfoSection from './components/MachineInfoSection.svelte';
  import UserInfoSection from './components/UserInfoSection.svelte';
  import ContactsSection from './components/ContactsSection.svelte';
  import PhotoSection from './components/PhotoSection.svelte';
  import DocketInfoSection from './components/DocketInfoSection.svelte';

  // Workshop services
  import { createWorkshop, getWorkshop, updateWorkshop } from '$lib/services/workshop';
  import { fetchCustomerData, createOrder } from '$lib/services/maropost';
  import { getCustomerDisplayName } from '$lib/services/customers';

  // Import all stores directly - we'll access them through formStores object

  // Local state not in store
  let loadedPhotos: string[] = [];
  let failedPhotos: string[] = [];
  let pendingAction: (() => void) | null = null;

  // Reactive statements to sync store values to component props
  $: locationOfRepair = $formStores.locationOfRepair;
  $: productName = $formStores.productName;
  $: clientsWorkOrder = $formStores.clientsWorkOrder;
  $: makeModel = $formStores.makeModel;
  $: serialNumber = $formStores.serialNumber;
  $: siteLocation = $formStores.siteLocation;
  $: faultDescription = $formStores.faultDescription;
  $: schedules = $formStores.schedules;
  $: pickupSchedule = $formStores.pickupSchedule;
  $: customerName = $formStores.customerName;
  $: contactEmail = $formStores.contactEmail;
  $: contactNumber = $formStores.contactNumber;
  $: selectedCustomer = $formStores.selectedCustomer;
  $: optionalContacts = $formStores.optionalContacts;
  $: contactError = $formStores.contactError;
  $: photos = $formStores.photos;
  $: photoError = $formStores.photoError;
  $: quoteDescription = $formStores.quoteDescription;
  $: stockOnHand = $formStores.stockOnHand;
  $: travelTime = $formStores.travelTime;
  $: callOut = $formStores.callOut;
  $: additionalInformation = $formStores.additionalInformation;
  $: labour = $formStores.labour;
  $: parts = $formStores.parts;
  $: quoteOrRepair = $formStores.quoteOrRepair;
  $: isMachineInfoExpanded = $formStores.isMachineInfoExpanded;
  $: isUserInfoExpanded = $formStores.isUserInfoExpanded;
  $: isOptionalContactsExpanded = $formStores.isOptionalContactsExpanded;
  $: isSubmitting = $formStores.isSubmitting;
  $: showSuccessModal = $formStores.showSuccessModal;
  $: showPostSubmissionModal = $formStores.showPostSubmissionModal;
  $: showIncompleteContactModal = $formStores.showIncompleteContactModal;
  $: showPickupSubmissionModal = $formStores.showPickupSubmissionModal;
  $: showPickupStatusChangeModal = $formStores.showPickupStatusChangeModal;
  $: successMessage = $formStores.successMessage;
  $: generatedOrderId = $formStores.generatedOrderId;
  $: showPhotoViewer = $formStores.showPhotoViewer;
  $: currentPhotoIndex = $formStores.currentPhotoIndex;
  $: existingWorkshopId = $formStores.existingWorkshopId;
  $: workshopStatus = $formStores.workshopStatus;
  $: existingOrderId = $formStores.existingOrderId;
  $: wasPickupJob = $formStores.wasPickupJob;
  $: customerApiData = $formStores.customerApiData;
  $: orderApiData = $formStores.orderApiData;
  $: minDateTime = $formStores.minDateTime;
  $: machineInfoSummaryItems = $formStores.machineInfoSummaryItems;
  $: userInfoSummaryItems = $formStores.userInfoSummaryItems;
  $: optionalContactsSummaryItems = $formStores.optionalContactsSummaryItems;

  // Photo URLs for PhotoViewer component
  $: photoUrls = photos.map(p => p.url);

  // Determine docket info background color based on quote or repair selection
  $: docketInfoBackgroundClass = quoteOrRepair === 'Quote'
    ? 'bg-purple-100 text-purple-800'
    : 'bg-green-100 text-green-800';

  // Get current job status evaluation using the service
  $: currentJobStatus = evaluateJobStatus({
    existingWorkshopId,
    workshopStatus,
    existingOrderId,
    locationOfRepair,
    siteLocation
  });


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
    console.log('Workshop ID from URL:', workshopId);
    if (workshopId) {
      existingWorkshopId = workshopId;
      console.log('Setting existingWorkshopId:', existingWorkshopId);
      loadExistingWorkshop(workshopId);
    }
  }

  async function loadExistingWorkshop(workshopId: string) {
    try {
      console.log('Loading workshop with ID:', workshopId);
      const workshop = await getWorkshop(workshopId);

      if (!workshop) {
        console.error('Workshop not found for ID:', workshopId);
        toastError('Workshop not found.');
        return;
      }

      console.log('Workshop loaded successfully:', workshop);

      // Set workshop status and order_id
      workshopStatus = workshop.status;
      existingOrderId = workshop.order_id || null;
      console.log('Workshop status set to:', workshopStatus);
      console.log('Existing order ID set to:', existingOrderId);

      // Populate form with existing workshop data
      locationOfRepair = workshop.location_of_repair || 'Site';
      productName = workshop.product_name || '';
      clientsWorkOrder = workshop.clients_work_order || '';
      makeModel = workshop.make_model || '';
      serialNumber = workshop.serial_number || '';
      siteLocation = workshop.site_location || '';
      schedules = workshop.schedules || null;
      faultDescription = workshop.fault_description || '';
      customerName = workshop.customer_name || '';
      contactEmail = workshop.contact_email || '';
      contactNumber = workshop.contact_number || '';
      selectedCustomer = workshop.customer_data;
      optionalContacts = workshop.optional_contacts || [];
      quoteOrRepaired: quoteOrRepair = workshop.quote_or_repaired || 'Quote';
      startedWith = workshop.started_with || 'form';

      // Load docket info if available
      if (workshop.docket_info) {
        quoteDescription = workshop.docket_info.quoteDescription || '';
        additionalInformation = workshop.docket_info.additionalInformation || '';
        stockOnHand = workshop.docket_info.stockOnHand || '';
        labour = workshop.docket_info.labour || '';
        travelTime = workshop.docket_info.travelTime || '';
        callOut = workshop.docket_info.callOut || '';
        parts = workshop.docket_info.parts || [{ sku: '', quantity: '' }];
        // Ensure at least one empty part row
        if (parts.length === 0) {
          parts = [{ sku: '', quantity: '' }];
        }
      }

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
      toastError('Failed to load existing workshop. Please try again.');
    }
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
    const result = handleCustomerSelect(customer);
    formStores.selectedCustomer.set(result.selectedCustomer);
    formStores.customerName.set(result.customerName);
    formStores.contactEmail.set(result.contactEmail);
    formStores.contactNumber.set(result.contactNumber);
  }

  function handleCustomerClear() {
    const result = handleCustomerClear();
    formStores.selectedCustomer.set(result.selectedCustomer);
    formStores.customerName.set(result.customerName);
    formStores.contactEmail.set(result.contactEmail);
    formStores.contactNumber.set(result.contactNumber);
  }

  function checkIncompleteContacts(action: () => void) {
    if (hasIncompleteContacts(contactsManager)) {
      pendingAction = action;
      formStores.showIncompleteContactModal.set(true);
      return true; // Has incomplete contacts, modal shown
    }
    return false; // No incomplete contacts
  }

  function proceedWithAction() {
    if (pendingAction) {
      pendingAction();
      pendingAction = null;
    }
    formStores.showIncompleteContactModal.set(false);
  }

  function clearIncompleteContact() {
    if (contactsManager) {
      contactsManager.clearIncompleteContact();
    }
    formStores.showIncompleteContactModal.set(false);
  }

  async function handleUpdateJob(event: Event) {
    event.preventDefault();

    // Validate and prepare submission using the service
    const validationResult = validateAndPrepareSubmission({
      existingWorkshopId,
      workshopStatus,
      existingOrderId,
      locationOfRepair,
      siteLocation,
      pickupSchedule,
      isPickupScheduleRequired,
      productName,
      customerName,
      schedules,
      photos,
      selectedCustomer,
      optionalContacts,
      startedWith,
      quoteOrRepair,
      customerApiData,
      orderApiData
    }, contactsManager);

    // Check for incomplete contacts modal
    if (validationResult.shouldShowIncompleteContactModal) {
      if (checkIncompleteContacts(() => handleUpdateJob(event))) {
        return; // Modal shown, action deferred
      }
    }

    // Check validation errors
    if (!validationResult.isValid && validationResult.errors) {
      toastError(`Please fill in all required fields: ${validationResult.errors.join(', ')}`);
      return;
    }

    // Clear any existing errors
    formStores.photoError.set('');

    // Start submission
    formStores.isSubmitting.set(true);

    try {
      // Prepare form data using the service
      const formData = prepareFormData({
      locationOfRepair,
      productName,
      clientsWorkOrder,
      makeModel,
      serialNumber,
      siteLocation,
      schedules,
      faultDescription,
      customerName,
      contactEmail,
      contactNumber,
      selectedCustomer,
        optionalContacts,
        photos,
        existingPhotoUrls: [],
      startedWith,
        quoteOrRepair,
        customerApiData,
        orderApiData
      }, photos, existingWorkshopId, workshopStatus);

    console.log('Update job form data:', formData);

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to update a workshop');
    }

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

      // Set success message
      formStores.successMessage.set(existingWorkshopId
        ? 'Workshop job updated successfully!'
        : 'Workshop created successfully and ready to be quoted!');

      // Show toast notification
      toastSuccess(formStores.successMessage);

      if (existingWorkshopId) {
        // For updates, show the regular success modal
        formStores.showSuccessModal.set(true);
      } else {
        // For new job creation, show the post-submission modal
        formStores.showPostSubmissionModal.set(true);
      }

      // Don't reset form immediately for new creations - let user choose in modal
    } catch (error) {
      console.error('Error saving workshop:', error);
      toastError(error instanceof Error ? error.message : 'Failed to save workshop. Please try again.');
    } finally {
      formStores.isSubmitting.set(false);
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    // Validate and prepare submission using the service
    const validationResult = validateAndPrepareSubmission({
      existingWorkshopId,
      workshopStatus,
      existingOrderId,
      locationOfRepair,
      siteLocation,
      pickupSchedule,
      isPickupScheduleRequired,
      productName,
      customerName,
      schedules,
      photos,
      selectedCustomer,
      optionalContacts,
      startedWith,
      quoteOrRepair,
      quoteDescription,
      additionalInformation,
      stockOnHand,
      labour,
      travelTime,
      callOut,
      parts,
      customerApiData,
      orderApiData
    }, contactsManager);

    // Check for incomplete contacts modal
    if (validationResult.shouldShowIncompleteContactModal) {
      if (checkIncompleteContacts(() => handleSubmit(event))) {
        return; // Modal shown, action deferred
      }
    }

    // Check validation errors
    if (!validationResult.isValid && validationResult.errors) {
      toastError(`Please fill in all required fields: ${validationResult.errors.join(', ')}`);
      return;
    }

    // Clear any existing errors
    formStores.photoError.set('');

    // Start submission
    formStores.isSubmitting.set(true);

    // Check if this is a pickup submission (only for NEW jobs, not existing pickup jobs)
    const isPickupSubmission = !existingWorkshopId && locationOfRepair === 'Site' && siteLocation.trim() !== '';

    let shouldCreateOrder = false;
    let generatedOrderId: string | null = null;

    // Only create Maropost orders for existing workshops that don't already have an order
    // New forms should never create Maropost orders
    // Pickup submissions should never create Maropost orders
    // Explicit check: if this is a brand new form with no existing data, never create order
    const isNewForm = !existingWorkshopId && !workshopStatus && !existingOrderId;

    if (isPickupSubmission) {
      console.log('This is a pickup submission - skipping Maropost order creation');
    } else if (isNewForm) {
      console.log('This is a new form with no existing data - skipping Maropost order creation');
    } else if (existingWorkshopId) {
      // Fetch customer data from API first
      try {
        console.log('Fetching customer data from API...');
        const customerData = await fetchCustomerData();
        formStores.customerApiData.set(customerData);
        console.log('Customer data fetched successfully');
      } catch (error) {
        console.error('Failed to fetch customer data:', error);
        toastError('Failed to fetch customer data. Please try again.');
        formStores.isSubmitting.set(false);
        return;
      }

      // Check if this workshop already has an order_id
      shouldCreateOrder = currentJobStatus.canCreateOrder;
      try {
        console.log('Checking if workshop already has order_id...');
        const existingWorkshop = await getWorkshop(existingWorkshopId);

        if (existingWorkshop && existingWorkshop.order_id) {
          shouldCreateOrder = false;
          generatedOrderId = existingWorkshop.order_id;
          formStores.generatedOrderId.set(generatedOrderId);
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
          const orderData = await createOrder(formStores.customerApiData);
          formStores.orderApiData.set(orderData);
          console.log('Order created successfully');

          // Store the generated order ID for the success message
          if (orderData && orderData.Order && orderData.Order.OrderID) {
            generatedOrderId = orderData.Order.OrderID;
            formStores.generatedOrderId.set(generatedOrderId);
          }
        } catch (error) {
          console.error('Failed to create order:', error);
          toastError('Failed to create order. Please try again.');
          formStores.isSubmitting.set(false);
          return;
        }
      }
    }

    // Log optional contacts before form submission
    console.log('Optional contacts before submission:', optionalContacts);

    // Prepare form data using the service
    const formData = prepareFormData({
      locationOfRepair,
      productName,
      clientsWorkOrder,
      makeModel,
      serialNumber,
      siteLocation,
      schedules,
      faultDescription,
      customerName,
      contactEmail,
      contactNumber,
      selectedCustomer,
      optionalContacts,
      photos,
      existingPhotoUrls: [],
      startedWith,
          quoteOrRepair,
          quoteDescription,
          additionalInformation,
          stockOnHand,
          labour,
          travelTime,
          callOut,
      parts,
        customerApiData,
      orderApiData
    }, photos, existingWorkshopId, workshopStatus, generatedOrderId);

    console.log('Submit form data:', formData);

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to create a workshop');
    }

    // Determine and set status based on submission type
    const newStatus = determineSubmissionStatus(
      existingWorkshopId,
      workshopStatus,
      locationOfRepair,
      formStores.wasPickupJob
    );

    // Set the status in form data
    (formData as any).status = newStatus;

    // Update wasPickupJob flag if this was a pickup job transition
    if (existingWorkshopId && workshopStatus === 'pickup') {
      formStores.wasPickupJob.set(true);
    }

    console.log('Final formData status:', (formData as any).status);

    // Submit to Supabase - either create new or update existing
    const submitPromise = existingWorkshopId
      ? updateWorkshop(existingWorkshopId, formData)
      : createWorkshop(formData, user.uid);

    submitPromise
      .then((workshop) => {
        console.log('Workshop saved successfully:', workshop);

        // Determine success message and modal type using services
        const successMessage = getSuccessMessage(
          existingWorkshopId,
          workshopStatus,
          locationOfRepair,
          formStores.wasPickupJob,
          quoteOrRepair
        );

        const modalType = determineSuccessModal(
          existingWorkshopId,
          workshopStatus,
          locationOfRepair,
          formStores.wasPickupJob
        );

        // Set success message and show appropriate modal
        formStores.successMessage.set(successMessage);
        formStores.generatedOrderId.set(generatedOrderId);

        // Show toast notification
        toastSuccess(successMessage);

        // Show appropriate modal
        switch (modalType) {
          case 'pickup_status_change':
            formStores.showPickupStatusChangeModal.set(true);
            break;
          case 'pickup_submission':
            formStores.showPickupSubmissionModal.set(true);
            break;
          case 'success':
            formStores.showSuccessModal.set(true);
            break;
          case 'post_submission':
            formStores.showPostSubmissionModal.set(true);
            break;
        }

        // Don't reset form immediately for new creations - let user choose in modal
      })
      .catch((error) => {
        console.error('Error saving workshop:', error);
        toastError(error.message || 'Failed to save workshop. Please try again.');
      })
      .finally(() => {
        formStores.isSubmitting.set(false);
        // Reset pickup job flag
        formStores.wasPickupJob.set(false);
      });
  }

  // Button text function using the service
  function getSubmitButtonText(): string {
    return getSubmitButtonLoadingText(currentJobStatus, existingWorkshopId, workshopStatus);
  }


  // API service functions are now imported from maropost service

  // Form reset is now handled by the store
  // function resetForm() is now imported from formStores

  function closeSuccessModal() {
    formStores.showSuccessModal.set(false);
    formStores.successMessage.set('');
    formStores.generatedOrderId.set('');
  }


  function navigateToJobStatus() {
    // Navigate to workshop job status page (don't reset form since we're navigating away)
    goto('/workshop/job-status');
  }

  function navigateToWorkshopBoard() {
    // Navigate to workshop board page (don't reset form since we're navigating away)
    goto('/workshop/workshop-board');
  }

  function closePickupSubmissionModal() {
    formStores.showPickupSubmissionModal.set(false);
  }

  function closePickupStatusChangeModal() {
    formStores.showPickupStatusChangeModal.set(false);
    // Force navigation to workshop board
    navigateToWorkshopBoard();
  }

  // Photo viewer functions
  function openPhotoViewer(photoIndex: number = 0) {
    if (photos.length === 0) return;
    formStores.currentPhotoIndex.set(photoIndex);
    formStores.showPhotoViewer.set(true);
  }

  function closePhotoViewer() {
    formStores.showPhotoViewer.set(false);
    formStores.currentPhotoIndex.set(0);
  }

  function handlePhotoLoad(photoUrl: string) {
    // Remove from failed if it was there
    failedPhotos = failedPhotos.filter(url => url !== photoUrl);
    // Add to loaded if not already there
    if (!loadedPhotos.includes(photoUrl)) {
      loadedPhotos = [...loadedPhotos, photoUrl];
    }
  }

  function handlePhotoError(photoUrl: string) {
    // Remove from loaded if it was there
    loadedPhotos = loadedPhotos.filter(url => url !== photoUrl);
    // Add to failed if not already there
    if (!failedPhotos.includes(photoUrl)) {
      failedPhotos = [...failedPhotos, photoUrl];
    }
  }

  function isPhotoReady(photoUrl: string) {
    return loadedPhotos.includes(photoUrl) && !failedPhotos.includes(photoUrl);
  }
</script>

  <div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex flex-col items-center space-y-3">
        <h1 class="text-2xl font-bold text-center">
          {#if existingWorkshopId && workshopStatus && workshopStatus !== 'new' && existingOrderId}
            Order #{existingOrderId}
          {:else if existingWorkshopId}
            Edit Workshop Job
          {:else}
            Create Workshop Job
          {/if}
        </h1>
        <div class="flex flex-wrap gap-2">
          <!-- Status Pill -->
          <div class="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            Status: <span class="font-semibold capitalize">{currentJobStatus.statusDisplay}</span>
          </div>

          <!-- Started Via Pill -->
          <div class="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            Started via: <span class="font-medium capitalize">{startedWith}</span>
            {#if startedWith === 'camera'}
              📷
            {:else}
              📝
            {/if}
          </div>
        </div>
      </div>
    </div>


    <form class="p-6 space-y-8">
      <div class="text-sm text-gray-600 mb-4">
        Fields marked with <span class="text-red-500">*</span> are required
      </div>
      <!-- Two Column Layout for Machine and User Information -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Machine Information -->
        <MachineInfoSection
          {currentJobStatus}
          bind:locationOfRepair={$formStores.locationOfRepair}
          bind:productName={$formStores.productName}
          bind:clientsWorkOrder={$formStores.clientsWorkOrder}
          bind:makeModel={$formStores.makeModel}
          bind:serialNumber={$formStores.serialNumber}
          bind:siteLocation={$formStores.siteLocation}
          bind:faultDescription={$formStores.faultDescription}
          bind:pickupSchedule={$formStores.pickupSchedule}
          {minDateTime}
          bind:isExpanded={$formStores.isMachineInfoExpanded}
          startedWith={$formStores.startedWith}
          on:pickupScheduleUpdate={(e) => {
            formStores.schedules.update(schedules => ({
              ...schedules,
              pickup_schedule: e.detail.value
            }));
          }}
        />

        <!-- User Information -->
        <UserInfoSection
          {currentJobStatus}
          bind:customerName={$formStores.customerName}
          bind:contactEmail={$formStores.contactEmail}
          bind:contactNumber={$formStores.contactNumber}
          bind:selectedCustomer={$formStores.selectedCustomer}
          bind:isExpanded={$formStores.isUserInfoExpanded}
          on:customerSelect={(e) => {
            formStores.selectedCustomer.set(e.detail.customer);
            formStores.customerName.set(e.detail.customerName);
            formStores.contactEmail.set(e.detail.contactEmail);
            formStores.contactNumber.set(e.detail.contactNumber);
          }}
          on:customerClear={() => {
            formStores.selectedCustomer.set(null);
            formStores.customerName.set('');
            formStores.contactEmail.set('');
            formStores.contactNumber.set('');
          }}
        />
      </div>

      <!-- Two Column Layout for Photos and Optional Contacts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Photos -->
        <PhotoSection
          bind:photos={$formStores.photos}
          bind:photoError={$formStores.photoError}
            workshopStatus={workshopStatus}
          on:photosUpdated={(e) => formStores.photos.set(e.detail.photos)}
          on:photoError={(e) => formStores.photoError.set(e.detail.message)}
          on:photoClick={(e) => openPhotoViewer(e.detail.photoIndex)}
        />

        <!-- Optional Contacts -->
        <ContactsSection
          {currentJobStatus}
          bind:optionalContacts={$formStores.optionalContacts}
          bind:contactError={$formStores.contactError}
          bind:isExpanded={$formStores.isOptionalContactsExpanded}
          on:contactsUpdated={(e) => formStores.optionalContacts.set(e.detail.contacts)}
          on:contactError={(e) => formStores.contactError.set(e.detail.message)}
        />
      </div>

      <!-- Docket Info - Only show for non-new and non-pickup workshops -->
      <DocketInfoSection
        {workshopStatus}
        bind:quoteOrRepair={$formStores.quoteOrRepair}
        bind:quoteDescription={$formStores.quoteDescription}
        bind:additionalInformation={$formStores.additionalInformation}
        bind:stockOnHand={$formStores.stockOnHand}
        bind:labour={$formStores.labour}
        bind:travelTime={$formStores.travelTime}
        bind:callOut={$formStores.callOut}
        bind:parts={$formStores.parts}
      />

      <div class="flex justify-end gap-3">
        <a href="{base}/workshop/job-status" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</a>

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

        <!-- Submit Button - for order creation, status transitions, and updates -->
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

  <!-- Post-Submission Modal -->
  <PostSubmissionModal
    show={showPostSubmissionModal}
    message={successMessage}
    orderId={generatedOrderId}
    isPickup={isPickupSubmission}
    on:navigateToWorkshopBoard={navigateToWorkshopBoard}
  />

  <!-- Incomplete Contact Modal -->
  {#if showIncompleteContactModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Incomplete Contact Information</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600">
            You have started entering contact information but haven't completed it yet. What would you like to do?
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            type="button"
            on:click={clearIncompleteContact}
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Clear & Continue
          </button>
          <button
            type="button"
            on:click={() => showIncompleteContactModal = false}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Photo Viewer Modal -->
  <PhotoViewer
    {showPhotoViewer}
    {photoUrls}
    {currentPhotoIndex}
    {loadedPhotos}
    {failedPhotos}
    on:close={closePhotoViewer}
    on:photoIndexChanged={({ detail }) => currentPhotoIndex = detail.index}
  />

  <!-- Pickup Submission Modal -->
  {#if showPickupSubmissionModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Pickup Job Submitted</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600">
            Your pickup job has been successfully submitted and is now ready to be quoted. The job status has been updated to "To Be Quoted".
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={navigateToWorkshopBoard}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Pickup Status Change Modal (for new pickup jobs) -->
  {#if showPickupStatusChangeModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Pickup Job Created</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            Your workshop job has been successfully created as a pickup job. The equipment is scheduled for collection and will be brought to the workshop for repair.
          </p>
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Next Step:</strong> Monitor the workshop board to track when the equipment arrives and the job status updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closePickupStatusChangeModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Go to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>


