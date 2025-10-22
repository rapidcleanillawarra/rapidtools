<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import CustomerDropdown from '$lib/components/CustomerDropdown.svelte';
  import PhotoManager from '$lib/components/PhotoManager.svelte';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import ContactsManager from '$lib/components/ContactsManager.svelte';
  import type { PhotoItem, Contact } from '$lib/types/workshop';
  import SuccessModal from '$lib/components/SuccessModal.svelte';
  import PostSubmissionModal from '$lib/components/PostSubmissionModal.svelte';
  import type { Customer } from '$lib/services/customers';
  import { getCustomerDisplayName } from '$lib/services/customers';
  import { createWorkshop, getPhotoStatistics, cleanupOrphanedPhotos, getWorkshop, updateWorkshop } from '$lib/services/workshop';
  import { fetchCustomerData, createOrder } from '$lib/services/maropost';
  import { validateWorkshopForm } from '$lib/utils/validation';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/firebase';
  import { get, writable } from 'svelte/store';
  import { toastError, toastSuccess, toastInfo } from '$lib/utils/toast';

  type LocationType = 'Site' | 'Workshop';

  // Machine Information
  let locationOfRepair: LocationType = 'Site';
  let productName = '';
  let clientsWorkOrder = '';
  let makeModel = '';
  let serialNumber = '';
  let siteLocation = '';
  let faultDescription = '';
  let schedules: any = null;

  // Computed property for pickup schedule
  $: pickupSchedule = schedules?.pickup_schedule || '';

  // Function to update pickup schedule
  function updatePickupSchedule(value: string) {
    schedules = {
      ...schedules,
      pickup_schedule: value
    };
  }

  // Function to format pickup schedule for display
  function formatPickupSchedule(datetimeString: string): string {
    if (!datetimeString) return '';

    try {
      const date = new Date(datetimeString);

      // Format as "Sep 17, 2:30 PM"
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Error formatting pickup schedule:', error);
      return datetimeString; // Return original string if formatting fails
    }
  }

  // Get minimum date/time for pickup schedule (current date/time)
  $: minDateTime = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  })();

  // User Information
  let customerName = '';
  let contactEmail = '';
  let contactNumber = '';

  // Customer selection
  let selectedCustomer: Customer | null = null;

  // Optional Contacts
  let optionalContacts: Contact[] = [];
  let contactError = '';
  let contactsManager: any = null;

  // Photos (always visible Photos section)
  let photos: PhotoItem[] = [];
  let photoError = '';
  const MIN_PHOTOS_REQUIRED = 0; // Photos are now optional

  // Docket Info (new section)
  let quoteDescription: string = '';
  let stockOnHand: string = '';
  let travelTime: string = '';
  let callOut: string = '';

  type QuoteOrRepairType = 'Quote' | 'Repaired';
  let quoteOrRepair: QuoteOrRepairType = 'Quote';

  type PartItem = { sku: string; quantity: string };
  let parts: PartItem[] = [
    { sku: '', quantity: '' }
  ];

  function addPartRow() {
    parts = [...parts, { sku: '', quantity: '' }];
  }

  function removePartRow(index: number) {
    // Don't remove if it's the last row
    if (parts.length <= 1) return;

    // Remove the part at the specified index
    parts = parts.filter((_, i) => i !== index);

    // If we now have no parts, add an empty one back
    if (parts.length === 0) {
      parts = [{ sku: '', quantity: '' }];
    }
  }

  let additionalInformation: string = '';
  let labour: string = '';

  // Photo viewer modal state
  let showPhotoViewer = false;
  let currentPhotoIndex = 0;



  // Form submission state
  let isSubmitting = false;

  // Success modal state
  let showSuccessModal = false;
  let successMessage = '';
  let generatedOrderId = '';

  // Post-submission modal state (for new job creation)
  let showPostSubmissionModal = false;

    // Track if current submission is a pickup
    let isPickupSubmission = false;

    // Track if this was originally a pickup job
    let wasPickupJob = false;

  // Incomplete contact modal state
  let showIncompleteContactModal = false;
  let pendingAction: (() => void) | null = null;

  // Pickup submission modal state
  let showPickupSubmissionModal = false;

  // Pickup status change modal state (for new pickup jobs)
  let showPickupStatusChangeModal = false;

  // Docket ready modal state (for to_be_quoted submissions)
  let showDocketReadyModal = false;

  // Waiting approval PO modal state (for quoted submissions)
  let showWaitingApprovalModal = false;

  // Waiting for parts modal state (for waiting_approval_po submissions)
  let showWaitingForPartsModal = false;

  // Booked in for repair modal state (for waiting_for_parts submissions)
  let showBookedInRepairModal = false;

  // Repaired modal state (for booked_in_for_repair_service submissions)
  let showRepairedModal = false;

  // Return modal state (for repaired submissions)
  let showReturnModal = false;

  // Customer data from API
  let customerApiData: any = null;
  // Order data from API
  let orderApiData: any = null;

  // Determine entry point
  let startedWith: 'form' | 'camera' = 'form';
  let existingWorkshopId: string | null = null;
  let workshopStatus: JobStatus = null;
  let existingOrderId: string | null = null;

  // Store for submit button text to ensure reactivity
  const submitButtonTextStore = writable('Loading...');

  // Debug submit button text updates
  $: {
    const newButtonText = currentJobStatus.buttonText;
    const currentStoreValue = get(submitButtonTextStore);
    console.log('Submit button text evaluation:', {
      existingWorkshopId,
      workshopStatus,
      currentJobStatus,
      newButtonText,
      currentStoreValue,
      isDifferent: newButtonText !== currentStoreValue,
      timestamp: new Date().toISOString()
    });
    if (newButtonText !== currentStoreValue) {
      console.log('Updating submit button text from', currentStoreValue, 'to', newButtonText);
      submitButtonTextStore.set(newButtonText);
    }
  }

  // Photo URLs for PhotoViewer component
  $: photoUrls = photos.map(p => p.url);


  // Machine Information section state
  let isMachineInfoExpanded = true;

  // User Information section state
  let isUserInfoExpanded = true;

  // Optional Contacts section state
  let isOptionalContactsExpanded = false;

  // Auto-collapse sections for non-new workshops
  $: if (existingWorkshopId && workshopStatus && workshopStatus !== 'new') {
    isMachineInfoExpanded = false;
    isUserInfoExpanded = false;
    isOptionalContactsExpanded = false;
  }


  // Generate summary for machine information
  $: machineInfoSummaryItems = (() => {
    const items = [];
    if (productName.trim()) items.push({ label: 'Product', value: productName, priority: 1 });
    if (locationOfRepair) items.push({ label: 'Location', value: locationOfRepair, priority: 2 });
    if (makeModel.trim()) items.push({ label: 'Make/Model', value: makeModel, priority: 3 });
    if (serialNumber.trim()) items.push({ label: 'Serial', value: serialNumber, priority: 4 });
    if (siteLocation.trim()) items.push({ label: 'Site', value: siteLocation, priority: 5 });
    if (pickupSchedule.trim()) items.push({ label: 'Pickup Schedule', value: formatPickupSchedule(pickupSchedule), priority: 6 });
    if (faultDescription.trim()) items.push({ label: 'Fault Description', value: faultDescription, priority: 7 });
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

  // Generate summary for optional contacts
  $: optionalContactsSummaryItems = (() => {
    const items: Array<{
      label: string;
      value: string;
      phone: string;
      email: string;
      priority: number;
    }> = [];
    optionalContacts.forEach((contact, index) => {
      if (contact.name.trim()) items.push({
        label: `Contact ${index + 1}`,
        value: contact.name,
        phone: contact.number,
        email: contact.email,
        priority: index + 1
      });
    });
    return items.sort((a, b) => a.priority - b.priority);
  })();

  // Determine docket info background color based on quote or repair selection
  $: docketInfoBackgroundClass = quoteOrRepair === 'Quote'
    ? 'bg-purple-100 text-purple-800'
    : 'bg-green-100 text-green-800';

  // Determine if pickup schedule is required (new jobs with Site location)
  $: isPickupScheduleRequired = (workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site';


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
      const workshop = await getWorkshop(workshopId);

      if (!workshop) {
        console.error('Workshop not found for ID:', workshopId);
        toastError('Workshop not found.');
        return;
      }

      // Set workshop status and order_id
      workshopStatus = workshop.status;
      existingOrderId = workshop.order_id || null;

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

  function checkIncompleteContacts(action: () => void) {
    if (contactsManager && contactsManager.hasIncompleteContact()) {
      pendingAction = action;
      showIncompleteContactModal = true;
      return true; // Has incomplete contacts, modal shown
    }
    return false; // No incomplete contacts
  }

  function proceedWithAction() {
    if (pendingAction) {
      pendingAction();
      pendingAction = null;
    }
    showIncompleteContactModal = false;
  }

  function clearIncompleteContact() {
    if (contactsManager) {
      contactsManager.clearIncompleteContact();
    }
    showIncompleteContactModal = false;
  }

  async function handleUpdateJob(event: Event) {
    event.preventDefault();

    // Check for incomplete contacts first
    if (checkIncompleteContacts(() => handleUpdateJob(event))) {
      return; // Modal shown, action deferred
    }

    // Reset previous states

    // Validate required fields using validation utility
    const isNewPickupJob = (workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site';
    const validation = validateWorkshopForm({
      productName,
      customerName,
      locationOfRepair,
      siteLocation,
      pickupSchedule,
      isNewPickupJob
    });

    if (!validation.isValid) {
      toastError(`Please fill in all required fields: ${validation.errors.join(', ')}`);
      return;
    }

    // Clear any existing errors
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
      schedules,
      faultDescription,
      customerName,
      contactEmail,
      contactNumber,
      selectedCustomer,
      optionalContacts: optionalContacts || [],
      photos: newPhotos,
      existingPhotoUrls,
      startedWith,
      quoteOrRepaired: quoteOrRepair
      // Note: No status changes, no order creation for update job
    };

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
      } else {
        // Create new workshop
        workshop = await createWorkshop(formData, user.uid);
      }

      successMessage = existingWorkshopId
        ? 'Workshop job updated successfully!'
        : 'Workshop created successfully and ready to be quoted!';

      // Show toast notification
      toastSuccess(successMessage);

      if (existingWorkshopId) {
        // For updates, show the regular success modal
        showSuccessModal = true;
      } else {
        // For new job creation, show the post-submission modal
        showPostSubmissionModal = true;
      }

      // Don't reset form immediately for new creations - let user choose in modal
    } catch (error) {
      console.error('Error saving workshop:', error);
      toastError(error instanceof Error ? error.message : 'Failed to save workshop. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    // Check for incomplete contacts first
    if (checkIncompleteContacts(() => handleSubmit(event))) {
      return; // Modal shown, action deferred
    }

    // Reset previous states

    // Validate required fields using validation utility
    const isNewPickupJob = (workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site';
    const validation = validateWorkshopForm({
      productName,
      customerName,
      locationOfRepair,
      siteLocation,
      pickupSchedule,
      isNewPickupJob
    });

    if (!validation.isValid) {
      toastError(`Please fill in all required fields: ${validation.errors.join(', ')}`);
      return;
    }

    // Clear any existing errors
    photoError = '';

    // Start submission
    isSubmitting = true;

    // Check if this is a pickup submission (only for NEW jobs, not existing pickup jobs)
    isPickupSubmission = !existingWorkshopId && locationOfRepair === 'Site' && siteLocation.trim() !== '';

    let shouldCreateOrder = false;

    // Only create Maropost orders for existing workshops that don't already have an order
    // New forms should never create Maropost orders
    // Pickup submissions should never create Maropost orders
    // Explicit check: if this is a brand new form with no existing data, never create order
    const isNewForm = !existingWorkshopId && !workshopStatus && !existingOrderId;
    if (isPickupSubmission) {
      // This is a pickup submission - skipping Maropost order creation
    } else if (isNewForm) {
      // This is a new form with no existing data - skipping Maropost order creation
    } else if (existingWorkshopId) {
      // ALWAYS check if workshop already has an order_id to prevent duplicates
      try {
        const existingWorkshop = await getWorkshop(existingWorkshopId);

        if (existingWorkshop && existingWorkshop.order_id) {
          shouldCreateOrder = false;
          generatedOrderId = existingWorkshop.order_id;
        } else {
          // Only create order if workshop doesn't have one AND status allows it
          shouldCreateOrder = currentJobStatus.canCreateOrder;
        }
      } catch (error) {
        console.error('Error checking existing workshop order_id:', error);
        // If we can't check, err on the side of caution and don't create order
        shouldCreateOrder = false;
      }

      // Only fetch customer data if we're actually going to create an order
      if (shouldCreateOrder) {
        try {
          customerApiData = await fetchCustomerData();
        } catch (error) {
          console.error('Failed to fetch customer data:', error);
          toastError('Failed to fetch customer data. Please try again.');
          isSubmitting = false;
          return;
        }
      }

      if (shouldCreateOrder) {
        try {
          orderApiData = await createOrder(customerApiData);

          // Store the generated order ID for the success message
          if (orderApiData && orderApiData.Order && orderApiData.Order.OrderID) {
            generatedOrderId = orderApiData.Order.OrderID;
          }
        } catch (error) {
          console.error('Failed to create order:', error);
          toastError('Failed to create order. Please try again.');
          isSubmitting = false;
          return;
        }
      }
    }

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
      schedules,
      faultDescription,
      customerName,
      contactEmail,
      contactNumber,
      selectedCustomer,
      optionalContacts: optionalContacts || [],
      photos: newPhotos,
      existingPhotoUrls,
      startedWith,
      quoteOrRepaired: quoteOrRepair,
      // Include docket info when submitting from "to_be_quoted" status
      ...(existingWorkshopId && workshopStatus === 'to_be_quoted' && {
        docket_info: {
          quoteOrRepair,
          quoteDescription,
          additionalInformation,
          stockOnHand,
          labour,
          travelTime,
          callOut,
          parts: parts.filter(part => part.sku.trim() || part.quantity.trim()) // Only include non-empty parts
        }
      }),
      ...(existingWorkshopId && {
        customerApiData,
        orderApiData,
        order_id: generatedOrderId || null
      })
    };

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to create a workshop');
    }

    // Set status based on submission type - using centralized job status logic

    // Simple logic: if current status is new and location is Site, set to pickup
    if ((workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site') {
      (formData as any).status = 'pickup';
    } else if (existingWorkshopId && workshopStatus === 'pickup') {
      // For existing pickup jobs being submitted, update to "to_be_quoted"
      (formData as any).status = 'to_be_quoted';
      wasPickupJob = true;
    } else if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
      // For existing "to_be_quoted" jobs, change status to docket_ready
      (formData as any).status = 'docket_ready';
    } else if (existingWorkshopId && workshopStatus === 'docket_ready') {
      // For existing "docket_ready" jobs, change status to quoted or repaired based on quoteOrRepair field
      (formData as any).status = quoteOrRepair === 'Quote' ? 'quoted' : 'repaired';
    } else if (existingWorkshopId && workshopStatus === 'quoted') {
      // For existing "quoted" jobs, change status to waiting_approval_po
      (formData as any).status = 'waiting_approval_po';
    } else if (existingWorkshopId && workshopStatus === 'waiting_approval_po') {
      // For existing "waiting_approval_po" jobs, change status to waiting_for_parts
      (formData as any).status = 'waiting_for_parts';
    } else if (existingWorkshopId && workshopStatus === 'waiting_for_parts') {
      // For existing "waiting_for_parts" jobs, change status to booked_in_for_repair_service
      (formData as any).status = 'booked_in_for_repair_service';
    } else if (existingWorkshopId && workshopStatus === 'booked_in_for_repair_service') {
      // For existing "booked_in_for_repair_service" jobs, change status to repaired
      (formData as any).status = 'repaired';
    } else if (existingWorkshopId && workshopStatus === 'repaired') {
      // For existing "repaired" jobs, change status to return
      (formData as any).status = 'return';
    } else {
      // Default: set to "to_be_quoted"
      (formData as any).status = 'to_be_quoted';
    }

    // Submit to Supabase - either create new or update existing
    const submitPromise = existingWorkshopId
      ? updateWorkshop(existingWorkshopId, formData)
      : createWorkshop(formData, user.uid);

    submitPromise
      .then((workshop) => {

        // Show success modal with appropriate message
        const isUpdate = !!existingWorkshopId;
        const wasNew = existingWorkshopId && workshopStatus === 'new';
        const wasToBeQuoted = existingWorkshopId && workshopStatus === 'to_be_quoted';
        const hadExistingOrder = !shouldCreateOrder && isUpdate;

        // Set success message based on status change
        if ((workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site') {
          successMessage = 'Workshop created successfully as a pickup job!';
        } else if (wasPickupJob) {
          successMessage = 'Pickup job submitted successfully and moved to "To Be Quoted" status!';
        } else if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
          successMessage = 'Workshop docket information saved successfully and status updated to "Docket Ready"!';
        } else if (existingWorkshopId && workshopStatus === 'docket_ready') {
          successMessage = `Workshop successfully marked as ${quoteOrRepair === 'Quote' ? 'Quoted' : 'Repaired'}!`;
        } else if (existingWorkshopId && workshopStatus === 'quoted') {
          successMessage = 'Workshop successfully moved to "Waiting Approval PO" status!';
        } else if (existingWorkshopId && workshopStatus === 'waiting_approval_po') {
          successMessage = 'Workshop successfully moved to "Waiting For Parts" status!';
        } else if (existingWorkshopId && workshopStatus === 'waiting_for_parts') {
          successMessage = 'Workshop successfully booked in for repair service!';
        } else if (existingWorkshopId && workshopStatus === 'booked_in_for_repair_service') {
          successMessage = 'Workshop successfully marked as repaired!';
        } else if (existingWorkshopId && workshopStatus === 'repaired') {
          successMessage = 'Workshop successfully prepared for return to customer!';
        } else {
          successMessage = isUpdate
            ? wasToBeQuoted
              ? `Workshop updated successfully and marked as ${quoteOrRepair === 'Quote' ? 'Quoted' : 'Repaired'}!`
              : hadExistingOrder
                ? `Workshop updated successfully${wasNew ? ' and status changed to "To Be Quoted"' : ''}!`
                : `Workshop updated successfully${wasNew ? ' and status changed to "To Be Quoted"' : ''} and new order generated!`
            : 'Workshop created successfully and ready to be quoted!';
        }

        // Show toast notification
        toastSuccess(successMessage);

        if ((workshopStatus === 'new' || !existingWorkshopId) && locationOfRepair === 'Site') {
          // For new pickup submissions, show the pickup status change modal that forces workshop board navigation
          showPickupStatusChangeModal = true;
        } else if (wasPickupJob) {
          // For pickup job submissions, show the pickup submission modal
          showPickupSubmissionModal = true;
        } else if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
          // For existing "to_be_quoted" jobs submitted, show the docket ready modal
          showDocketReadyModal = true;
        } else if (existingWorkshopId && workshopStatus === 'quoted') {
          // For existing "quoted" jobs submitted, show the waiting approval modal
          showWaitingApprovalModal = true;
        } else if (existingWorkshopId && workshopStatus === 'waiting_approval_po') {
          // For existing "waiting_approval_po" jobs submitted, show the waiting for parts modal
          showWaitingForPartsModal = true;
        } else if (existingWorkshopId && workshopStatus === 'waiting_for_parts') {
          // For existing "waiting_for_parts" jobs submitted, show the booked in repair modal
          showBookedInRepairModal = true;
        } else if (existingWorkshopId && workshopStatus === 'booked_in_for_repair_service') {
          // For existing "booked_in_for_repair_service" jobs submitted, show the repaired modal
          showRepairedModal = true;
        } else if (existingWorkshopId && workshopStatus === 'repaired') {
          // For existing "repaired" jobs submitted, show the return modal
          showReturnModal = true;
        } else if (isUpdate) {
          // For regular updates, show the regular success modal
          showSuccessModal = true;
        } else if (!existingWorkshopId && locationOfRepair !== 'Site') {
          // For new non-pickup job creation, navigate directly to workshop board
          navigateToWorkshopBoard();
        } else {
          // For new job creation (fallback), show the post-submission modal
          showPostSubmissionModal = true;
        }

        // Don't reset form immediately for new creations - let user choose in modal
      })
      .catch((error) => {
        console.error('Error saving workshop:', error);
        toastError(error.message || 'Failed to save workshop. Please try again.');
      })
      .finally(() => {
        isSubmitting = false;
        // Reset pickup job flag
        wasPickupJob = false;
      });
  }

  // ============================================
  // JOB STATUS MANAGEMENT - CRITICAL BUSINESS LOGIC
  // ============================================
  // This function centralizes all job status checks and determines
  // what actions are allowed based on the current state.
  // DO NOT MODIFY THIS WITHOUT CAREFUL CONSIDERATION OF BUSINESS IMPACT

  type JobStatus = 'new' | 'pickup' | 'to_be_quoted' | 'docket_ready' | 'quoted' | 'repaired' | 'waiting_approval_po' | 'waiting_for_parts' | 'booked_in_for_repair_service' | 'pending_jobs' | null;

  interface JobStatusContext {
    existingWorkshopId: string | null;
    workshopStatus: JobStatus;
    existingOrderId: string | null;
    locationOfRepair: 'Site' | 'Workshop';
    siteLocation: string;
    quoteOrRepair: QuoteOrRepairType;
  }

  interface JobStatusResult {
    canEditMachineInfo: boolean;
    canEditUserInfo: boolean;
    canEditContacts: boolean;
    canCreateOrder: boolean;
    canPickup: boolean;
    buttonText: string;
    statusDisplay: string;
    priority: number; // Lower number = higher priority
  }

  /**
   * CRITICAL: Evaluates job status and determines allowed actions
   * This function contains the core business logic for job state management.
   * All status-dependent behavior should derive from this single source of truth.
   */
  function evaluateJobStatus(context: JobStatusContext): JobStatusResult {
    const { existingWorkshopId, workshopStatus, existingOrderId, locationOfRepair, siteLocation, quoteOrRepair } = context;


    // ============================================
    // PRIORITY 1: PICKUP STATUS JOBS (Highest Priority)
    // ============================================
    // Jobs that are already in pickup status (delivered to workshop)
    if (existingWorkshopId && workshopStatus === 'pickup') {
      return {
        canEditMachineInfo: false,  // Pickup jobs cannot modify machine info
        canEditUserInfo: false,     // Pickup jobs cannot modify user info
        canEditContacts: false,     // Pickup jobs cannot modify contacts
        canCreateOrder: false,      // Pickup jobs never create Maropost orders
        canPickup: false,          // Already picked up
        buttonText: 'Delivered/To Be Quoted',
        statusDisplay: 'Pickup',
        priority: 1
      };
    }


    // ============================================
    // PRIORITY 2: NEW JOBS
    // ============================================
    // Brand new jobs that haven't been saved yet
    if (workshopStatus === 'new') {
      // Special case: If location is Site, this becomes a pickup job
      const isPickupJob = locationOfRepair === 'Site';

      return {
        canEditMachineInfo: true,   // Can edit everything for new jobs
        canEditUserInfo: true,
        canEditContacts: true,
        canCreateOrder: false,      // New jobs don't create orders until submitted
        canPickup: isPickupJob,     // Site repairs are pickup jobs
        buttonText: isPickupJob ? 'Pickup →' : 'To be Quoted',
        statusDisplay: 'New',
        priority: 2
      };
    }

  // ============================================
  // PRIORITY 3: BRAND NEW FORMS (No existing workshop)
  // ============================================
  // Forms that are being created from scratch (no workshop_id in URL)
  if (!existingWorkshopId) {
    // Special case: If location is Site, this becomes a pickup job
    const isPickupJob = locationOfRepair === 'Site';

    return {
      canEditMachineInfo: true,   // Can edit everything for new forms
      canEditUserInfo: true,
      canEditContacts: true,
      canCreateOrder: false,      // New forms don't create orders until submitted
      canPickup: isPickupJob,     // Site repairs are pickup jobs
      buttonText: isPickupJob ? 'Pickup →' : 'Create Job',
      statusDisplay: 'New',
      priority: 3
    };
  }

    // ============================================
    // PRIORITY 4: TO BE QUOTED STATUS
    // ============================================
    // Jobs that are ready for quoting/docket creation
    if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info once quoted
        canEditUserInfo: false,     // Cannot edit user info once quoted
        canEditContacts: true,      // Can still add contacts for quoted jobs
        canCreateOrder: !existingOrderId, // Can create order if doesn't have one
        canPickup: false,          // Quoted jobs aren't pickups
        buttonText: 'Docket Ready',
        statusDisplay: 'To Be Quoted',
        priority: 4
      };
    }

    // ============================================
    // PRIORITY 4.1: DOCKET READY STATUS
    // ============================================
    // Jobs that have docket information ready
    if (existingWorkshopId && workshopStatus === 'docket_ready') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info once docket is ready
        canEditUserInfo: false,     // Cannot edit user info once docket is ready
        canEditContacts: false,     // Cannot edit contacts once docket is ready
        canCreateOrder: false,      // Docket ready jobs don't create new orders
        canPickup: false,          // Docket ready jobs aren't pickups
        buttonText: quoteOrRepair === 'Quote' ? 'Quoted' : 'Repaired',
        statusDisplay: 'Docket Ready',
        priority: 4.1
      };
    }

    // ============================================
    // PRIORITY 4.5: COMPLETED JOBS (Quoted or Repaired)
    // ============================================
    // Jobs that have been quoted or repaired (final statuses)
    if (existingWorkshopId && (workshopStatus === 'quoted' || workshopStatus === 'repaired')) {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info for completed jobs
        canEditUserInfo: false,     // Cannot edit user info for completed jobs
        canEditContacts: false,     // Cannot edit contacts for completed jobs
        canCreateOrder: false,      // Completed jobs don't create new orders
        canPickup: false,          // Completed jobs aren't pickups
        buttonText: workshopStatus === 'quoted' ? 'Waiting Approval PO' : 'Update Job',
        statusDisplay: workshopStatus === 'quoted' ? 'Quoted' : 'Repaired',
        priority: 4.5
      };
    }

    // ============================================
    // PRIORITY 4.6: WAITING APPROVAL PO STATUS
    // ============================================
    // Jobs that are waiting for PO approval
    if (existingWorkshopId && workshopStatus === 'waiting_approval_po') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info while waiting for approval
        canEditUserInfo: false,     // Cannot edit user info while waiting for approval
        canEditContacts: false,     // Cannot edit contacts while waiting for approval
        canCreateOrder: false,      // Already processed for approval
        canPickup: false,          // Not a pickup job
        buttonText: 'Waiting For Parts',
        statusDisplay: 'Waiting Approval PO',
        priority: 4.6
      };
    }

    // ============================================
    // PRIORITY 4.6.5: WAITING FOR PARTS STATUS
    // ============================================
    // Jobs that are waiting for parts
    if (existingWorkshopId && workshopStatus === 'waiting_for_parts') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info while waiting for parts
        canEditUserInfo: false,     // Cannot edit user info while waiting for parts
        canEditContacts: false,     // Cannot edit contacts while waiting for parts
        canCreateOrder: false,      // Already processed
        canPickup: false,          // Not a pickup job
        buttonText: 'Booked In For Repair',
        statusDisplay: 'Waiting For Parts',
        priority: 4.65
      };
    }

    // ============================================
    // PRIORITY 4.7: BOOKED IN FOR REPAIR SERVICE STATUS
    // ============================================
    // Jobs that are booked in for repair service
    if (existingWorkshopId && workshopStatus === 'booked_in_for_repair_service') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info while in repair
        canEditUserInfo: false,     // Cannot edit user info while in repair
        canEditContacts: false,     // Cannot edit contacts while in repair
        canCreateOrder: false,      // Already processed
        canPickup: false,          // Not a pickup job
        buttonText: 'Repaired',
        statusDisplay: 'Booked In For Repair Service',
        priority: 4.7
      };
    }

    // ============================================
    // PRIORITY 4.8: REPAIRED STATUS
    // ============================================
    // Jobs that have been repaired
    if (existingWorkshopId && workshopStatus === 'repaired') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info for repaired jobs
        canEditUserInfo: false,     // Cannot edit user info for repaired jobs
        canEditContacts: false,     // Cannot edit contacts for repaired jobs
        canCreateOrder: false,      // Already processed
        canPickup: false,          // Not a pickup job
        buttonText: 'Return',
        statusDisplay: 'Repaired',
        priority: 4.8
      };
    }

  // ============================================
  // PRIORITY 5: OTHER EXISTING JOBS (Default)
  // ============================================
  // Unknown status jobs (fallback for any unhandled statuses)
  // Special case: If workshop exists but status is null, we're still loading
  const isLoadingWorkshop = existingWorkshopId && workshopStatus === null;
  return {
    canEditMachineInfo: false,  // Cannot edit machine info for active jobs
    canEditUserInfo: false,     // Cannot edit user info for active jobs
    canEditContacts: false,     // Cannot edit contacts for active jobs
    canCreateOrder: false,      // Active jobs shouldn't create new orders
    canPickup: false,          // Active jobs aren't pickups
    buttonText: isLoadingWorkshop ? 'Loading...' : 'Update Job',
    statusDisplay: isLoadingWorkshop ? 'Loading...' : (workshopStatus?.replace('_', ' ') || 'Unknown'),
    priority: 5
  };
  }

  // ============================================
  // PUBLIC API: Get current job status evaluation
  // ============================================
  $: currentJobStatus = evaluateJobStatus({
    existingWorkshopId,
    workshopStatus,
    existingOrderId,
    locationOfRepair,
    siteLocation,
    quoteOrRepair
  });

  // Reactive store subscription for button text
  $: submitButtonText = $submitButtonTextStore;

  // Debug reactive store subscription
  $: console.log('Store subscription updated - submitButtonText:', submitButtonText, 'timestamp:', new Date().toISOString());

  function getSubmitButtonLoadingText() {
    // Use centralized job status logic
    if (currentJobStatus.canPickup) {
      return 'Processing...';
    }

    if (!existingWorkshopId) {
      // New workshop creation - will be set to 'to_be_quoted' status
      return 'Creating Quote...';
    }

    if (workshopStatus === 'new') {
      // Workshop with new status - will be set to 'to_be_quoted' status
      return 'Creating Quote...';
    }

    if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
      // Workshop with "to be quoted" status
      return 'Processing...';
    }

    // Default for other actions
    return 'Next...';
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
    schedules = null;
    faultDescription = '';
    customerName = '';
    contactEmail = '';
    contactNumber = '';
    selectedCustomer = null;
    optionalContacts = [];
    workshopStatus = null;
    existingOrderId = null;

    // Clear photos - only revoke URLs for new photos created with URL.createObjectURL
    photos.forEach(p => {
      if (!p.isExisting) {
        URL.revokeObjectURL(p.url);
      }
    });
    photos = [];

    // Clear errors
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


  function navigateToJobStatus() {
    // Navigate to workshop job status page (don't reset form since we're navigating away)
    goto(`${base}/workshop/job-status`);
  }

  function navigateToWorkshopBoard() {
    // Navigate to workshop board page (don't reset form since we're navigating away)
    goto(`${base}/workshop/workshop-board`);
  }

  function closePickupSubmissionModal() {
    showPickupSubmissionModal = false;
  }

  function closePickupStatusChangeModal() {
    showPickupStatusChangeModal = false;
    // Force navigation to workshop board
    navigateToWorkshopBoard();
  }

  function closeDocketReadyModal() {
    showDocketReadyModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  function closeWaitingApprovalModal() {
    showWaitingApprovalModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  function closeWaitingForPartsModal() {
    showWaitingForPartsModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  function closeBookedInRepairModal() {
    showBookedInRepairModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  function closeRepairedModal() {
    showRepairedModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  function closeReturnModal() {
    showReturnModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  // Photo viewer functions
  function openPhotoViewer(photoIndex: number = 0) {
    if (photos.length === 0) return;
    currentPhotoIndex = photoIndex;
    showPhotoViewer = true;
  }

  function closePhotoViewer() {
    showPhotoViewer = false;
    currentPhotoIndex = 0;
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
        <div>
        <div
          class="flex items-center justify-between px-4 py-3 rounded cursor-pointer hover:bg-gray-700 transition-colors"
          style="background-color: rgb(30, 30, 30);"
          on:click={() => isMachineInfoExpanded = !isMachineInfoExpanded}
          role="button"
          tabindex="0"
          aria-label={isMachineInfoExpanded ? 'Collapse section' : 'Expand section'}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isMachineInfoExpanded = !isMachineInfoExpanded; } }}
        >
          <h2 class="font-medium text-white">Machine Information</h2>
          <div class="text-white">
            <svg class="w-5 h-5 transform transition-transform {isMachineInfoExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>

        {#if !isMachineInfoExpanded}
          <!-- Collapsed Summary View -->
          <div class="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
            {#if machineInfoSummaryItems.length > 0}
              <div class="space-y-2">
                {#each machineInfoSummaryItems as item}
                  <div class="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-blue-100 shadow-sm">
                    <span class="text-xs font-semibold text-blue-700 uppercase tracking-wide">{item.label}:</span>
                    <span class="text-sm font-bold text-gray-900 truncate max-w-48">{item.value}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-sm text-gray-500 italic text-center py-4">No machine information entered yet</div>
            {/if}
            <div class="mt-3 flex justify-center">
              <button
                type="button"
                on:click={() => isMachineInfoExpanded = true}
                class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-blue-200 hover:border-blue-300 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
{!currentJobStatus.canEditUserInfo ? 'View Details' : 'Edit Details'}
              </button>
            </div>
          </div>
        {:else}
          <!-- Expanded Form View -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <fieldset class="bg-white border border-gray-300 rounded-lg px-4 py-3">
                <legend class="block text-sm font-medium text-gray-700 mb-1">Location of Repair</legend>
                <div class="flex items-center gap-6">
                  <label class="inline-flex items-center gap-2 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed' : 'cursor-pointer'}">
                    <input id="loc-site" type="radio" name="locationOfRepair" value="Site" bind:group={locationOfRepair} class="h-4 w-4 text-blue-600" disabled={!currentJobStatus.canEditMachineInfo} />
                    <span>Site</span>
                  </label>
                  <label class="inline-flex items-center gap-2 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed' : 'cursor-pointer'}">
                    <input id="loc-workshop" type="radio" name="locationOfRepair" value="Workshop" bind:group={locationOfRepair} class="h-4 w-4 text-blue-600" disabled={!currentJobStatus.canEditMachineInfo} />
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
                class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!productName.trim() ? 'border-red-300' : ''} {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}"
                required
                disabled={!currentJobStatus.canEditMachineInfo}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="client-wo">Client’s Work Order</label>
              <input id="client-wo" type="text" bind:value={clientsWorkOrder} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditMachineInfo} />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="make-model">Make/Model</label>
              <input id="make-model" type="text" bind:value={makeModel} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditMachineInfo} />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="serial-number">Serial Number</label>
              <input id="serial-number" type="text" bind:value={serialNumber} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditMachineInfo} />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="site-location">
                Site/Location
                {#if locationOfRepair === 'Site'}
                  <span class="text-red-500 text-xs">* Required</span>
                {:else}
                  <span class="text-gray-500 text-xs">(Optional)</span>
                {/if}
              </label>
              <input
                id="site-location"
                type="text"
                bind:value={siteLocation}
                class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}"
                placeholder={locationOfRepair === 'Site' ? 'Enter site location *' : 'Enter location details (optional)'}
                disabled={!currentJobStatus.canEditMachineInfo}
              />
              {#if startedWith === 'camera' && locationOfRepair === 'Site'}
                <div class="mt-2 p-2 bg-blue-100 border border-blue-200 text-blue-700 rounded text-sm">
                  💡 Tip: You can add site location details later if needed
                </div>
              {/if}
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1" for="pickup-schedule">
                Pickup Schedule
                {#if isPickupScheduleRequired}
                  <span class="text-red-500">*</span>
                {/if}
              </label>
              <input
                id="pickup-schedule"
                type="datetime-local"
                value={pickupSchedule}
                on:input={(e) => updatePickupSchedule((e.target as HTMLInputElement).value)}
                min={minDateTime}
                class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}"
                placeholder="Select pickup date and time"
                disabled={!currentJobStatus.canEditMachineInfo}
              />
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1" for="fault-description">Fault Description</label>
              <textarea id="fault-description" rows="3" bind:value={faultDescription} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditMachineInfo}></textarea>
            </div>
          </div>

        {/if}
        </div>

        <!-- User Information -->
      <div>
        <div
          class="flex items-center justify-between px-4 py-3 rounded cursor-pointer hover:bg-gray-700 transition-colors"
          style="background-color: rgb(30, 30, 30);"
          on:click={() => isUserInfoExpanded = !isUserInfoExpanded}
          role="button"
          tabindex="0"
          aria-label={isUserInfoExpanded ? 'Collapse section' : 'Expand section'}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isUserInfoExpanded = !isUserInfoExpanded; } }}
        >
          <h2 class="font-medium text-white">User Information</h2>
          <div class="text-white">
            <svg class="w-5 h-5 transform transition-transform {isUserInfoExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>

        {#if !isUserInfoExpanded}
          <!-- Collapsed Summary View -->
          <div class="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
            {#if userInfoSummaryItems.length > 0}
              <div class="space-y-2">
                {#each userInfoSummaryItems as item}
                  <div class="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-green-100 shadow-sm">
                    <span class="text-xs font-semibold text-green-700 uppercase tracking-wide">{item.label}:</span>
                    <span class="text-sm font-bold text-gray-900 truncate max-w-48">{item.value}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-sm text-gray-500 italic text-center py-4">No user information entered yet</div>
            {/if}
            <div class="mt-3 flex justify-center">
              <button
                type="button"
                on:click={() => isUserInfoExpanded = true}
                class="inline-flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-green-200 hover:border-green-300 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
{!currentJobStatus.canEditUserInfo ? 'View Details' : 'Edit Details'}
              </button>
            </div>
          </div>
        {:else}
          <!-- Expanded Form View -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div class="md:col-span-2">
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

              <!-- Customer Display (either selected customer or manual entry) -->
              {#if selectedCustomer || customerName.trim()}
                <div class="mt-3 p-3 {selectedCustomer ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-md">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-700 mb-2">Selected Customer:</div>
                      <div class="font-medium {selectedCustomer ? 'text-blue-900' : 'text-gray-900'} text-lg">
                        {selectedCustomer ? `${selectedCustomer.BillingAddress.BillFirstName || ''} ${selectedCustomer.BillingAddress.BillLastName || ''}`.trim() || getCustomerDisplayName(selectedCustomer) : customerName}
                      </div>
                      {#if selectedCustomer}
                        {#if selectedCustomer.BillingAddress.BillCompany}
                          <div class="text-sm text-blue-700 mt-1 font-medium">
                            {selectedCustomer.BillingAddress.BillCompany}
                          </div>
                        {/if}
                        <div class="text-sm text-blue-600 mt-1">
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
                        <div class="text-xs text-blue-600 mt-2 font-medium">
                          ✓ Linked to Maropost customer
                        </div>
                      {:else}
                        <div class="text-xs text-gray-500 mt-1">
                          Manual entry - not linked to Maropost customer
                        </div>
                      {/if}
                    </div>
                    <button
                      type="button"
                      on:click={handleCustomerClear}
                      class="{selectedCustomer ? 'text-blue-500 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'} ml-2"
                      aria-label="Clear customer"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Contact Email and Number Side by Side -->
            <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1" for="contact-email">Contact Email</label>
                <input id="contact-email" type="email" bind:value={contactEmail} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditUserInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditUserInfo} />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1" for="contact-number">Contact Number</label>
                <input id="contact-number" type="tel" bind:value={contactNumber} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditUserInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditUserInfo} />
              </div>
            </div>
          </div>
        {/if}
        </div>
      </div>

      <!-- Two Column Layout for Photos and Optional Contacts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Photos -->
        <div>
          <PhotoManager
            bind:photos
            bind:error={photoError}
            minPhotosRequired={MIN_PHOTOS_REQUIRED}
            workshopStatus={workshopStatus}
            on:photosUpdated={event => photos = event.detail.photos}
            on:error={event => photoError = event.detail.message}
            on:photoClick={event => openPhotoViewer(event.detail.photoIndex)}
          />
        </div>

        <!-- Optional Contacts -->
        {#if optionalContacts.length > 0 || workshopStatus === 'to_be_quoted' || workshopStatus === 'new'}
          <div>
          <div
            class="flex items-center justify-between px-4 py-3 rounded cursor-pointer hover:bg-gray-700 transition-colors {!currentJobStatus.canEditContacts ? 'cursor-not-allowed opacity-75' : ''}"
            style="background-color: rgb(30, 30, 30);"
            on:click={() => { if (currentJobStatus.canEditContacts) isOptionalContactsExpanded = !isOptionalContactsExpanded; }}
            role="button"
            tabindex="0"
            aria-label={isOptionalContactsExpanded ? 'Collapse section' : 'Expand section'}
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (currentJobStatus.canEditContacts) isOptionalContactsExpanded = !isOptionalContactsExpanded; } }}
          >
            <h2 class="font-medium text-white">Optional Contacts</h2>
            {#if currentJobStatus.canEditContacts}
              <div class="text-white">
                <svg class="w-5 h-5 transform transition-transform {isOptionalContactsExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            {/if}
          </div>

          {#if !isOptionalContactsExpanded}
            <!-- Collapsed Summary View -->
            <div class="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg shadow-sm">
              {#if optionalContactsSummaryItems.length > 0}
                <div class="space-y-2">
                  {#each optionalContactsSummaryItems as item}
                    <div class="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-purple-100 shadow-sm">
                      <span class="text-xs font-semibold text-purple-700 uppercase tracking-wide">{item.label}:</span>
                      <span class="text-sm font-bold text-gray-900 truncate max-w-48">{item.value}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="text-sm text-gray-500 italic text-center py-4">No optional contacts added yet</div>
              {/if}
              {#if currentJobStatus.canEditContacts}
                <div class="mt-3 flex justify-center">
                  <button
                    type="button"
                    on:click={() => isOptionalContactsExpanded = true}
                    class="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-purple-200 hover:border-purple-300 transition-colors"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    Edit Details
                  </button>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Expanded Form View -->
            <div class="mt-4">
              <ContactsManager
                bind:this={contactsManager}
                bind:contacts={optionalContacts}
                bind:error={contactError}
                workshopStatus={workshopStatus}
                on:contactsUpdated={handleContactsUpdated}
                on:error={handleContactError}
              />
            </div>
          {/if}
          </div>
        {/if}
      </div>

      <!-- Docket Info - Only show for non-new and non-pickup workshops -->
      {#if workshopStatus && workshopStatus !== 'new' && workshopStatus !== 'pickup'}
        <!-- Docket Info Title -->
        <div
          class="flex items-center justify-between px-4 py-3 rounded"
          style="background-color: rgb(30, 30, 30);"
        >
          <h2 class="font-medium text-white">Docket Info</h2>
        </div>

        <!-- Docket Info Content -->
        <div class="space-y-4 {docketInfoBackgroundClass} px-4 py-3 rounded">
          <!-- Quote or Repair -->
          <div>
            <fieldset class="bg-white border border-gray-300 rounded-lg px-4 py-3">
              <legend class="block text-sm font-medium text-gray-700 mb-1">Quote or Repair</legend>
              <div class="flex items-center gap-6">
                <label class="inline-flex items-center gap-2 cursor-pointer">
                  <input id="quote-radio" type="radio" name="quoteOrRepair" value="Quote" bind:group={quoteOrRepair} class="h-4 w-4 text-blue-600" />
                  <span>Quote</span>
                </label>
                <label class="inline-flex items-center gap-2 cursor-pointer">
                  <input id="repair-radio" type="radio" name="quoteOrRepair" value="Repair" bind:group={quoteOrRepair} class="h-4 w-4 text-blue-600" />
                  <span>Repair</span>
                </label>
              </div>
            </fieldset>
          </div>

          <!-- Quote Description | Additional Information -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="quote-description">Quote Description</label>
              <textarea id="quote-description" rows="3" bind:value={quoteDescription} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="additional-information">Additional Information</label>
              <textarea id="additional-information" rows="3" bind:value={additionalInformation} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
          </div>

          <!-- Stock On Hand | Labour -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="stock-on-hand">Stock On Hand</label>
              <input id="stock-on-hand" type="text" bind:value={stockOnHand} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="labour">Labour</label>
              <input id="labour" type="text" bind:value={labour} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <!-- Travel Time | Call out -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="travel-time">Travel Time</label>
              <input id="travel-time" type="text" bind:value={travelTime} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="call-out">Call out</label>
              <input id="call-out" type="text" bind:value={callOut} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <!-- Parts -->
          <div>
            <div class="flex items-center justify-between border border-gray-300 px-4 py-3 rounded-lg" style="background-color: rgb(30, 30, 30);">
              <h3 class="font-medium text-white">Parts</h3>
              <button type="button" on:click={addPartRow} class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Add</button>
            </div>

            <div class="mt-3 space-y-3">
              {#each parts as part, idx}
                <div class="flex gap-4 items-end">
                  <div class="flex-1">
                    <label class="block text-sm font-medium text-gray-700 mb-1" for={`sku-${idx}`}>SKU</label>
                    <input id={`sku-${idx}`} type="text" bind:value={part.sku} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div class="flex-1">
                    <label class="block text-sm font-medium text-gray-700 mb-1" for={`qty-${idx}`}>Quantity</label>
                    <input id={`qty-${idx}`} type="text" bind:value={part.quantity} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div class="flex items-end">
                    <button
                      type="button"
                      on:click={() => removePartRow(idx)}
                      disabled={parts.length <= 1}
                      class="w-10 h-10 flex items-center justify-center px-2 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600 transition-colors"
                      aria-label="Remove part row"
                    >
                      <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>

        </div>
      {/if}

      <div class="flex justify-end gap-3">
        <a href="{base}/workshop/workshop-board" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</a>

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
            disabled={isSubmitting || (existingWorkshopId !== null && workshopStatus === null)}
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {getSubmitButtonLoadingText()}
            {:else}
              {submitButtonText}
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

  <!-- Docket Ready Modal (for to_be_quoted submissions) -->
  {#if showDocketReadyModal}
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
              <h3 class="text-lg font-medium text-gray-900">Docket Information Saved</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            Your workshop docket information has been successfully saved and the job status has been updated to "Docket Ready".
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Docket Ready"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeDocketReadyModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Waiting Approval PO Modal (for quoted submissions) -->
  {#if showWaitingApprovalModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Waiting for PO Approval</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully moved to "Waiting Approval PO" status. The job is now awaiting purchase order approval.
          </p>
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Job Status:</strong> Updated to "Waiting Approval PO"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeWaitingApprovalModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Waiting For Parts Modal (for waiting_approval_po submissions) -->
  {#if showWaitingForPartsModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Waiting For Parts</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully moved to "Waiting For Parts" status. The job is now waiting for required parts to arrive before repair work can begin.
          </p>
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700">
                  <strong>Job Status:</strong> Updated to "Waiting For Parts"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeWaitingForPartsModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Booked In For Repair Modal (for waiting_for_parts submissions) -->
  {#if showBookedInRepairModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Booked In For Repair</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully booked in for repair service. The equipment is now scheduled for maintenance and repair work.
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Booked In For Repair Service"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeBookedInRepairModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Repaired Modal (for booked_in_for_repair_service submissions) -->
  {#if showRepairedModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Repair Completed</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully completed and marked as repaired. The equipment is now ready for return to the customer.
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Repaired"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeRepairedModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Return Modal (for repaired submissions) -->
  {#if showReturnModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Equipment Ready for Return</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully prepared for return to the customer. The equipment is now ready for pickup or delivery.
          </p>
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Job Status:</strong> Updated to "Return"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeReturnModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>


