<script lang="ts">
	import { fade } from 'svelte/transition';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import PhotoManager from '$lib/components/PhotoManager.svelte';
	import FileManager from '$lib/components/FileManager.svelte';
	import type { PhotoItem, FileItem, Contact } from '$lib/types/workshop';
	import type { Customer } from '$lib/services/customers';
	import {
		createWorkshop,
		getPhotoStatistics,
		cleanupOrphanedPhotos,
		getWorkshop,
		updateWorkshop,
		deleteWorkshop
	} from '$lib/services/workshop';
	import { fetchCustomerData, createOrder, cancelOrder } from '$lib/services/maropost';
	import { onMount, onDestroy } from 'svelte';
	import { validateWorkshopForm } from '$lib/utils/validation';
	import { page } from '$app/stores';
	import { currentUser } from '$lib/firebase';
	import { userProfile, fetchUserProfile } from '$lib/userProfile';
	import { get, writable } from 'svelte/store';
	import { toastError, toastSuccess, toastInfo } from '$lib/utils/toast';
	import WorkshopHeader from './components/WorkshopHeader.svelte';
	import MachineInformationSection from './components/MachineInformationSection.svelte';
	import UserInformationSection from './components/UserInformationSection.svelte';
	import DocketInfoSection from './components/DocketInfoSection.svelte';
	import CommentsSection from './components/CommentsSection.svelte';
	import HistorySection from './components/HistorySection.svelte';
	import FormActions from './components/FormActions.svelte';
	import WorkshopModals from './components/WorkshopModals.svelte';
	import type { LocationType, QuoteOrRepairType, PartItem, JobStatus } from './types/types';
	import { evaluateJobStatus } from './logic/jobStatus';

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
	$: scheduleKey =
		action === 'Pickup'
			? 'pickup_schedule'
			: action === 'Repair'
				? 'repair_schedule'
				: action === 'Deliver to Workshop'
					? 'delivery_schedule'
					: 'pickup_schedule';

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

	let quoteOrRepair: QuoteOrRepairType = 'Quote';
	let parts: PartItem[] = [{ sku: '', quantity: '' }];

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
		savingWorkshop: { label: 'Saving Workshop to Database', completed: false, inProgress: false },
		callingPowerAutomate: {
			label: 'Generating Tag and sending emails',
			completed: false,
			inProgress: false
		}
	};

	// Delete processing progress tracking
	let deleteProcessingSteps = {
		cancellingOrder: { label: 'Cancelling Maropost Order', completed: false, inProgress: false },
		deletingWorkshop: {
			label: 'Deleting Workshop from Database',
			completed: false,
			inProgress: false
		}
	};

	// Reset processing steps
	function resetProcessingSteps() {
		processingSteps = {
			creatingOrder: { label: 'Creating Maropost Order', completed: false, inProgress: false },
			savingWorkshop: { label: 'Saving Workshop to Database', completed: false, inProgress: false },
			callingPowerAutomate: {
				label: 'Generating Tag and sending emails',
				completed: false,
				inProgress: false
			}
		};
	}

	// Reset delete processing steps
	function resetDeleteProcessingSteps() {
		deleteProcessingSteps = {
			cancellingOrder: { label: 'Cancelling Maropost Order', completed: false, inProgress: false },
			deletingWorkshop: {
				label: 'Deleting Workshop from Database',
				completed: false,
				inProgress: false
			}
		};
	}

	// Update processing step status
	function updateProcessingStep(
		step: keyof typeof processingSteps,
		inProgress: boolean,
		completed: boolean
	) {
		processingSteps[step].inProgress = inProgress;
		processingSteps[step].completed = completed;
	}

	// Update delete processing step status
	function updateDeleteProcessingStep(
		step: keyof typeof deleteProcessingSteps,
		inProgress: boolean,
		completed: boolean
	) {
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
	const unsubUserProfile = userProfile.subscribe((value) => {
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
				e.returnValue =
					'Job creation is in progress. Are you sure you want to leave? Your changes may not be saved.';
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
	$: photoUrls = photos.map((p) => p.url);

	// Machine Information section state
	let isMachineInfoExpanded = true;

	// User Information section state
	let isUserInfoExpanded = true;

	// Auto-collapse sections for non-new workshops
	$: if (existingWorkshopId && workshopStatus && workshopStatus !== 'new') {
		isMachineInfoExpanded = false;
		isUserInfoExpanded = false;
	}

	// Generate summary for machine information
	$: machineInfoSummaryItems = (() => {
		const items = [];
		if (productName.trim()) items.push({ label: 'Product', value: productName, priority: 1 });
		if (locationOfMachine) items.push({ label: 'Location', value: locationOfMachine, priority: 2 });
		if (makeModel.trim()) items.push({ label: 'Make/Model', value: makeModel, priority: 3 });
		if (serialNumber.trim()) items.push({ label: 'Serial', value: serialNumber, priority: 4 });
		if (siteLocation.trim()) items.push({ label: 'Site', value: siteLocation, priority: 5 });
		if (pickupSchedule.trim())
			items.push({
				label: scheduleLabel,
				value: formatPickupSchedule(pickupSchedule),
				priority: 6
			});
		if (faultDescription.trim())
			items.push({ label: 'Fault Description', value: faultDescription, priority: 7 });
		return items.sort((a, b) => a.priority - b.priority);
	})();

	// Generate summary for user information
	$: userInfoSummaryItems = (() => {
		const items = [];
		if (customerName.trim()) items.push({ label: 'Customer', value: customerName, priority: 1 });
		if (contactEmail.trim()) items.push({ label: 'Email', value: contactEmail, priority: 2 });
		if (contactNumber.trim()) items.push({ label: 'Phone', value: contactNumber, priority: 3 });
		if (optionalContacts.length > 0)
			items.push({
				label: 'Contacts',
				value: `${optionalContacts.length} additional`,
				priority: 4
			});
		return items.sort((a, b) => a.priority - b.priority);
	})();

	// Determine docket info background color based on quote or repair selection
	$: docketInfoBackgroundClass =
		quoteOrRepair === 'Quote' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800';

	// Determine if pickup schedule is required (new jobs with Pickup action)
	$: isPickupScheduleRequired =
		(workshopStatus === 'new' || !existingWorkshopId) && action === 'Pickup';

	// Dynamic schedule label based on action
	$: scheduleLabel =
		action === 'Pickup'
			? 'Pickup Schedule'
			: action === 'Repair'
				? 'Repair Schedule'
				: action === 'Deliver to Workshop'
					? 'Delivery Schedule'
					: 'Schedule';

	// Check referrer to determine if user came from camera page
	$: if (typeof window !== 'undefined') {
		const referrer = document.referrer;
		const currentUrl = window.location.href;

		// Check if user came from camera page or if URL contains camera parameter
		if (
			referrer.includes('/workshop/camera') ||
			currentUrl.includes('from=camera') ||
			$page.url.searchParams.get('from') === 'camera'
		) {
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
	$: if (
		!existingWorkshopId &&
		(workshopStatus === 'new' || workshopStatus === null) &&
		history.length === 0
	) {
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
				photos = workshop.photo_urls.map((url) => ({
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
					files = fileUrlsArray.map((url) => ({
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
		customerName =
			customer.BillingAddress.BillFirstName + ' ' + customer.BillingAddress.BillLastName;
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
		const isNewPickupJob =
			(workshopStatus === 'new' || !existingWorkshopId) && locationOfMachine === 'Site';
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

		// Validate contacts for new jobs
		if (workshopStatus === 'new' || !existingWorkshopId) {
			if (optionalContacts.length === 0) {
				toastError('Please add at least one contact before creating the job.');
				return;
			}
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
			console.log(
				'New job detected in handleUpdateJob - creating Maropost order first before saving to database'
			);
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
				console.log(
					'Creating Maropost order for new job using selected customer:',
					selectedCustomer
				);
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
					// Wait for order creation to complete
					// Power Automate API call is deferred until after workshop save
					console.log(
						'Order creation confirmed. Will call Power Automate API after saving workshop...'
					);
				} else {
					console.error('Maropost order creation failed - no OrderID returned:', orderApiData);
					throw new Error('Order creation failed - no OrderID returned');
				}
			} catch (error) {
				console.error('Failed to create Maropost order for new job:', error);

				// Check if this is a billing name error and show specific modal
				if (
					error instanceof Error &&
					error.message.includes('Customer billing name is required for order creation')
				) {
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
		const newPhotos = photos.filter((p) => !p.isExisting).map((p) => p.file);
		const existingPhotoUrls = photos.filter((p) => p.isExisting).map((p) => p.url);

		// Separate new files from existing files
		const newFiles = files.filter((f) => !f.isExisting).map((f) => f.file);
		const existingFileUrls = files.filter((f) => f.isExisting).map((f) => f.url);

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
			...(existingWorkshopId &&
				workshopStatus &&
				workshopStatus !== 'new' &&
				workshopStatus !== 'pickup' && {
					docket_info: {
						quoteOrRepair,
						quoteDescription,
						additionalInformation,
						stockOnHand,
						labour,
						travelTime,
						callOut,
						parts: parts.filter((part) => part.sku.trim() || part.quantity.trim()) // Only include non-empty parts
					}
				}),
			// Include order data for new jobs
			...(shouldCreateOrder &&
				generatedOrderId && {
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

			// Now that workshop is saved and we have the ID, call Power Automate if needed
			if (
				(shouldCreateOrder && generatedOrderId) ||
				(existingWorkshopId && existingOrderId && shouldCreateOrder)
			) {
				const orderIdToUse = generatedOrderId || existingOrderId;
				const workshopIdToUse = existingWorkshopId || (workshop && workshop.id);

				if (orderIdToUse && workshopIdToUse) {
					console.log('Calling Power Automate API now that workshop is saved...', workshopIdToUse);
					updateProcessingStep('callingPowerAutomate', true, false);
					await callPowerAutomateAPI(orderIdToUse, workshopIdToUse);
					updateProcessingStep('callingPowerAutomate', false, true);
				}
			}

			// Send email notifications for comments if workshop has an order_id
			const workshopIdToUse = existingWorkshopId || (workshop && workshop.id);
			const orderIdToUse = generatedOrderId || existingOrderId;

			if (orderIdToUse && workshopIdToUse && comments.length > 0) {
				// Send email notification for the most recent comment (last in array)
				const latestComment = comments[comments.length - 1];
				console.log('Sending comment email notification after workshop save...');
				sendCommentEmailNotification(latestComment.text, orderIdToUse, workshopIdToUse).catch((error) => {
					console.error('Failed to send comment email notification after save:', error);
				});
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
			toastError(
				error instanceof Error ? error.message : 'Failed to save workshop. Please try again.'
			);
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
		const isNewPickupJob =
			(workshopStatus === 'new' || !existingWorkshopId) && locationOfMachine === 'Site';
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

		// Validate contacts for new jobs
		if (workshopStatus === 'new' || !existingWorkshopId) {
			if (optionalContacts.length === 0) {
				toastError('Please add at least one contact before creating the job.');
				return;
			}
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
				console.log(
					'Creating Maropost order for new job using selected customer:',
					selectedCustomer
				);
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
					// Wait for order creation to complete
					// Power Automate API call is deferred until after workshop save
					console.log(
						'Order creation confirmed. Will call Power Automate API after saving workshop...'
					);
				} else {
					console.error('Maropost order creation failed - no OrderID returned:', orderApiData);
					throw new Error('Order creation failed - no OrderID returned');
				}
			} catch (error) {
				console.error('Failed to create Maropost order for new job:', error);

				// Check if this is a billing name error and show specific modal
				if (
					error instanceof Error &&
					error.message.includes('Customer billing name is required for order creation')
				) {
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
					// Wait for order creation to complete
					// Power Automate API call is deferred until after workshop save
					console.log(
						'Order creation confirmed. Will call Power Automate API after saving workshop...'
					);
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
		const newPhotos = photos.filter((p) => !p.isExisting).map((p) => p.file);
		const existingPhotoUrls = photos.filter((p) => p.isExisting).map((p) => p.url);

		// Separate new files from existing files
		const newFiles = files.filter((f) => !f.isExisting).map((f) => f.file);
		const existingFileUrls = files.filter((f) => f.isExisting).map((f) => f.url);

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
			...(existingWorkshopId &&
				workshopStatus &&
				workshopStatus !== 'new' &&
				workshopStatus !== 'pickup' && {
					docket_info: {
						quoteOrRepair,
						quoteDescription,
						additionalInformation,
						stockOnHand,
						labour,
						travelTime,
						callOut,
						parts: parts.filter((part) => part.sku.trim() || part.quantity.trim()) // Only include non-empty parts
					}
				}),
			...(shouldCreateOrder &&
				generatedOrderId && {
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
			const hasCreationEntry = history.some((entry) => entry.status === 'new' && entry.isCreation);
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
			.then(async (workshop) => {
				updateProcessingStep('savingWorkshop', false, true);

				// Call Power Automate API if needed
				if (
					(shouldCreateOrder && generatedOrderId) ||
					(existingWorkshopId && existingOrderId && shouldCreateOrder)
				) {
					const orderIdToUse = generatedOrderId || existingOrderId;
					const workshopIdToUse = existingWorkshopId || (workshop && workshop.id);

					if (orderIdToUse && workshopIdToUse) {
						console.log(
							'Calling Power Automate API now that workshop is saved...',
							workshopIdToUse
						);
						updateProcessingStep('callingPowerAutomate', true, false);
						await callPowerAutomateAPI(orderIdToUse, workshopIdToUse);
						updateProcessingStep('callingPowerAutomate', false, true);
					}
				}

				// Send email notifications for comments if workshop has an order_id
				const workshopIdToUse = existingWorkshopId || (workshop && workshop.id);
				const orderIdToUse = generatedOrderId || existingOrderId;

				if (orderIdToUse && workshopIdToUse && comments.length > 0) {
					// Send email notification for the most recent comment (last in array)
					const latestComment = comments[comments.length - 1];
					console.log('Sending comment email notification after workshop save...');
					sendCommentEmailNotification(latestComment.text, orderIdToUse, workshopIdToUse).catch((error) => {
						console.error('Failed to send comment email notification after save:', error);
					});
				}

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
				} else if (
					(workshopStatus === 'new' || !existingWorkshopId) &&
					action === 'Deliver to Workshop'
				) {
					successMessage = `Workshop created successfully and scheduled for delivery to workshop${generatedOrderId ? ` - Order #${generatedOrderId} generated` : ''}!`;
				} else if (wasPickupJob) {
					successMessage = 'Pickup job submitted successfully and moved to "To Be Quoted" status!';
				} else if (existingWorkshopId && workshopStatus === 'to_be_quoted') {
					successMessage =
						'Workshop docket information saved successfully and status updated to "Docket Ready"!';
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

				// Generate tag automatically if workshop status is "to_be_quoted"
				if (workshop.status === 'to_be_quoted') {
					console.log('Workshop saved with status "to_be_quoted" - generating tag automatically...');
					// Run tag generation in background without blocking the UI
					setTimeout(async () => {
						try {
							// Use the order ID from the saved workshop or generated order ID
							const orderIdToUse = workshop.order_id || generatedOrderId;
							if (orderIdToUse) {
								console.log('Generating tag for workshop:', workshop.id, 'with order ID:', orderIdToUse);
								await callPowerAutomateAPI(orderIdToUse, workshop.id);
								console.log('Tag generated successfully for to_be_quoted workshop');
							} else {
								console.warn('No order ID available for tag generation - workshop will need manual tag regeneration');
							}
						} catch (error) {
							console.error('Failed to generate tag for to_be_quoted workshop:', error);
							// Don't show error toast as this is automatic and shouldn't interrupt user flow
						}
					}, 100); // Small delay to ensure UI is responsive
				}

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
	$: console.log(
		'Store subscription updated - submitButtonText:',
		submitButtonText,
		'timestamp:',
		new Date().toISOString()
	);

	async function sendCommentEmailNotification(commentText: string, orderId: string, workshopId: string) {
		try {
			// Get current user
			const user = get(currentUser);
			if (!user || !user.email) {
				console.warn('Cannot send comment email: user or user email not available');
				return;
			}

			// Build the workshop URL - use full URL for email
			const workshopUrl = `https://rapidcleanillawarra.github.io/rapidtools/workshop/form?workshop_id=${workshopId}`;

			// Construct the email payload according to Power Automate schema
			const payload = {
				sender: user.email,
				email: {
					to: 'contact@rapidcleanillawarra.com.au;orders@rapidcleanillawarra.com.au;marketing@rapidcleanillawarra.com.au',
					cc: '',
					bcc: '',
					subject: `Workshop Comment #${orderId}`,
					body: `<p>${user.email} have commented on <a href="${workshopUrl}">#${orderId}</a>:</p><p>${commentText.replace(/\n/g, '<br>')}</p>`,
					attachments: []
				}
			};

			// Send POST request to Power Automate endpoint
			const response = await fetch(
				'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7a1c480fddea4e1caeba5b84ea04d19d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sOuoBDGjTVPm3CGEZyLsLgBc1WFzapeZkzi8xl-IBI4',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				}
			);

			if (!response.ok) {
				throw new Error(`Power Automate API call failed: ${response.status} ${response.statusText}`);
			}

			console.log('Comment email notification sent successfully');
		} catch (error) {
			console.error('Error sending comment email notification:', error);
			// Don't throw error - we don't want to fail comment addition if email fails
		}
	}

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

		const commentText = newComment.trim();
		const comment = {
			id: Date.now().toString(), // Simple ID based on timestamp
			text: commentText,
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
		photos.forEach((p) => {
			if (!p.isExisting) {
				URL.revokeObjectURL(p.url);
			}
		});
		photos = [];

		// Clear files - only revoke URLs for new files created with URL.createObjectURL
		files.forEach((f) => {
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
			toastError("Cannot delete a job that hasn't been created yet");
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

	async function handleFileClick(event: CustomEvent<{ fileIndex: number }>) {
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
	}

	/**
	 * Generates a notification payload with HTML content for PDF, email, and Teams
	 * @param {string|null} orderId - The order ID to use (if provided, otherwise uses existing/generated)
	 * @returns {Object} JSON payload object with HTML content for notifications
	 */
	function generateNotificationPayload(orderId: string | null, workshopId: string) {
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
			orderId: finalOrderId,
			clientsWorkOrder: clientsWorkOrder || '',
			productName: productName || '',
			customerName: customerName || '',
			dateIssued: dateIssued,
			makeModel: makeModel || '',
			serialNumber: serialNumber || '',
			siteLocation: siteLocation || '',
			faultDescription: faultDescription || '',
			pdf: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Tag Sticker</title>
  <style>
    /* PDF-friendly reset */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #ffffff;           /* full-width clean background */
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      padding: 0;                    /* remove page padding so it's full width */
    }

    /* Sticker container (full width) */
    .sticker {
      width: 100%;
      background: #ffffff;
      border: 1px solid #cfcfcf;
      border-radius: 0;              /* better for full-width print/PDF */
      padding: 16px 16px 14px 16px;
    }

    /* Top accent + header */
    .accent-bar {
      height: 8px;
      background: #2c7a7b;
      border-radius: 0;
      margin-bottom: 10px;
      width: 100%;
    }

    .header {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .header td {
      vertical-align: middle;
    }

    .title {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      padding: 8px 0 4px 0;
      text-align: center;
    }

    .subtle {
      font-size: 10px;
      color: #6b7280;
      text-align: right;
      white-space: nowrap;
    }

    /* Data table */
    table.tag {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed; /* stable columns in PDF */
      border: 1px solid #d9d9d9;
      overflow: hidden;
    }

    table.tag th, table.tag td {
      border-bottom: 1px solid #e6e6e6;
      padding: 8px 10px;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    table.tag tr:last-child th,
    table.tag tr:last-child td {
      border-bottom: none;
    }

    table.tag th {
      width: 32%;
      background: #f7f7f7;
      text-align: left;
      font-size: 10px;
      color: #111827;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    table.tag td {
      font-size: 11px;
      color: #374151;
    }

    /* Fault description as a block */
    .fault {
      border: 1px solid #e1e1e1;
      padding: 8px;
      background: #ffffff;
      min-height: 48px;
      white-space: pre-wrap;
    }
  </style>
</head>

<body>
  <div class="sticker">
    <div class="accent-bar"></div>

    <table class="header">
      <tr>
        <td class="subtle" style="text-align: right;">Date Issued: ${dateIssued || ''}</td>
      </tr>
      <tr>
        <td class="title"># ${finalOrderId || 'N/A'}</td>
      </tr>
    </table>

    <table class="tag">
      <tr>
        <th>Client Work Order</th>
        <td>${clientsWorkOrder || ''}</td>
      </tr>

      <tr>
        <th>Product Name</th>
        <td>${productName || ''}</td>
      </tr>

      <tr>
        <th>Customer Name</th>
        <td>${customerName || ''}</td>
      </tr>

      <tr>
        <th>Company</th>
        <td>${selectedCustomer?.BillingAddress?.BillCompany || ''}</td>
      </tr>

      <tr>
        <th>Make / Model</th>
        <td>${makeModel || ''}</td>
      </tr>

      <tr>
        <th>Serial Number</th>
        <td>${serialNumber || ''}</td>
      </tr>

      <tr>
        <th>Site Location</th>
        <td>${siteLocation || ''}</td>
      </tr>

      <tr>
        <th>Fault Description</th>
        <td><div class="fault">${faultDescription || ''}</div></td>
      </tr>

      <!-- Contacts in a nested table (Name / Phone / Email separated) -->
      ${
				optionalContacts && optionalContacts.length > 0
					? `
        <tr>
          <th>Contacts</th>
          <td style="padding:0;">
            <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
              <tr>
                <th style="width:34%; background:#f7f7f7; border-bottom:1px solid #e6e6e6; padding:6px 8px; text-align:left; font-size:10px; font-weight:700; color:#111827;">Name</th>
                <th style="width:33%; background:#f7f7f7; border-bottom:1px solid #e6e6e6; padding:6px 8px; text-align:left; font-size:10px; font-weight:700; color:#111827;">Phone</th>
                <th style="width:33%; background:#f7f7f7; border-bottom:1px solid #e6e6e6; padding:6px 8px; text-align:left; font-size:10px; font-weight:700; color:#111827;">Email</th>
              </tr>

              ${optionalContacts
								.map(
									(contact) => `
              <tr>
                <td style="border-bottom:1px solid #e6e6e6; padding:6px 8px; word-wrap:break-word; overflow-wrap:break-word;">
                  ${contact.name || ''}
                </td>
                <td style="border-bottom:1px solid #e6e6e6; padding:6px 8px; word-wrap:break-word; overflow-wrap:break-word;">
                  ${contact.number || ''}
                </td>
                <td style="border-bottom:1px solid #e6e6e6; padding:6px 8px; word-wrap:break-word; overflow-wrap:break-word;">
                  ${contact.email || ''}
                </td>
              </tr>
              `
								)
								.join('')}

            </table>
          </td>
        </tr>
      `
					: ''
			}
    </table>
  </div>
</body>
</html>`,
			email_body: `<p class="editor-paragraph">Hi Shaira/Zsarmaine,</p><br><p class="editor-paragraph">A new workshop job has been created by ${profile ? `${profile.firstName} ${profile.lastName}`.trim() : get(currentUser)?.displayName || get(currentUser)?.email?.split('@')[0] || 'Unknown User'}.</p><br><p class="editor-paragraph">Job Information:<br>Workshop ID: ${finalOrderId || 'N/A'}</p><p class="editor-paragraph">Product Name: ${productName || ''}<br>Client's Work Order: ${clientsWorkOrder || ''}<br>Customer Name: ${customerName || ''}<br><br>Print Tag: <a href="https://rapidcleanillawarra.github.io/rapidtools/workshop-tag/print?id=${workshopId}">Print Tag Link</a><br><br>Please see the attached document for printing.</p>`,
			email_subject: 'New Workshop Job - Order #' + (finalOrderId || 'N/A'),
			teams_message: `<p class="editor-paragraph">Hi Shaira/Zsarmaine,<br><br>A new workshop job has been created by ${profile ? `${profile.firstName} ${profile.lastName}`.trim() : get(currentUser)?.displayName || get(currentUser)?.email?.split('@')[0] || 'Unknown User'}.<br><br>Job Information:<br>Workshop ID: ${finalOrderId || 'N/A'}<br>Product Name: ${productName || ''}<br>Client's Work Order: ${clientsWorkOrder || ''}<br>Customer Name: ${customerName || ''}<br><br>Print Tag: <a href="https://rapidcleanillawarra.github.io/rapidtools/workshop-tag/print?id=${workshopId}">Print Tag Link</a><br><br>Please see the attached document for printing.</p>`
		};

		return payload;
	}

	/**
	 * Calls Power Automate API with the generated notification payload
	 * This function waits for the Maropost order to be created before calling Power Automate
	 * @param {string} workshopId - The workshop ID (UUID) for the print link
	 */
	async function callPowerAutomateAPI(orderId: string, workshopId: string) {
		try {
			// Ensure we have a valid orderId before proceeding
			if (!orderId) {
				console.error('Cannot call Power Automate API: orderId is missing');
				return null;
			}

			// Generate payload with the specific orderId that was just created
			const payload = generateNotificationPayload(orderId, workshopId);

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
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				}
			);

			if (!response.ok) {
				throw new Error(
					`Power Automate API call failed: ${response.status} ${response.statusText}`
				);
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
			console.log(
				'🔍 Missing data - createdAt:',
				!!createdAt,
				'existingOrderId:',
				!!existingOrderId
			);
			try {
				await loadExistingWorkshop(existingWorkshopId);
				console.log(
					'✅ Workshop data loaded, createdAt:',
					createdAt,
					'existingOrderId:',
					existingOrderId
				);
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
						if (
							Array.isArray(orderApiData.Order) &&
							orderApiData.Order.length > 0 &&
							orderApiData.Order[0]?.OrderID
						) {
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
					if (
						orderError instanceof Error &&
						orderError.message.includes('Customer billing name is required for order creation')
					) {
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
			const payload = generateNotificationPayload(orderIdToUse, existingWorkshopId!);

			console.log('📤 Regenerating tag with payload:', payload);
			console.log('📤 Payload JSON:', JSON.stringify(payload, null, 2));

			// Call Power Automate API
			const response = await fetch(
				'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7df52bcd1b054f31a92f9665986fb408/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6mFQ1Q-SlB-A3SjMtqIFKbBsJgzlpx0uJevloYt-I2Y',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				}
			);

			if (!response.ok) {
				throw new Error(
					`Power Automate API call failed: ${response.status} ${response.statusText}`
				);
			}

			const responseText = await response.text();
			console.log('📥 API Response Status:', response.status, response.statusText);
			console.log('📥 API Response Text:', responseText);

			// Success is determined by HTTP status code 200
			if (response.status === 200) {
				console.log('✅ Tag regeneration successful! Status:', response.status);
			} else {
				console.error('❌ Unexpected API response status:', response.status, responseText);
				throw new Error(
					`Power Automate API failed with status ${response.status}: ${response.statusText}`
				);
			}

			console.log('🎉 Tag regeneration completed successfully!');
			const message = orderIdToUse
				? 'Tag regenerated and sent successfully!'
				: 'Tag sent successfully (without order ID - for testing purposes)';
			toastSuccess(message);
		} catch (error) {
			console.error('❌ Error regenerating tag:', error);
			console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
			toastError(
				`Failed to regenerate tag: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}
</script>

<div class="container mx-auto px-4 py-8" in:fade>
	<div class="overflow-hidden rounded-lg bg-white shadow-lg">
		<WorkshopHeader
			{existingWorkshopId}
			{workshopStatus}
			{existingOrderId}
			{currentJobStatus}
			{startedWith}
		/>

		<form class="space-y-8 p-6">
			<div class="mb-4 text-sm text-gray-600">
				Fields marked with <span class="text-red-500">*</span> are required
			</div>
			<!-- Two Column Layout for Machine and User Information -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<MachineInformationSection
					bind:isMachineInfoExpanded
					{machineInfoSummaryItems}
					{currentJobStatus}
					bind:locationOfMachine
					bind:action
					bind:productName
					bind:clientsWorkOrder
					bind:makeModel
					bind:serialNumber
					bind:siteLocation
					bind:faultDescription
					{startedWith}
					{scheduleLabel}
					{pickupSchedule}
					{minDateTime}
					{updatePickupSchedule}
				/>

				<UserInformationSection
					bind:isUserInfoExpanded
					{userInfoSummaryItems}
					{currentJobStatus}
					bind:customerName
					{selectedCustomer}
					bind:contactEmail
					bind:contactNumber
					bind:optionalContacts
					bind:contactError
					bind:contactsManager
					{workshopStatus}
					{handleCustomerSelect}
					{handleCustomerClear}
					{handleContactsUpdated}
					{handleContactError}
				/>
			</div>

			<!-- Single Column Layout for Photos -->
			<div class="grid grid-cols-1 gap-6">
				<!-- Photos -->
				<div>
					<PhotoManager
						bind:photos
						bind:error={photoError}
						minPhotosRequired={MIN_PHOTOS_REQUIRED}
						{workshopStatus}
						on:photosUpdated={(event) => (photos = event.detail.photos)}
						on:error={(event) => (photoError = event.detail.message)}
						on:photoClick={(event) => openPhotoViewer(event.detail.photoIndex)}
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
						{workshopStatus}
						on:filesUpdated={(event) => (files = event.detail.files)}
						on:error={(event) => (fileError = event.detail.message)}
						on:fileClick={handleFileClick}
					/>
				</div>
			</div>

			<DocketInfoSection
				{workshopStatus}
				bind:quoteOrRepair
				bind:quoteDescription
				bind:additionalInformation
				bind:stockOnHand
				bind:labour
				bind:travelTime
				bind:callOut
				bind:parts
				{addPartRow}
				{removePartRow}
				{docketInfoBackgroundClass}
			/>

			<CommentsSection {comments} bind:newComment {addComment} />

			<HistorySection {history} />

			<FormActions
				{base}
				{existingWorkshopId}
				{workshopStatus}
				{isSubmitting}
				{confirmDeleteJob}
				{regenerateAndSendTag}
				{handleUpdateJob}
				bind:repairedStatusTransition
				{handleSubmit}
				{getSubmitButtonLoadingText}
				{submitButtonText}
			/>
		</form>
	</div>

	<WorkshopModals
		{showSuccessModal}
		{successMessage}
		{generatedOrderId}
		{closeSuccessModal}
		{showPostSubmissionModal}
		{action}
		{navigateToWorkshopBoard}
		bind:showIncompleteContactModal
		{clearIncompleteContact}
		{showPhotoViewer}
		{photoUrls}
		bind:currentPhotoIndex
		{closePhotoViewer}
		{showPickupSubmissionModal}
		{showPickupStatusChangeModal}
		{closePickupStatusChangeModal}
		{showDocketReadyModal}
		{closeDocketReadyModal}
		{showWaitingApprovalModal}
		{closeWaitingApprovalModal}
		{showWaitingForPartsModal}
		{closeWaitingForPartsModal}
		{showBookedInRepairModal}
		{closeBookedInRepairModal}
		{showRepairedModal}
		{closeRepairedModal}
		{showReturnModal}
		{closeReturnModal}
		{showCompletedModal}
		{closeCompletedModal}
		{showProcessingModal}
		{processingSteps}
		{showDeleteProcessingModal}
		{deleteProcessingSteps}
		bind:showCustomerBillingModal
		{selectedCustomer}
		bind:showDeleteJobModal
		{handleDeleteJob}
	/>
</div>
