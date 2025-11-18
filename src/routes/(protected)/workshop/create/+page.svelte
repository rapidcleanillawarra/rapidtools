<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import CustomerDropdown from '$lib/components/CustomerDropdown.svelte';
  import PhotoManager from '$lib/components/PhotoManager.svelte';
  import FileManager from '$lib/components/FileManager.svelte';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import ContactsManager from '$lib/components/ContactsManager.svelte';
  import type { PhotoItem, FileItem, Contact } from '$lib/types/workshop';
  import SuccessModal from '$lib/components/SuccessModal.svelte';
  import PostSubmissionModal from '$lib/components/PostSubmissionModal.svelte';
  import type { Customer } from '$lib/services/customers';
  import { getCustomerDisplayName } from '$lib/services/customers';
  import { createWorkshop, getPhotoStatistics, cleanupOrphanedPhotos, getWorkshop, updateWorkshop, deleteWorkshop } from '$lib/services/workshop';
  import { fetchCustomerData, createOrder, cancelOrder } from '$lib/services/maropost';
  import { onMount, onDestroy } from 'svelte';
  import { validateWorkshopForm } from '$lib/utils/validation';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/firebase';
  import { userProfile, fetchUserProfile } from '$lib/userProfile';
  import { get, writable } from 'svelte/store';
  import { toastError, toastSuccess, toastInfo } from '$lib/utils/toast';

  type LocationType = 'Site' | 'Workshop';

  // Machine Information
  let locationOfMachine: LocationType = 'Site';
  let action = 'Pickup';
  let productName = '';
  let clientsWorkOrder = '';
  let makeModel = '';
  let serialNumber = '';
  let siteLocation = '';
  let faultDescription = '';
  let schedules: any = null;

  // Dynamic schedule key based on action
  $: scheduleKey = action === 'Pickup' ? 'pickup_schedule' :
                   action === 'Repair' ? 'repair_schedule' :
                   action === 'Deliver to Workshop' ? 'delivery_schedule' : 'pickup_schedule';

  // Computed property for schedule (dynamically named based on action)
  $: pickupSchedule = schedules?.[scheduleKey] || '';

  // Function to update schedule (key depends on action)
  function updatePickupSchedule(value: string) {
    schedules = {
      ...schedules,
      [scheduleKey]: value
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

  // Files (always visible Files section)
  let files: FileItem[] = [];
  let fileError = '';
  const MIN_FILES_REQUIRED = 0; // Files are now optional

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

  // Comments
  let comments: Array<{
    id: string;
    text: string;
    author: string;
    created_at: string;
  }> = [];
  let newComment: string = '';

  // History
  let history: Array<{
    id: string;
    timestamp: string;
    user: string;
    status: string;
    isCreation?: boolean;
  }> = [];

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

  // Customer billing info modal state
  let showCustomerBillingModal = false;

  // Delete job modal state
  let showDeleteJobModal = false;

  // Repaired status transition selection
  let repairedStatusTransition = '';

  // Processing modal state (for new job creation)
  let showProcessingModal = false;

  // Delete processing modal state
  let showDeleteProcessingModal = false;

  // Processing progress tracking
  let processingSteps = {
    creatingOrder: { label: 'Creating Maropost Order', completed: false, inProgress: false },
    callingPowerAutomate: { label: 'Generating Tag and sending emails', completed: false, inProgress: false },
    savingWorkshop: { label: 'Saving Workshop to Database', completed: false, inProgress: false }
  };

  // Delete processing progress tracking
  let deleteProcessingSteps = {
    cancellingOrder: { label: 'Cancelling Maropost Order', completed: false, inProgress: false },
    deletingWorkshop: { label: 'Deleting Workshop from Database', completed: false, inProgress: false }
  };

  // Reset processing steps
  function resetProcessingSteps() {
    processingSteps = {
      creatingOrder: { label: 'Creating Maropost Order', completed: false, inProgress: false },
      callingPowerAutomate: { label: 'Generating Tag and sending emails', completed: false, inProgress: false },
      savingWorkshop: { label: 'Saving Workshop to Database', completed: false, inProgress: false }
    };
  }

  // Reset delete processing steps
  function resetDeleteProcessingSteps() {
    deleteProcessingSteps = {
      cancellingOrder: { label: 'Cancelling Maropost Order', completed: false, inProgress: false },
      deletingWorkshop: { label: 'Deleting Workshop from Database', completed: false, inProgress: false }
    };
  }

  // Update processing step status
  function updateProcessingStep(step: keyof typeof processingSteps, inProgress: boolean, completed: boolean) {
    processingSteps[step].inProgress = inProgress;
    processingSteps[step].completed = completed;
  }

  // Update delete processing step status
  function updateDeleteProcessingStep(step: keyof typeof deleteProcessingSteps, inProgress: boolean, completed: boolean) {
    deleteProcessingSteps[step].inProgress = inProgress;
    deleteProcessingSteps[step].completed = completed;
  }

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

  // Completed modal state (for return submissions)
  let showCompletedModal = false;

  // Customer data from API
  let customerApiData: any = null;
  // Order data from API
  let orderApiData: any = null;

  // Determine entry point
  let startedWith: 'form' | 'camera' = 'form';
  let existingWorkshopId: string | null = null;
  let workshopStatus: JobStatus = null;
  let existingOrderId: string | null = null;
  let createdAt: string | null = null;

  // Store for submit button text to ensure reactivity
  const submitButtonTextStore = writable('Loading...');

  // Subscribe to user profile
  let profile: import('$lib/userProfile').UserProfile | null = null;
  const unsubUserProfile = userProfile.subscribe(value => {
    profile = value;
  });

  // Load user profile on mount
  onMount(() => {
    const user = get(currentUser);
    if (user) {
      loadUserProfile(user.uid);
    }
  });

  // Cleanup subscriptions on destroy
  onDestroy(() => {
    unsubUserProfile();
  });

  // Prevent window closing during job submission
  let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  $: {
    if (showProcessingModal && typeof window !== 'undefined' && !beforeUnloadHandler) {
      beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Job creation is in progress. Are you sure you want to leave? Your changes may not be saved.';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
    } else if (!showProcessingModal && beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      beforeUnloadHandler = null;
    }
  }

  async function loadUserProfile(uid: string) {
    try {
      await fetchUserProfile(uid);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

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
    if (locationOfMachine) items.push({ label: 'Location', value: locationOfMachine, priority: 2 });
    if (makeModel.trim()) items.push({ label: 'Make/Model', value: makeModel, priority: 3 });
    if (serialNumber.trim()) items.push({ label: 'Serial', value: serialNumber, priority: 4 });
    if (siteLocation.trim()) items.push({ label: 'Site', value: siteLocation, priority: 5 });
    if (pickupSchedule.trim()) items.push({ label: scheduleLabel, value: formatPickupSchedule(pickupSchedule), priority: 6 });
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

  // Determine if pickup schedule is required (new jobs with Pickup action)
  $: isPickupScheduleRequired = (workshopStatus === 'new' || !existingWorkshopId) && action === 'Pickup';

  // Dynamic schedule label based on action
  $: scheduleLabel = action === 'Pickup' ? 'Pickup Schedule' :
                     action === 'Repair' ? 'Repair Schedule' :
                     action === 'Deliver to Workshop' ? 'Delivery Schedule' : 'Schedule';


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

  // Initialize history for new jobs
  $: if (!existingWorkshopId && (workshopStatus === 'new' || workshopStatus === null) && history.length === 0) {
    initializeNewJobHistory();
  }

  async function initializeNewJobHistory() {
    // Get current user
    const user = get(currentUser);
    if (!user) return;

    // Use profile name if available, otherwise fallback to email or display name
    const profile = get(userProfile);
    const userName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user.displayName || user.email?.split('@')[0] || 'Unknown User';

    // Add creation history entry for new jobs
    const creationEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: userName,
      status: 'new',
      isCreation: true
    };

    history = [creationEntry];
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
      createdAt = workshop.created_at || null;

      console.log('📋 Loaded workshop data - order_id:', existingOrderId, 'created_at:', createdAt);

      // Populate form with existing workshop data
      locationOfMachine = workshop.location_of_machine || 'Site';
      action = workshop.action || 'Pickup';
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
      quoteOrRepair = workshop.quote_or_repaired || 'Quote';
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

      // Load comments if available
      if (workshop.comments) {
        // Handle both array format and JSON string format
        if (Array.isArray(workshop.comments)) {
          comments = workshop.comments;
        } else if (typeof workshop.comments === 'string') {
          try {
            comments = JSON.parse(workshop.comments);
          } catch (error) {
            console.warn('Failed to parse comments JSON:', error);
            comments = [];
          }
        } else {
          comments = [];
        }
      } else {
        comments = [];
      }

      // Load history if available
      if (workshop.history) {
        // Handle both array format and JSON string format
        if (Array.isArray(workshop.history)) {
          history = workshop.history;
        } else if (typeof workshop.history === 'string') {
          try {
            history = JSON.parse(workshop.history);
          } catch (error) {
            console.warn('Failed to parse history JSON:', error);
            history = [];
          }
        } else {
          history = [];
        }
      } else {
        history = [];
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

      // Load existing files (they're already saved in storage)
      // Note: We can't recreate File objects from URLs, so we'll show them differently
      if (workshop.file_urls) {
        // Handle both array format and JSON string format
        let fileUrlsArray: string[] = [];
        if (Array.isArray(workshop.file_urls)) {
          fileUrlsArray = workshop.file_urls;
        } else if (typeof workshop.file_urls === 'string') {
          try {
            fileUrlsArray = JSON.parse(workshop.file_urls);
          } catch (error) {
            console.warn('Failed to parse file_urls JSON:', error);
            fileUrlsArray = [];
          }
        }

        if (fileUrlsArray.length > 0) {
          // Create FileItem entries with the existing file URLs
          files = fileUrlsArray.map(url => ({
            file: new File([], 'existing-file', { type: 'application/octet-stream' }), // Dummy file
            url: url,
            name: url.split('/').pop() || 'Unknown File',
            size: 0, // We don't have the size info
            type: 'application/octet-stream', // Default type
            isExisting: true // Mark as existing file
          }));
        }
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
    const isNewPickupJob = (workshopStatus === 'new' || !existingWorkshopId) && locationOfMachine === 'Site';
    const validation = validateWorkshopForm({
      productName,
      customerName,
      locationOfMachine,
      action,
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

    // Show processing modal for new job creation
    const isNewJob = !existingWorkshopId;
    if (isNewJob) {
      resetProcessingSteps();
      showProcessingModal = true;
    }

    // For new jobs (jobs that don't exist in database yet), create Maropost order first
    let shouldCreateOrder = false;
    let generatedOrderId = '';
    let customerApiData: any = null;
    let orderApiData: any = null;

    if (!existingWorkshopId) {
      console.log('New job detected in handleUpdateJob - creating Maropost order first before saving to database');
      shouldCreateOrder = true;

      // Use selected customer data directly instead of fetching from API
      if (!selectedCustomer) {
        console.error('No customer selected for order creation');
        toastError('Please select a customer before creating the order.');
        isSubmitting = false;
        showProcessingModal = false;
        return;
      }

      try {
        console.log('Creating Maropost order for new job using selected customer:', selectedCustomer);
        updateProcessingStep('creatingOrder', true, false);
        orderApiData = await createOrder(selectedCustomer);
        updateProcessingStep('creatingOrder', false, true);

        // Store the generated order ID for the success message
        // Handle both object and array response structures
        let orderId = null;
        if (orderApiData) {
          if (orderApiData.Order) {
            if (Array.isArray(orderApiData.Order) && orderApiData.Order.length > 0) {
              orderId = orderApiData.Order[0].OrderID;
            } else if (orderApiData.Order.OrderID) {
              orderId = orderApiData.Order.OrderID;
            }
          }
        }

        if (orderId) {
          generatedOrderId = orderId;
          console.log('Maropost order created successfully with Order ID:', generatedOrderId);
          
          // Wait for order creation to complete, then call Power Automate API
          console.log('Order creation confirmed. Now calling Power Automate API...');
          updateProcessingStep('callingPowerAutomate', true, false);
          await callPowerAutomateAPI(generatedOrderId);
          updateProcessingStep('callingPowerAutomate', false, true);
          console.log('Power Automate API call completed.');
        } else {
          console.error('Maropost order creation failed - no OrderID returned:', orderApiData);
          throw new Error('Order creation failed - no OrderID returned');
        }
      } catch (error) {
        console.error('Failed to create Maropost order for new job:', error);

        // Check if this is a billing name error and show specific modal
        if (error instanceof Error && error.message.includes('Customer billing name is required for order creation')) {
          showCustomerBillingModal = true;
        } else {
          toastError('Failed to create order. Please try again.');
        }

        isSubmitting = false;
        showProcessingModal = false;
        return;
      }
    }

    // Track history for update job (no status change for updates)
    // Note: Updates don't change status, so we don't add history entries for them

    // Separate new photos from existing photos
    const newPhotos = photos.filter(p => !p.isExisting).map(p => p.file);
    const existingPhotoUrls = photos.filter(p => p.isExisting).map(p => p.url);

    // Separate new files from existing files
    const newFiles = files.filter(f => !f.isExisting).map(f => f.file);
    const existingFileUrls = files.filter(f => f.isExisting).map(f => f.url);

    // Debug: Log order creation status before saving
    console.log('Preparing form data in handleUpdateJob:', {
      existingWorkshopId,
      shouldCreateOrder,
      generatedOrderId,
      hasOrderId: !!generatedOrderId
    });

    // Prepare form data for update only (no status changes, but order creation for new jobs)
    const formData = {
      locationOfMachine,
      action,
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
      files: newFiles,
      existingPhotoUrls,
      existingFileUrls,
      startedWith,
      quoteOrRepaired: quoteOrRepair,
      comments,
      // Include docket info for all statuses where docket info is visible (not 'new' and not 'pickup')
      ...(existingWorkshopId && workshopStatus && workshopStatus !== 'new' && workshopStatus !== 'pickup' && {
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
      // Include order data for new jobs
      ...(shouldCreateOrder && generatedOrderId && {
        customerApiData: selectedCustomer, // Use selected customer data
        orderApiData,
        order_id: generatedOrderId
      })
    };

    // Debug: Log final formData to check if order_id is included
    console.log('Final formData object in handleUpdateJob:', {
      ...formData,
      order_id: formData.order_id || 'NOT SET'
    });

    // Add history to formData (preserve existing history)
    (formData as any).history = history;

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to update a workshop');
    }

    try {
      updateProcessingStep('savingWorkshop', true, false);
      let workshop;
      if (existingWorkshopId) {
        // Update existing workshop
        workshop = await updateWorkshop(existingWorkshopId, formData);
      } else {
        // Create new workshop
        workshop = await createWorkshop(formData, user.uid);
        // Set createdAt for newly created workshops so the regenerate tag button works
        if (workshop && workshop.created_at) {
          createdAt = workshop.created_at;
        }
      }

      updateProcessingStep('savingWorkshop', false, true);

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
      showProcessingModal = false;
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
    const isNewPickupJob = (workshopStatus === 'new' || !existingWorkshopId) && locationOfMachine === 'Site';
    const validation = validateWorkshopForm({
      productName,
      customerName,
      locationOfMachine,
      action,
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

    // Show processing modal for new job creation
    const isNewJob = !existingWorkshopId;
    if (isNewJob) {
      resetProcessingSteps();
      showProcessingModal = true;
    }

    // Check if this is a pickup submission (only for NEW jobs, not existing pickup jobs)
    isPickupSubmission = !existingWorkshopId && action === 'Pickup' && siteLocation.trim() !== '';


    let shouldCreateOrder = false;

    // For new jobs (jobs that don't exist in database yet), ALWAYS create Maropost order first
    if (!existingWorkshopId) {
      console.log('New job detected - creating Maropost order first before saving to database');
      shouldCreateOrder = true;
    } else if (existingWorkshopId) {
      // For existing workshops, check if they already have an order_id to prevent duplicates
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
    }

    // For new jobs, create order first and wait for completion before proceeding
    if (!existingWorkshopId && shouldCreateOrder) {
      // Use selected customer data directly instead of fetching from API
      if (!selectedCustomer) {
        console.error('No customer selected for order creation');
        toastError('Please select a customer before creating the order.');
        isSubmitting = false;
        showProcessingModal = false;
        return;
      }

      try {
        console.log('Creating Maropost order for new job using selected customer:', selectedCustomer);
        updateProcessingStep('creatingOrder', true, false);
        orderApiData = await createOrder(selectedCustomer);
        updateProcessingStep('creatingOrder', false, true);

        // Store the generated order ID for the success message
        // Handle both object and array response structures
        let orderId = null;
        if (orderApiData) {
          if (orderApiData.Order) {
            if (Array.isArray(orderApiData.Order) && orderApiData.Order.length > 0) {
              orderId = orderApiData.Order[0].OrderID;
            } else if (orderApiData.Order.OrderID) {
              orderId = orderApiData.Order.OrderID;
            }
          }
        }

        if (orderId) {
          generatedOrderId = orderId;
          console.log('Maropost order created successfully with Order ID:', generatedOrderId);
          
          // Wait for order creation to complete, then call Power Automate API
          console.log('Order creation confirmed. Now calling Power Automate API...');
          updateProcessingStep('callingPowerAutomate', true, false);
          await callPowerAutomateAPI(generatedOrderId);
          updateProcessingStep('callingPowerAutomate', false, true);
          console.log('Power Automate API call completed.');
        } else {
          console.error('Maropost order creation failed - no OrderID returned:', orderApiData);
          throw new Error('Order creation failed - no OrderID returned');
        }
      } catch (error) {
        console.error('Failed to create Maropost order for new job:', error);

        // Check if this is a billing name error and show specific modal
        if (error instanceof Error && error.message.includes('Customer billing name is required for order creation')) {
          showCustomerBillingModal = true;
        } else {
          toastError('Failed to create order. Please try again.');
        }

        isSubmitting = false;
        showProcessingModal = false;
        return;
      }
    }

    // For existing jobs, create order only if needed (same logic as before)
    else if (existingWorkshopId && shouldCreateOrder) {
      // Use selected customer data directly instead of fetching from API
      if (!selectedCustomer) {
        console.error('No customer selected for order creation');
        toastError('Please select a customer before creating the order.');
        isSubmitting = false;
        showProcessingModal = false;
        return;
      }

      // Use selectedCustomer directly instead of fetching
      customerApiData = selectedCustomer;
      console.log('Using selected customer data for existing job order creation:', customerApiData);

      try {
        orderApiData = await createOrder(customerApiData);

        // Store the generated order ID for the success message
        // Handle both object and array response structures
        let orderId = null;
        if (orderApiData) {
          if (orderApiData.Order) {
            if (Array.isArray(orderApiData.Order) && orderApiData.Order.length > 0) {
              orderId = orderApiData.Order[0].OrderID;
            } else if (orderApiData.Order.OrderID) {
              orderId = orderApiData.Order.OrderID;
            }
          }
        }

        if (orderId) {
          generatedOrderId = orderId;
          console.log('Maropost order created successfully with Order ID:', generatedOrderId);
          
          // Wait for order creation to complete, then call Power Automate API
          console.log('Order creation confirmed. Now calling Power Automate API...');
          updateProcessingStep('callingPowerAutomate', true, false);
          await callPowerAutomateAPI(generatedOrderId);
          updateProcessingStep('callingPowerAutomate', false, true);
          console.log('Power Automate API call completed.');
        }
      } catch (error) {
        console.error('Failed to create order:', error);
        toastError('Failed to create order. Please try again.');
        isSubmitting = false;
        showProcessingModal = false;
        return;
      }
    }

    // Separate new photos from existing photos
    const newPhotos = photos.filter(p => !p.isExisting).map(p => p.file);
    const existingPhotoUrls = photos.filter(p => p.isExisting).map(p => p.url);

    // Separate new files from existing files
    const newFiles = files.filter(f => !f.isExisting).map(f => f.file);
    const existingFileUrls = files.filter(f => f.isExisting).map(f => f.url);

    // Debug: Log order creation status before saving
    console.log('Preparing form data for database save:', {
      existingWorkshopId,
      shouldCreateOrder,
      generatedOrderId,
      hasOrderId: !!generatedOrderId
    });

    // Prepare form data
    const formData = {
      locationOfMachine,
      action,
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
      files: newFiles,
      existingPhotoUrls,
      existingFileUrls,
      startedWith,
      quoteOrRepaired: quoteOrRepair,
      comments,
      // Include docket info for all statuses where docket info is visible (not 'new' and not 'pickup')
      ...(existingWorkshopId && workshopStatus && workshopStatus !== 'new' && workshopStatus !== 'pickup' && {
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
      ...(shouldCreateOrder && generatedOrderId && {
        customerApiData: selectedCustomer, // Use selected customer data
        orderApiData,
        order_id: generatedOrderId
      })
    };

    // Debug: Log final formData to check if order_id is included
    console.log('Final formData object:', {
      ...formData,
      order_id: formData.order_id || 'NOT SET'
    });

    // Get current user
    const user = get(currentUser);
    if (!user) {
      throw new Error('You must be logged in to create a workshop');
    }

    // Set status based on submission type - using centralized job status logic

    // Set status based on action for new jobs
    if (workshopStatus === 'new' || !existingWorkshopId) {
      // Only add creation history entry if not already initialized
      const hasCreationEntry = history.some(entry => entry.status === 'new' && entry.isCreation);
      if (!hasCreationEntry) {
        addHistoryEntry('new', true); // true = isCreation - records who created the job
      }

      if (action === 'Pickup') {
        (formData as any).status = 'pickup';
        addHistoryEntry('pickup', false); // false = status change (not creation)
      } else if (action === 'Repair') {
        (formData as any).status = 'booked_in_for_repair_service';
        addHistoryEntry('booked_in_for_repair_service', false); // false = status change (not creation)
      } else if (action === 'Deliver to Workshop') {
        (formData as any).status = 'deliver_to_workshop';
        addHistoryEntry('deliver_to_workshop', false); // false = status change (not creation)
      }
    } else if (existingWorkshopId && workshopStatus === 'pickup') {
      // For existing pickup jobs being submitted, update to "to_be_quoted"
      (formData as any).status = 'to_be_quoted';
      wasPickupJob = true;
      addHistoryEntry('to_be_quoted', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
      // For existing "to_be_quoted" jobs, change status to docket_ready
      (formData as any).status = 'docket_ready';
      addHistoryEntry('docket_ready', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'docket_ready') {
      // For existing "docket_ready" jobs, change status to quoted or repaired based on quoteOrRepair field
      (formData as any).status = quoteOrRepair === 'Quote' ? 'quoted' : 'repaired';
      addHistoryEntry(quoteOrRepair === 'Quote' ? 'quoted' : 'repaired', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'quoted') {
      // For existing "quoted" jobs, change status to waiting_approval_po
      (formData as any).status = 'waiting_approval_po';
      addHistoryEntry('waiting_approval_po', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'waiting_approval_po') {
      // For existing "waiting_approval_po" jobs, change status to waiting_for_parts
      (formData as any).status = 'waiting_for_parts';
      addHistoryEntry('waiting_for_parts', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'waiting_for_parts') {
      // For existing "waiting_for_parts" jobs, change status to booked_in_for_repair_service
      (formData as any).status = 'booked_in_for_repair_service';
      addHistoryEntry('booked_in_for_repair_service', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'booked_in_for_repair_service') {
      // For existing "booked_in_for_repair_service" jobs, change status to repaired
      (formData as any).status = 'repaired';
      addHistoryEntry('repaired', false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'repaired') {
      // For existing "repaired" jobs, change status based on dropdown selection
      if (!repairedStatusTransition) {
        toastError('Please select a status transition from the dropdown before proceeding.');
        isSubmitting = false;
        showProcessingModal = false;
        return;
      }
      (formData as any).status = repairedStatusTransition;
      addHistoryEntry(repairedStatusTransition, false); // false = status change
    } else if (existingWorkshopId && workshopStatus === 'return') {
      // For existing "return" jobs, change status to completed
      (formData as any).status = 'completed';
      addHistoryEntry('completed', false); // false = status change
    } else {
      // Default: set to "to_be_quoted"
      (formData as any).status = 'to_be_quoted';
      addHistoryEntry('to_be_quoted', !existingWorkshopId); // true if new job, false if status change
    }

    // Add history to formData after all history entries have been added
    (formData as any).history = history;

    // Submit to Supabase - either create new or update existing
    updateProcessingStep('savingWorkshop', true, false);
    const submitPromise = existingWorkshopId
      ? updateWorkshop(existingWorkshopId, formData)
      : createWorkshop(formData, user.uid);

    submitPromise
      .then((workshop) => {
        updateProcessingStep('savingWorkshop', false, true);

        // Show success modal with appropriate message
        const isUpdate = !!existingWorkshopId;
        const wasNew = existingWorkshopId && workshopStatus === 'new';
        const wasToBeQuoted = existingWorkshopId && workshopStatus === 'to_be_quoted';
        const hadExistingOrder = !shouldCreateOrder && isUpdate;

        // Set success message based on status change
        if ((workshopStatus === 'new' || !existingWorkshopId) && action === 'Pickup') {
          successMessage = `Workshop created successfully as a pickup job${generatedOrderId ? ` and order #${generatedOrderId} generated` : ''}!`;
        } else if ((workshopStatus === 'new' || !existingWorkshopId) && action === 'Repair') {
          successMessage = `Workshop created successfully and booked in for repair service${generatedOrderId ? ` - Order #${generatedOrderId} generated` : ''}!`;
        } else if ((workshopStatus === 'new' || !existingWorkshopId) && action === 'Deliver to Workshop') {
          successMessage = `Workshop created successfully and scheduled for delivery to workshop${generatedOrderId ? ` - Order #${generatedOrderId} generated` : ''}!`;
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
        } else if (existingWorkshopId && workshopStatus === 'return') {
          successMessage = 'Workshop job has been completed successfully!';
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

        if ((workshopStatus === 'new' || !existingWorkshopId) && action === 'Pickup') {
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
        } else if (existingWorkshopId && workshopStatus === 'return') {
          // For existing "return" jobs submitted, show the completed modal
          showCompletedModal = true;
        } else if (isUpdate) {
          // For regular updates, show the regular success modal
          showSuccessModal = true;
        } else if (!existingWorkshopId && action !== 'Pickup') {
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
        // Hide processing modal
        showProcessingModal = false;
      });
  }

  // ============================================
  // JOB STATUS MANAGEMENT - CRITICAL BUSINESS LOGIC
  // ============================================
  // This function centralizes all job status checks and determines
  // what actions are allowed based on the current state.
  // DO NOT MODIFY THIS WITHOUT CAREFUL CONSIDERATION OF BUSINESS IMPACT

  type JobStatus = 'new' | 'pickup' | 'to_be_quoted' | 'docket_ready' | 'quoted' | 'repaired' | 'waiting_approval_po' | 'waiting_for_parts' | 'booked_in_for_repair_service' | 'deliver_to_workshop' | 'pending_jobs' | 'return' | 'completed' | 'to_be_scrapped' | 'pickup_from_workshop' | null;

  interface JobStatusContext {
    existingWorkshopId: string | null;
    workshopStatus: JobStatus;
    existingOrderId: string | null;
    locationOfMachine: 'Site' | 'Workshop';
    siteLocation: string;
    quoteOrRepair: QuoteOrRepairType;
    action: string;
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
    const { existingWorkshopId, workshopStatus, existingOrderId, locationOfMachine, siteLocation, quoteOrRepair, action } = context;


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
        buttonText: action === 'Pickup' ? 'Pickup Delivered' :
                     action === 'Repair' ? 'Repair Delivered' :
                     'Delivered to Workshop',
        statusDisplay: 'Pickup',
        priority: 1
      };
    }


    // ============================================
    // PRIORITY 2: NEW JOBS
    // ============================================
    // Brand new jobs that haven't been saved yet
    if (workshopStatus === 'new') {
      // Special case: If action is Pickup, this becomes a pickup job
      const isPickupJob = action === 'Pickup';

      return {
        canEditMachineInfo: true,   // Can edit everything for new jobs
        canEditUserInfo: true,
        canEditContacts: true,
        canCreateOrder: false,      // New jobs don't create orders until submitted
        canPickup: isPickupJob,     // Pickup action means pickup jobs
        buttonText: action === 'Pickup' ? 'Schedule Pickup' :
                     action === 'Repair' ? 'Schedule Repair' :
                     'Schedule Delivery',
        statusDisplay: 'New',
        priority: 2
      };
    }

  // ============================================
  // PRIORITY 3: BRAND NEW FORMS (No existing workshop)
  // ============================================
  // Forms that are being created from scratch (no workshop_id in URL)
  if (!existingWorkshopId) {
    // Special case: If action is Pickup, this becomes a pickup job
    const isPickupJob = action === 'Pickup';

    return {
      canEditMachineInfo: true,   // Can edit everything for new forms
      canEditUserInfo: true,
      canEditContacts: true,
      canCreateOrder: false,      // New forms don't create orders until submitted
      canPickup: isPickupJob,     // Pickup action means pickup jobs
        buttonText: action === 'Pickup' ? 'Schedule Pickup' :
                     action === 'Repair' ? 'Schedule Repair' :
                     'Schedule Delivery',
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
        canEditMachineInfo: true,   // Allow editing machine info for to_be_quoted jobs
        canEditUserInfo: true,      // Allow editing user info for to_be_quoted jobs
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
        canEditMachineInfo: true,   // Allow editing machine info for docket ready jobs
        canEditUserInfo: true,      // Allow editing user info for docket ready jobs
        canEditContacts: true,      // Allow editing contacts for docket ready jobs
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
        canEditMachineInfo: true,   // Allow editing machine info while waiting for approval
        canEditUserInfo: true,      // Allow editing user info while waiting for approval
        canEditContacts: true,      // Allow editing contacts while waiting for approval
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
        buttonText: 'Proceed',
        statusDisplay: 'Repaired',
        priority: 4.8
      };
    }

    // ============================================
    // PRIORITY 4.9: COMPLETED STATUS
    // ============================================
    // Jobs that have been completed and returned to customer
    if (existingWorkshopId && workshopStatus === 'completed') {
      return {
        canEditMachineInfo: false,  // Cannot edit machine info for completed jobs
        canEditUserInfo: false,     // Cannot edit user info for completed jobs
        canEditContacts: false,     // Cannot edit contacts for completed jobs
        canCreateOrder: false,      // Already processed
        canPickup: false,          // Not a pickup job
        buttonText: 'Job Completed',
        statusDisplay: 'Completed',
        priority: 4.9
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
    locationOfMachine,
    siteLocation,
    quoteOrRepair,
    action
  });

  // Reactive store subscription for button text
  $: submitButtonText = $submitButtonTextStore;

  // Debug reactive store subscription
  $: console.log('Store subscription updated - submitButtonText:', submitButtonText, 'timestamp:', new Date().toISOString());

  function addComment() {
    if (!newComment.trim()) return;

    // Get current user
    const user = get(currentUser);
    if (!user) {
      toastError('You must be logged in to add comments');
      return;
    }

    // Use profile name if available, otherwise fallback to email or display name
    const authorName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user.displayName || user.email?.split('@')[0] || 'Unknown User';

    const comment = {
      id: Date.now().toString(), // Simple ID based on timestamp
      text: newComment.trim(),
      author: authorName,
      created_at: new Date().toISOString()
    };

    comments = [...comments, comment];
    newComment = ''; // Clear the input
  }

  function addHistoryEntry(status: string, isCreation: boolean = false) {
    // Get current user
    const user = get(currentUser);
    if (!user) return;

    // Use profile name if available, otherwise fallback to email or display name
    const userName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user.displayName || user.email?.split('@')[0] || 'Unknown User';

    const historyEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: userName,
      status,
      isCreation
    };

    history = [...history, historyEntry];
  }


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
    locationOfMachine = 'Site';
    action = 'Pickup';
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
    repairedStatusTransition = '';

    // Clear photos - only revoke URLs for new photos created with URL.createObjectURL
    photos.forEach(p => {
      if (!p.isExisting) {
        URL.revokeObjectURL(p.url);
      }
    });
    photos = [];

    // Clear files - only revoke URLs for new files created with URL.createObjectURL
    files.forEach(f => {
      if (!f.isExisting) {
        URL.revokeObjectURL(f.url);
      }
    });
    files = [];

    // Clear errors
    photoError = '';
    fileError = '';
    contactError = '';

    // Clear comments
    comments = [];
    newComment = '';

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

  function closeCompletedModal() {
    showCompletedModal = false;
    // Navigate to workshop board
    navigateToWorkshopBoard();
  }

  async function handleDeleteJob() {
    if (!existingWorkshopId) {
      toastError('Cannot delete a job that hasn\'t been created yet');
      return;
    }

    // Close the confirmation modal and show processing modal
    showDeleteJobModal = false;
    resetDeleteProcessingSteps();
    showDeleteProcessingModal = true;

    try {
      // First, cancel the order in Maropost if it exists
      if (existingOrderId) {
        console.log('Cancelling Maropost order before deleting workshop:', existingOrderId);
        updateDeleteProcessingStep('cancellingOrder', true, false);

        try {
          // Wait for the cancel order endpoint to return a response before proceeding
          const cancelResponse = await cancelOrder(existingOrderId);
          console.log('Maropost cancel order response received:', cancelResponse);

          // Only proceed if we get a successful response
          if (cancelResponse && cancelResponse.Ack === 'Success') {
            updateDeleteProcessingStep('cancellingOrder', false, true);
            console.log('Maropost order cancelled successfully');
          } else {
            throw new Error('Cancel order response did not indicate success');
          }
        } catch (cancelError) {
          console.error('Failed to cancel Maropost order:', cancelError);
          // Continue with workshop deletion even if order cancellation fails
          updateDeleteProcessingStep('cancellingOrder', false, false); // Mark as not completed but not in progress
          toastError('Failed to cancel order in Maropost, but proceeding with workshop deletion');
        }
      } else {
        // No order to cancel, mark as completed
        updateDeleteProcessingStep('cancellingOrder', false, true);
      }

      // Now delete the workshop from the database (add deleted_at timestamp)
      console.log('Deleting workshop from database:', existingWorkshopId);
      updateDeleteProcessingStep('deletingWorkshop', true, false);

      await deleteWorkshop(existingWorkshopId);
      updateDeleteProcessingStep('deletingWorkshop', false, true);

      toastSuccess('Workshop job deleted successfully');
      // Navigate back to workshop board
      navigateToWorkshopBoard();
    } catch (error) {
      console.error('Error deleting workshop:', error);
      toastError('Failed to delete workshop job. Please try again.');
    } finally {
      showDeleteProcessingModal = false;
    }
  }

  function confirmDeleteJob() {
    showDeleteJobModal = true;
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

  /**
   * Generates a tag payload with product name, client work order, customer name, order ID, and date issued
   * @param {string|null} orderId - The order ID to use (if provided, otherwise uses existing/generated)
   * @returns {Object} JSON payload object with camelCase field names
   */
  function generateTag(orderId?: string | null) {
    // Use provided orderId, or fall back to existing/generated
    const finalOrderId = orderId || existingOrderId || generatedOrderId || null;

    // Convert created_at to AU Sydney timezone with full date and time
    let dateIssued = '';
    console.log('🔍 Generating dateIssued from createdAt:', createdAt);

    if (createdAt) {
      try {
        console.log('🔄 Parsing createdAt:', createdAt, 'Type:', typeof createdAt);
        const date = new Date(createdAt);
        console.log('📅 Original created_at date:', date.toISOString());
        console.log('📅 Date parsed successfully:', !isNaN(date.getTime()));

        // Use the original UTC date - toLocaleString will handle timezone conversion
        console.log('🇦🇺 Converting to Australia/Sydney timezone...');

        // Format as "3 November 2025 at 10:10:58 pm" (matching sample payload)
        const day = date.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          day: 'numeric'
        });
        const month = date.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          month: 'long'
        });
        const year = date.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric'
        });
        const timeString = date.toLocaleTimeString('en-AU', {
          timeZone: 'Australia/Sydney',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        dateIssued = `${day} ${month} ${year} at ${timeString}`;
        console.log('✅ Final dateIssued:', dateIssued);
      } catch (error) {
        console.warn('Error converting created_at to Sydney timezone:', error);
        // Fallback to current Sydney time
        const now = new Date();
        console.log('⚠️ Using current time as fallback');

        const day = now.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          day: 'numeric'
        });
        const month = now.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          month: 'long'
        });
        const year = now.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric'
        });
        const timeString = now.toLocaleTimeString('en-AU', {
          timeZone: 'Australia/Sydney',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        dateIssued = `${day} ${month} ${year} at ${timeString}`;
        console.log('✅ Final dateIssued (fallback):', dateIssued);
      }
    } else {
      console.log('⚠️ No createdAt available, using current time as fallback');
      // Fallback to current Sydney time if no created_at available
      const now = new Date();

      const day = now.toLocaleDateString('en-AU', {
        timeZone: 'Australia/Sydney',
        day: 'numeric'
      });
      const month = now.toLocaleDateString('en-AU', {
        timeZone: 'Australia/Sydney',
        month: 'long'
      });
      const year = now.toLocaleDateString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric'
      });
      const timeString = now.toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Sydney',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      dateIssued = `${day} ${month} ${year} at ${timeString}`;
      console.log('✅ Final dateIssued (no createdAt fallback):', dateIssued);
    }

    const payload = {
      productName: productName || '',
      clientsWorkOrder: clientsWorkOrder || '',
      customerName: customerName || '',
      orderId: finalOrderId,
      dateIssued: dateIssued
    };

    return payload;
  }

  /**
   * Calls Power Automate API with the generated tag payload
   * This function waits for the Maropost order to be created before calling Power Automate
   * @param {string} orderId - The order ID that was just created from Maropost
   */
  async function callPowerAutomateAPI(orderId: string) {
    try {
      // Ensure we have a valid orderId before proceeding
      if (!orderId) {
        console.error('Cannot call Power Automate API: orderId is missing');
        return null;
      }

      // Generate payload with the specific orderId that was just created
      const payload = generateTag(orderId);

      // Log the payload being sent
      console.log('Calling Power Automate API with payload:', payload);
      console.log('Payload JSON:', JSON.stringify(payload, null, 2));

      // Make sure to use POST method for Power Automate API
      console.log('Making POST request to Power Automate API...');
      const response = await fetch(
        'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7df52bcd1b054f31a92f9665986fb408/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6mFQ1Q-SlB-A3SjMtqIFKbBsJgzlpx0uJevloYt-I2Y',
        {
          method: 'POST', // Explicitly set to POST method
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Power Automate API call failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Power Automate API response:', responseText);
      return responseText;
    } catch (error) {
      console.error('Error calling Power Automate API:', error);
      // Don't throw error - we don't want to fail the whole submission if this fails
      toastError('Failed to call Power Automate API. Order was created successfully.');
      return null;
    }
  }

  /**
   * Regenerates and sends the tag to Power Automate
   * Can be called manually for existing workshops
   */
  async function regenerateAndSendTag() {
    console.log('🔄 REGENERATE TAG BUTTON CLICKED');
    console.log('🔍 Current createdAt value:', createdAt);
    console.log('🔍 Current existingWorkshopId:', existingWorkshopId);

    // Ensure workshop data is loaded if we have an existingWorkshopId but missing data
    if (existingWorkshopId && (!createdAt || !existingOrderId)) {
      console.log('📋 Workshop data not fully loaded, fetching...');
      console.log('🔍 Missing data - createdAt:', !!createdAt, 'existingOrderId:', !!existingOrderId);
      try {
        await loadExistingWorkshop(existingWorkshopId);
        console.log('✅ Workshop data loaded, createdAt:', createdAt, 'existingOrderId:', existingOrderId);
      } catch (error) {
        console.error('❌ Failed to load workshop data:', error);
        toastError('Failed to load workshop data for tag regeneration');
        return;
      }
    }

    try {
      // Use available order ID (button only shows when orderId exists)
      let orderIdToUse = existingOrderId || generatedOrderId;
      console.log('📋 Initial order ID check:', orderIdToUse);

      // If no order ID available, create a new Maropost order
      if (!orderIdToUse) {
        console.log('📋 No order ID found, creating new Maropost order...');
        toastInfo('Creating order for tag regeneration...');

        try {
          // Use selected customer data for order creation
          const { createOrder } = await import('$lib/services/maropost');

          let customerApiData;
          // Use selectedCustomer if available, otherwise show error
          if (!selectedCustomer) {
            console.error('❌ No customer selected for order creation');
            toastError('No customer selected. Cannot create order for tag regeneration.');
            return;
          }

          customerApiData = selectedCustomer;
          console.log('✅ Using selected customer data for order creation:', customerApiData);

          // Create the order
          const orderApiData = await createOrder(customerApiData);
          console.log('✅ Maropost order created:', orderApiData);

          // Extract the order ID
          let newOrderId: string | null = null;
          if (orderApiData && orderApiData.Order) {
            if (Array.isArray(orderApiData.Order) && orderApiData.Order.length > 0 && orderApiData.Order[0]?.OrderID) {
              newOrderId = orderApiData.Order[0].OrderID;
            } else if (!Array.isArray(orderApiData.Order) && orderApiData.Order.OrderID) {
              newOrderId = orderApiData.Order.OrderID;
            }
          }

          if (newOrderId) {
            console.log('📋 New order ID generated:', newOrderId);

            // Update the workshop with the new order_id
            try {
              const { updateWorkshop } = await import('$lib/services/workshop');
              await updateWorkshop(existingWorkshopId!, {
                order_id: newOrderId!,
                customerApiData: customerApiData,
                orderApiData: orderApiData
              });
              console.log('✅ Workshop updated with new order_id');

              // Set the order ID for tag generation
              orderIdToUse = newOrderId;
              existingOrderId = newOrderId; // Update the local variable too

            } catch (updateError) {
              console.error('❌ Failed to update workshop with order_id:', updateError);
              toastError('Order created but failed to update workshop record');
              return;
            }
          } else {
            console.error('❌ Failed to extract order ID from Maropost response');
            toastError('Failed to create order - no order ID returned');
            return;
          }

        } catch (orderError) {
          console.error('❌ Failed to create Maropost order:', orderError);

          // Check if this is a billing name error and show specific modal
          if (orderError instanceof Error && orderError.message.includes('Customer billing name is required for order creation')) {
            showCustomerBillingModal = true;
          } else {
            toastError('Failed to create order for tag regeneration');
          }

          return;
        }
      }

      console.log('📋 Final order ID to use:', orderIdToUse);

      // Show loading state
      toastInfo('Regenerating and sending tag...');

      // Generate the payload (orderId will be null/empty if not available)
      const payload = generateTag(orderIdToUse);

      console.log('📤 Regenerating tag with payload:', payload);
      console.log('📤 Payload JSON:', JSON.stringify(payload, null, 2));

      // Call Power Automate API
      const response = await fetch(
        'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7df52bcd1b054f31a92f9665986fb408/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6mFQ1Q-SlB-A3SjMtqIFKbBsJgzlpx0uJevloYt-I2Y',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Power Automate API call failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('📥 API Response Status:', response.status, response.statusText);
      console.log('📥 API Response Text:', responseText);

      // Success is determined by HTTP status code 200
      if (response.status === 200) {
        console.log('✅ Tag regeneration successful! Status:', response.status);
      } else {
        console.error('❌ Unexpected API response status:', response.status, responseText);
        throw new Error(`Power Automate API failed with status ${response.status}: ${response.statusText}`);
      }

      console.log('🎉 Tag regeneration completed successfully!');
      const message = orderIdToUse
        ? 'Tag regenerated and sent successfully!'
        : 'Tag sent successfully (without order ID - for testing purposes)';
      toastSuccess(message);
    } catch (error) {
      console.error('❌ Error regenerating tag:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      toastError(`Failed to regenerate tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

</script>

  <div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex flex-col items-center space-y-3">
        <h1 class="text-2xl font-bold text-center">
          {#if existingWorkshopId && workshopStatus && workshopStatus !== 'new' && existingOrderId}
            Order <a href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={existingOrderId}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">#{existingOrderId}</a>
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
                <legend class="block text-sm font-medium text-gray-700 mb-1">Location of Machine</legend>
                <div class="flex items-center gap-6">
                  <label class="inline-flex items-center gap-2 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed' : 'cursor-pointer'}">
                    <input id="loc-site" type="radio" name="locationOfMachine" value="Site" bind:group={locationOfMachine} class="h-4 w-4 text-blue-600" disabled={!currentJobStatus.canEditMachineInfo} />
                    <span>Site</span>
                  </label>
                  <label class="inline-flex items-center gap-2 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed' : 'cursor-pointer'}">
                    <input id="loc-workshop" type="radio" name="locationOfMachine" value="Workshop" bind:group={locationOfMachine} class="h-4 w-4 text-blue-600" disabled={!currentJobStatus.canEditMachineInfo} />
                    <span>Workshop</span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="action-dropdown">Action <span class="text-red-500">*</span></label>
              <select
                id="action-dropdown"
                bind:value={action}
                class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}"
                disabled={!currentJobStatus.canEditMachineInfo}
              >
                <option value="Pickup">Pickup</option>
                <option value="Repair">Repair</option>
                <option value="Deliver to Workshop">Deliver to Workshop</option>
              </select>
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
              </label>
              <input
                id="site-location"
                type="text"
                bind:value={siteLocation}
                class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditMachineInfo ? 'cursor-not-allowed opacity-50' : ''}"
                placeholder={locationOfMachine === 'Site' ? 'Enter site location *' : 'Enter location details (optional)'}
                disabled={!currentJobStatus.canEditMachineInfo}
              />
              {#if startedWith === 'camera' && locationOfMachine === 'Site'}
                <div class="mt-2 p-2 bg-blue-100 border border-blue-200 text-blue-700 rounded text-sm">
                  💡 Tip: You can add site location details later if needed
                </div>
              {/if}
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1" for="pickup-schedule">
                {scheduleLabel}
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
                          <a href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={selectedCustomer.Username}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
                            Open this customer in Maropost
                          </a>
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

      <!-- Single Column Layout for Photos -->
      <div class="grid grid-cols-1 gap-6">
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
      </div>

      <!-- Single Column Layout for Files -->
      <div class="grid grid-cols-1 gap-6">
        <!-- Files -->
        <div>
          <FileManager
            bind:files
            bind:error={fileError}
            minFilesRequired={MIN_FILES_REQUIRED}
            workshopStatus={workshopStatus}
            on:filesUpdated={event => files = event.detail.files}
            on:error={event => fileError = event.detail.message}
            on:fileClick={async (event) => {
              const file = files[event.detail.fileIndex];
              if (file.url) {
                // For private buckets, get a signed URL
                try {
                  const fileName = file.url.split('/storage/v1/object/public/workshop-files/')[1];
                  if (fileName) {
                    const { supabase } = await import('$lib/supabase');
                    const { data, error } = await supabase.storage
                      .from('workshop-files')
                      .createSignedUrl(fileName, 3600); // 1 hour expiry

                    if (error) throw error;
                    window.open(data.signedUrl, '_blank');
                    return;
                  }
                } catch (error) {
                  console.error('Failed to create signed URL:', error);
                }
              }
              // Fallback to direct URL
              window.open(file.url, '_blank');
            }}
          />
        </div>
      </div>

      <!-- Two Column Layout for Optional Contacts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

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

      <!-- Comments Section -->
      <div class="grid grid-cols-1 gap-6">
        <div>
          <div
            class="flex items-center justify-between px-4 py-3 rounded"
            style="background-color: rgb(30, 30, 30);"
          >
            <h2 class="font-medium text-white">Comments</h2>
            {#if comments.length > 0}
              <span class="text-white text-sm bg-gray-600 px-2 py-1 rounded-full">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </span>
            {/if}
          </div>

          <div class="mt-4 space-y-4">
            <!-- Existing Comments -->
            {#if comments.length > 0}
              <div class="space-y-3">
                {#each comments as comment (comment.id)}
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="font-medium text-gray-900">{comment.author}</span>
                          <span class="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p class="text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Add New Comment -->
            <div class="bg-white border border-gray-300 rounded-lg p-4">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="new-comment">
                Add Comment
              </label>
              <div class="space-y-3">
                <textarea
                  id="new-comment"
                  rows="3"
                  bind:value={newComment}
                  class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your comment..."
                ></textarea>
                <div class="flex justify-end">
                  <button
                    type="button"
                    on:click={addComment}
                    disabled={!newComment.trim()}
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- History Section -->
      <div class="grid grid-cols-1 gap-6">
        <div>
          <div
            class="flex items-center justify-between px-4 py-3 rounded"
            style="background-color: rgb(30, 30, 30);"
          >
            <h2 class="font-medium text-white">History</h2>
            {#if history.length > 0}
              <span class="text-white text-sm bg-gray-600 px-2 py-1 rounded-full">
                {history.length} event{history.length !== 1 ? 's' : ''}
              </span>
            {/if}
          </div>

          <div class="mt-4 space-y-4">
            <!-- History Timeline -->
            {#if history.length > 0}
              <div class="space-y-3">
                {#each history as historyEntry (historyEntry.id)}
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="flex-shrink-0">
                          <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                          </div>
                        </div>
                        <div>
                          <div class="flex items-center gap-2 mb-1">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {historyEntry.isCreation ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} capitalize">
                              {#if historyEntry.isCreation}
                                {#if historyEntry.status === 'new'}
                                  Job Created
                                {:else}
                                  Job Created - {historyEntry.status === 'pickup' ? 'Pickup' : historyEntry.status === 'deliver_to_workshop' ? 'Delivery' : historyEntry.status === 'booked_in_for_repair_service' ? 'Repair' : historyEntry.status.replace(/_/g, ' ')}
                                {/if}
                              {:else}
                                {historyEntry.status.replace(/_/g, ' ')}
                              {/if}
                            </span>
                          </div>
                          <div class="text-xs text-gray-500">
                            by {historyEntry.user} • {new Date(historyEntry.timestamp).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center py-8">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No history yet</h3>
                <p class="mt-1 text-sm text-gray-500">Job history will appear here as the job progresses through different stages.</p>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Responsive button layout -->
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <!-- Delete Job Button - Only show for existing workshops -->
        {#if existingWorkshopId}
          <div class="sm:flex-shrink-0">
            <button
              type="button"
              on:click={confirmDeleteJob}
              disabled={isSubmitting}
              class="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete Job
            </button>
          </div>
        {/if}

        <!-- Right side buttons - responsive grid on small screens -->
        <div class="flex flex-col gap-3 sm:flex-row sm:gap-3 sm:flex-wrap sm:justify-end">
          <!-- Cancel Button -->
          <a href="{base}/workshop/workshop-board" class="w-full sm:w-auto px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center">Cancel</a>

          <!-- Regenerate Tag Button - show for all existing workshops -->
          {#if existingWorkshopId}
            <button
              type="button"
              on:click={regenerateAndSendTag}
              disabled={isSubmitting}
              class="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
              </svg>
              Regenerate Tag
            </button>
          {/if}

          <!-- Update Job Button - always visible for data updates only -->
          <button
            type="button"
            on:click={handleUpdateJob}
            disabled={isSubmitting}
            class="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <!-- Status Transition Dropdown - only show for repaired status -->
          {#if existingWorkshopId && workshopStatus === 'repaired'}
            <select
              bind:value={repairedStatusTransition}
              class="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!repairedStatusTransition ? 'border-red-300' : ''}"
            >
              <option value="">Select next status...</option>
              <option value="completed">Completed</option>
              <option value="return">Return</option>
              <option value="pickup_from_workshop">Pickup From Workshop</option>
              <option value="to_be_scrapped">To Be Scrapped</option>
              <option value="pending_jobs">Pending Jobs</option>
            </select>
          {/if}

          <!-- Submit Button - for order creation, status transitions, and updates -->
          {#if existingWorkshopId}
            <button
              type="button"
              on:click={handleSubmit}
              disabled={isSubmitting || (existingWorkshopId !== null && workshopStatus === null) || (workshopStatus === 'repaired' && !repairedStatusTransition)}
              class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    isPickup={action === 'Pickup'}
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

  <!-- Completed Modal (for return submissions) -->
  {#if showCompletedModal}
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
              <h3 class="text-lg font-medium text-gray-900">Job Completed</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully completed. The equipment has been returned to the customer and the job is now closed.
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
                  <strong>Job Status:</strong> Updated to "Completed"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeCompletedModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Processing Modal (for new job creation) -->
  {#if showProcessingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-6 text-center">
          <div class="flex justify-center mb-4">
            <svg class="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-4">Creating Your Workshop Job</h3>

          <!-- Progress Checklist -->
          <div class="space-y-3 mb-6">
            {#each Object.entries(processingSteps) as [key, step]}
              <div class="flex items-center justify-between p-3 rounded-md border {step.completed ? 'bg-green-50 border-green-200' : step.inProgress ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}">
                <div class="flex items-center">
                  <div class="flex-shrink-0 mr-3">
                    {#if step.completed}
                      <!-- Completed checkmark -->
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    {:else if step.inProgress}
                      <!-- In progress spinner -->
                      <svg class="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {:else}
                      <!-- Pending -->
                      <div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    {/if}
                  </div>
                  <span class="text-sm font-medium {step.completed ? 'text-green-800' : step.inProgress ? 'text-blue-800' : 'text-gray-600'}">
                    {step.label}
                  </span>
                </div>
                {#if step.completed}
                  <span class="text-xs text-green-600 font-medium">✓</span>
                {/if}
              </div>
            {/each}
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div class="flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <p class="text-sm text-blue-700 font-medium">
                Please do not close this window or navigate away
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Processing Modal -->
  {#if showDeleteProcessingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-6 text-center">
          <div class="flex justify-center mb-4">
            <svg class="animate-spin h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-4">Deleting Workshop Job</h3>

          <!-- Progress Checklist -->
          <div class="space-y-3 mb-6">
            {#each Object.entries(deleteProcessingSteps) as [key, step]}
              <div class="flex items-center justify-between p-3 rounded-md border {step.completed ? 'bg-green-50 border-green-200' : step.inProgress ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}">
                <div class="flex items-center">
                  <div class="flex-shrink-0 mr-3">
                    {#if step.completed}
                      <!-- Completed checkmark -->
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    {:else if step.inProgress}
                      <!-- In progress spinner -->
                      <svg class="animate-spin w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {:else}
                      <!-- Pending -->
                      <div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    {/if}
                  </div>
                  <span class="text-sm font-medium {step.completed ? 'text-green-800' : step.inProgress ? 'text-red-800' : 'text-gray-600'}">
                    {step.label}
                  </span>
                </div>
                {#if step.completed}
                  <span class="text-xs text-green-600 font-medium">✓</span>
                {/if}
              </div>
            {/each}
          </div>

          <div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div class="flex items-center justify-center">
              <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <p class="text-sm text-red-700 font-medium">
                Please do not close this window or navigate away
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Customer Billing Information Modal -->
  {#if showCustomerBillingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Customer Billing Information Required</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The selected customer is missing required billing information (first name and last name). This information is needed to create a Maropost order.
          </p>
          <div class="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-orange-700">
                  <strong>What to do:</strong> Update the customer's billing information in Maropost with their first name and last name.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            type="button"
            on:click={() => showCustomerBillingModal = false}
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          {#if selectedCustomer}
            <a
              href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={selectedCustomer.Username}"
              target="_blank"
              on:click={() => showCustomerBillingModal = false}
              class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium text-center"
            >
              Update in Maropost
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Job Confirmation Modal -->
  {#if showDeleteJobModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Delete Workshop Job</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            Are you sure you want to delete this workshop job? This action cannot be undone.
          </p>
          <div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">
                  <strong>Warning:</strong> This will permanently remove the job and all associated photos from the system.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            type="button"
            on:click={() => showDeleteJobModal = false}
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={handleDeleteJob}
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Delete Job
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>


