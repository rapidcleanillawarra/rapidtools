<script lang="ts">
  import FullCalendarWrapper from './FullCalendarWrapper.svelte';
  import { onMount } from 'svelte';
  import { schedulesStore } from '../stores';
  import { get } from 'svelte/store';
  import Modal from '$lib/components/Modal.svelte'; // Import modal component
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';
  import { 
    loadSTTEvents, 
    saveSTTEvent, 
    updateSTTEvent, 
    deleteSTTEvent,
    calendarEventToSTTEvent,
    sttEventToCalendarEvent,
    type STTEvent 
  } from '../utils/sttEvents';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
  import { toastSuccess, toastError, toastInfo, toastWarning } from '$lib/utils/toast';

  type CalendarEvent = {
    id: string;
    title: string;
    start: string; // ISO string
    end?: string;  // ISO string, optional
    extendedProps: {
      location: string;
      company: string;
      scheduleId: number;
      infoIndex: number;
      occurrenceIndex: number;
    };
    backgroundColor: string;
  };

  let calendarEvents: CalendarEvent[] = [];
  let currentMonth: number = new Date().getMonth() + 1;
  let showModal = false;
  let startDateStr = new Date().toISOString().split('T')[0]; // Default to today
  let endDateStr = new Date().toISOString().split('T')[0];   // Default to today
  let selectedLocation: any = null;
  let scheduledItems = new Set<string>(); // Track scheduled items
  let isEditMode = false;
  let editingEventId: string | null = null;
  let validationErrors: string[] = [];
  let showConfirmModal = false;
  let eventToDelete: CalendarEvent | null = null;
  let isLoading = false;
  let isSaving = false;
  let isDeleting = false;
  let user: any;
  let profile: any;
  
  // Subscribe to user and profile stores
  currentUser.subscribe(value => user = value);
  userProfile.subscribe(value => profile = value);
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  $: filteredSchedules = $schedulesStore.filter(
    schedule => schedule.start_month === currentMonth
  );

  function validateSchedule(): boolean {
    validationErrors = [];
    
    // Date validation
    if (!startDateStr || !endDateStr) {
      validationErrors.push('Both start and end dates are required');
      return false;
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    // Check if dates are in the past
    if (startDate < today) {
      validationErrors.push('Start date cannot be in the past');
    }

    if (endDate < today) {
      validationErrors.push('End date cannot be in the past');
    }

    // Check if end date is before start date
    if (endDate < startDate) {
      validationErrors.push('End date cannot be before start date');
    }

    // Check if date range is too long (optional - you can adjust this limit)
    const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > 365) {
      validationErrors.push('Date range cannot exceed 1 year');
    }

    // Location and contact validation
    if (selectedLocation) {
      // Check if location has required fields
      if (!selectedLocation.sub_company_name?.trim()) {
        validationErrors.push('Sub-company name is required');
      }
      
      if (!selectedLocation.location?.trim()) {
        validationErrors.push('Location is required');
      }
      
      // Check if location has at least one contact
      if (!selectedLocation.contacts || selectedLocation.contacts.length === 0) {
        validationErrors.push('At least one contact is required for this location');
      } else {
        // Check if at least one contact has a name
        const hasValidContact = selectedLocation.contacts.some((contact: any) => 
          contact.name && contact.name.trim().length > 0
        );
        
        if (!hasValidContact) {
          validationErrors.push('At least one contact must have a name');
        }
        
        // Additional validation: ensure at least one contact has either phone or email
        const hasContactInfo = selectedLocation.contacts.some((contact: any) => 
          (contact.phone && contact.phone.trim().length > 0) || 
          (contact.email && contact.email.trim().length > 0)
        );
        
        if (!hasContactInfo) {
          validationErrors.push('At least one contact must have a phone number or email address');
        }
      }
    } else {
      validationErrors.push('No location selected for scheduling');
    }

    return validationErrors.length === 0;
  }

  function handleMonthChange(newMonth: number) {
    currentMonth = newMonth;
  }

  function openModal(location: any, schedule: any, infoIndex: number, companyIndex: number) {
    const itemKey = `${schedule.id}-${infoIndex}`;
    const existingEvent = calendarEvents.find(event => 
      event.extendedProps.scheduleId === schedule.id && 
      event.extendedProps.infoIndex === infoIndex
    );

    if (existingEvent) {
      // Edit existing event
      isEditMode = true;
      editingEventId = existingEvent.id;
      startDateStr = existingEvent.start.split('T')[0];
      endDateStr = existingEvent.end ? existingEvent.end.split('T')[0] : existingEvent.start.split('T')[0];
    } else {
      // Add new event
      isEditMode = false;
      editingEventId = null;
      startDateStr = new Date().toISOString().split('T')[0];
      endDateStr = new Date().toISOString().split('T')[0];
    }

    selectedLocation = {
      ...location,
      company: schedule.company,
      scheduleId: schedule.id,
      infoIndex: infoIndex,
      backgroundColor: `hsl(${(companyIndex * 40) % 360}, 70%, 60%)` // Use companyIndex here
    };
    validationErrors = []; // Clear validation errors when opening modal
    showModal = true;
  }

  function openEventModal(event: any) {
    // Find the corresponding schedule and location info
    const schedule = $schedulesStore.find(s => s.id === event.extendedProps.scheduleId);
    if (!schedule) {
      toastError('Schedule not found');
      return;
    }

    const locationInfo = schedule.information[event.extendedProps.infoIndex];
    if (!locationInfo) {
      toastError('Location information not found');
      return;
    }

    // Find the company index for color
    const companyIndex = $schedulesStore.findIndex(s => s.id === event.extendedProps.scheduleId);

    // Open modal in edit mode
    isEditMode = true;
    editingEventId = event.id;
    startDateStr = event.start.split('T')[0];
    endDateStr = event.end ? event.end.split('T')[0] : event.start.split('T')[0];

    selectedLocation = {
      ...locationInfo,
      company: schedule.company,
      scheduleId: schedule.id,
      infoIndex: event.extendedProps.infoIndex,
      backgroundColor: event.backgroundColor
    };
    validationErrors = []; // Clear validation errors when opening modal
    showModal = true;
  }

  async function addEvent() {
    if (!selectedLocation || !startDateStr || !endDateStr) return;
    
    // Check if user is authenticated
    if (!user) {
      toastError('You must be logged in to save schedules', 'Authentication Required');
      return;
    }
    
    // Validate schedule before proceeding
    if (!validateSchedule()) {
      return; // Don't proceed if validation fails
    }
    
    try {
      isSaving = true;
      if (isEditMode && editingEventId) {
        // Update existing event in Firestore
        await updateSTTEvent(editingEventId, {
          start_date: new Date(startDateStr).toISOString(),
          end_date: new Date(endDateStr).toISOString()
        });
        
        // Update local calendar events
        calendarEvents = calendarEvents.map(event => {
          if (event.id === editingEventId) {
            return {
              ...event,
              start: new Date(startDateStr).toISOString(),
              end: new Date(endDateStr).toISOString()
            };
          }
          return event;
        });
        
        toastSuccess('Schedule updated successfully', 'Updated');
        // Add success animation
        const successElement = document.createElement('div');
        successElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-checkmark';
        successElement.innerHTML = '✅ Schedule Updated!';
        document.body.appendChild(successElement);
        setTimeout(() => {
          document.body.removeChild(successElement);
        }, 3000);
      } else {
        // Check if event already exists
        const existingEvent = calendarEvents.find(event => 
          event.extendedProps.scheduleId === selectedLocation.scheduleId && 
          event.extendedProps.infoIndex === selectedLocation.infoIndex
        );

        if (existingEvent) {
          // Don't add duplicate, just close modal
          showModal = false;
          return;
        }

        // Create new event data
        const newEventData = {
          title: `${selectedLocation.company} - ${selectedLocation.sub_company_name}`,
          start: new Date(startDateStr).toISOString(),
          end: new Date(endDateStr).toISOString(),
          extendedProps: {
            location: selectedLocation.location,
            company: selectedLocation.company,
            scheduleId: selectedLocation.scheduleId,
            infoIndex: selectedLocation.infoIndex,
            occurrenceIndex: 0
          },
          backgroundColor: selectedLocation.backgroundColor
        };

        // Save to Firestore
        const schedule = $schedulesStore.find(s => s.id === selectedLocation.scheduleId);
        const locationInfo = schedule?.information[selectedLocation.infoIndex];
        
        if (!schedule || !locationInfo) {
          toastError('Invalid schedule or location information', 'Invalid Data');
          return;
        }
        
        // Validate that the information_id exists
        if (!locationInfo.information_id) {
          toastError('Missing location information ID', 'Missing Data');
          return;
        }

        const sttEventData = calendarEventToSTTEvent(
          newEventData, 
          locationInfo, 
          schedule,
          user?.uid,
          user?.email
        );
        
        const firestoreId = await saveSTTEvent(sttEventData);
        
        // Add to local calendar events
        const newEvent: CalendarEvent = {
          id: firestoreId,
          ...newEventData
        };
        
        calendarEvents = [...calendarEvents, newEvent];
        
        // Add to scheduled items set
        const itemKey = `${selectedLocation.scheduleId}-${selectedLocation.infoIndex}`;
        scheduledItems = new Set(scheduledItems).add(itemKey);
        
        toastSuccess('Schedule added successfully', 'Added');
        // Add success animation
        showSuccessAnimation();
      }
    } catch (error) {
      console.error('Error saving event:', error);
      toastError('Failed to save schedule', 'Error');
      return;
    } finally {
      isSaving = false;
    }
    
    showModal = false;
    startDateStr = new Date().toISOString().split('T')[0]; // Reset to today
    endDateStr = new Date().toISOString().split('T')[0];   // Reset to today
    isEditMode = false;
    editingEventId = null;
    validationErrors = []; // Clear validation errors
  }

  function removeEvent(eventId: string) {
    const eventToRemove = calendarEvents.find(event => event.id === eventId);
    if (eventToRemove) {
      // Set for confirmation
      eventToDelete = eventToRemove;
      showConfirmModal = true;
    }
  }

  function removeCurrentEvent() {
    if (editingEventId) {
      const eventToRemove = calendarEvents.find(event => event.id === editingEventId);
      if (eventToRemove) {
        eventToDelete = eventToRemove;
        showConfirmModal = true;
      }
    }
  }

  async function confirmDelete() {
    if (!eventToDelete) return;
    
    const event = eventToDelete; // Create local reference to avoid null check issues
    
    try {
      isDeleting = true;
      // Delete from Firestore
      await deleteSTTEvent(event.id);
      
      // Remove from scheduled items set
      const itemKey = `${event.extendedProps.scheduleId}-${event.extendedProps.infoIndex}`;
      scheduledItems = new Set([...scheduledItems].filter(item => item !== itemKey));
      
      // Remove from calendar events
      calendarEvents = calendarEvents.filter(calEvent => calEvent.id !== event.id);
      
      toastSuccess('Schedule deleted successfully', 'Deleted');
      showDeleteSuccessAnimation();
    } catch (error) {
      console.error('Error deleting event:', error);
      toastError('Failed to delete schedule', 'Error');
      return;
    } finally {
      isDeleting = false;
    }
    
    // Close both modals
    showConfirmModal = false;
    showModal = false;
    isEditMode = false;
    editingEventId = null;
    validationErrors = [];
    eventToDelete = null;
  }

  function cancelDelete() {
    showConfirmModal = false;
    eventToDelete = null;
  }

  // Reactive validation - validate schedule whenever dates change
  $: if (startDateStr && endDateStr) {
    validateSchedule();
  }

  // Load events from Firestore on mount
  async function loadEventsFromFirestore() {
    try {
      isLoading = true;
      showLoadingProgress('Loading your schedules...');
      const sttEvents = await loadSTTEvents();
      
      // Convert STT events to calendar events and map infoIndex
      const events: CalendarEvent[] = [];
      const scheduledSet = new Set<string>();
      
      sttEvents.forEach(sttEvent => {
        // Find the corresponding schedule and location info to get infoIndex
        const schedule = $schedulesStore.find(s => s.id === sttEvent.schedule_id.toString());
        if (schedule) {
          const infoIndex = schedule.information.findIndex(info => info.information_id === sttEvent.information_id);
          if (infoIndex !== -1) {
            const calendarEvent = sttEventToCalendarEvent(sttEvent);
            calendarEvent.extendedProps.infoIndex = infoIndex;
            events.push(calendarEvent);
            
            // Add to scheduled items set
            const itemKey = `${sttEvent.schedule_id.toString()}-${infoIndex}`;
            scheduledSet.add(itemKey);
          }
        }
      });
      
      calendarEvents = events;
      scheduledItems = scheduledSet;
      
    } catch (error) {
      console.error('Error loading events from Firestore:', error);
      toastError('Failed to load events from database', 'Error');
    } finally {
      isLoading = false;
    }
  }

  // Show success animation with confetti effect
  function showSuccessAnimation() {
    toastSuccess('Schedule saved successfully!', 'Success');
    createConfettiEffect();
    addSuccessCelebration();
  }

  // Show delete success animation
  function showDeleteSuccessAnimation() {
    toastSuccess('Schedule deleted successfully!', 'Deleted');
  }

  // Create confetti effect
  function createConfettiEffect() {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(confetti);
        
        setTimeout(() => {
          if (document.body.contains(confetti)) {
            document.body.removeChild(confetti);
          }
        }, 5000);
      }, i * 50);
    }
  }

  // Add ripple effect to buttons
  function addRippleEffect(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  // Add floating animation to elements
  function addFloatingAnimation(element: HTMLElement) {
    element.classList.add('floating-animation');
  }

  // Remove floating animation
  function removeFloatingAnimation(element: HTMLElement) {
    element.classList.remove('floating-animation');
  }

  // Add success celebration
  function addSuccessCelebration() {
    // Add sparkle effect
    const sparkles = ['✨', '🎉', '🎊', '⭐', '🌟'];
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-effect';
        sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
        sparkle.style.left = Math.random() * 100 + 'vw';
        sparkle.style.top = Math.random() * 100 + 'vh';
        sparkle.style.animationDelay = Math.random() * 2 + 's';
        document.body.appendChild(sparkle);
        
        setTimeout(() => {
          if (document.body.contains(sparkle)) {
            document.body.removeChild(sparkle);
          }
        }, 3000);
      }, i * 200);
    }
  }

  // Add loading progress indicator
  function showLoadingProgress(message: string) {
    toastInfo(message, 'Loading');
  }

  // Refresh events from Firestore
  async function refreshEvents() {
    showLoadingProgress('Refreshing schedules...');
    await loadEventsFromFirestore();
  }

  onMount(() => {
    loadEventsFromFirestore();
  });
</script>

<div class="grid grid-cols-12 gap-6">
  <div class="col-span-4 bg-white rounded-lg border border-gray-200 p-6 shadow-lg">
    <h3 class="text-lg font-medium text-gray-900 mb-6 flex items-center">
      <span class="mr-2">📅</span>
      Company Locations for {months[currentMonth - 1]}
    </h3>
    {#if isLoading}
      <div class="space-y-6">
        <!-- Skeleton for company containers -->
        {#each Array(3) as _, index}
          <div class="company-skeleton animate-fade-in" style="animation-delay: {index * 100}ms;">
            <!-- Company header skeleton -->
            <div class="flex items-center justify-between bg-gray-200 px-4 py-3 rounded-t-lg mb-3">
              <SkeletonLoader type="text" width="150px" height="1.25rem" />
              <SkeletonLoader type="circle" width="1rem" height="1rem" />
            </div>
            <!-- Location items skeleton -->
            <div class="space-y-3">
              {#each Array(2) as _, itemIndex}
                <div class="p-4 rounded-lg bg-gray-100 flex justify-between items-center">
                  <div class="flex-1">
                    <SkeletonLoader type="text" width="120px" height="1rem" className="mb-2" />
                    <SkeletonLoader type="text" width="80px" height="0.75rem" />
                  </div>
                  <SkeletonLoader type="text" width="60px" height="0.75rem" />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div id="company-locations" class="space-y-6">
        {#each filteredSchedules as schedule, index (schedule.id)}
          <div class="company-container mb-6 animate-fade-in hover:transform hover:scale-[1.02] transition-all duration-300" style="animation-delay: {index * 100}ms;">
            <div 
              class="flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-3 rounded-t-lg mb-3 shadow-lg transform hover:scale-[1.02] transition-all duration-300 hover:shadow-xl"
            >
              <h4 class="text-md font-semibold flex items-center">
                <span class="mr-2 text-lg">🏢</span>
                {schedule.company}
              </h4>
              <div 
                class="w-4 h-4 rounded-full shadow-lg animate-pulse" 
                style="background-color: hsl({(index * 40) % 360}, 70%, 60%)">
              </div>
            </div>
            <div class="company-items space-y-3">
              {#each schedule.information as info, infoIndex (info.information_id)}
                <div
                  class="location-item interactive-hover p-4 rounded-lg text-white cursor-pointer flex justify-between items-center transform hover:scale-[1.03] hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1"
                  style="background: linear-gradient(135deg, hsl({(index * 40) % 360}, 70%, 60%), hsl({(index * 40) % 360}, 70%, 50%))"
                  on:click={() => openModal(info, schedule, infoIndex, index)}
                  on:mouseenter={(e) => addFloatingAnimation(e.currentTarget)}
                  on:mouseleave={(e) => removeFloatingAnimation(e.currentTarget)}
                >
                  <div class="flex-1">
                    <div class="font-medium text-sm mb-1 flex items-center">
                      <span class="mr-2">📍</span>
                      {info.sub_company_name}
                    </div>
                    <div class="text-xs opacity-90 flex items-center">
                      <span class="mr-1">🏢</span>
                      {info.location}
                    </div>
                  </div>
                  {#if scheduledItems.has(`${schedule.id}-${infoIndex}`)}
                    <div class="flex items-center success-glow">
                      <div class="bg-green-500 rounded-full p-1 mr-2 animate-bounce shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                      </div>
                      <span class="text-xs font-medium text-green-200 animate-pulse">Scheduled</span>
                    </div>
                  {:else}
                    <div class="text-xs opacity-60 flex items-center">
                      <span class="mr-1">⏰</span>
                      Click to schedule
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📋</div>
            <div class="text-gray-500 font-medium">No companies scheduled for {months[currentMonth - 1]}</div>
            <div class="text-sm text-gray-400 mt-2">Select a different month to view schedules</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="col-span-8 bg-white rounded-lg border border-gray-200 p-6 shadow-lg">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-medium text-gray-900 flex items-center">
        <span class="mr-2">🗓️</span>
        Schedule Calendar
      </h3>
      <button 
        on:click={refreshEvents}
        on:click={addRippleEffect}
        disabled={isLoading}
        class="btn-primary floating-btn px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center shadow-md"
      >
        {#if isLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        {/if}
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
    <div class="relative">
      {#if isLoading}
        <div class="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg backdrop-blur-sm">
          <div class="text-center">
            <div class="relative">
              <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
              <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-ping"></div>
            </div>
            <div class="mt-4 text-gray-600 font-medium">Updating calendar...</div>
            <div class="mt-2 text-sm text-gray-400">Please wait while we sync your schedules</div>
          </div>
        </div>
      {/if}
      <FullCalendarWrapper 
        events={calendarEvents} 
        onMonthChange={handleMonthChange}
        onEventClick={openEventModal}
        onEventRemove={(eventId) => {
          removeEvent(eventId);
        }}
      />
    </div>
  </div>
</div>

<ToastContainer />

{#if showModal && selectedLocation}
  <Modal 
    show={showModal} 
    onClose={() => {
      showModal = false;
      isEditMode = false;
      editingEventId = null;
    }}
  >
    <svelte:fragment slot="header">
      <div class="modal-enter flex items-center">
        <div class="mr-3 p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div>
          <div class="text-lg font-semibold">{isEditMode ? 'Edit Schedule' : 'Add Schedule'}</div>
          <div class="text-sm text-gray-500">{selectedLocation.sub_company_name}</div>
        </div>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="body">
      <div class="modal-enter">
      <div class="p-6">
        <div class="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
          <h2 class="text-xl font-bold mb-2 flex items-center">
            <span class="mr-2 text-2xl">📍</span>
            {selectedLocation.sub_company_name}
          </h2>
          <p class="text-gray-600 flex items-center">
            <span class="mr-2">🏢</span>
            {selectedLocation.location}
          </p>
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-medium mb-3 text-gray-700 flex items-center">
            <span class="mr-2 text-lg">📅</span>
            Date Range
          </label>
          <div class="flex space-x-4">
            <div class="flex-1">
              <label class="block text-xs text-gray-600 mb-2 font-medium flex items-center">
                <span class="mr-1">🎯</span>
                Start Date
              </label>
              <div class="relative">
                <input 
                  type="date" 
                  bind:value={startDateStr}
                  class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 hover:border-gray-400 hover:shadow-md"
                  min={new Date().toISOString().split('T')[0]}
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-600 mb-2 font-medium flex items-center">
                <span class="mr-1">🏁</span>
                End Date
              </label>
              <div class="relative">
                <input 
                  type="date" 
                  bind:value={endDateStr}
                  class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 hover:border-gray-400 hover:shadow-md"
                  min={startDateStr || new Date().toISOString().split('T')[0]}
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {#if validationErrors.length > 0}
            <div class="mt-4 p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg animate-bounce-in">
              <div class="text-sm text-red-800">
                <div class="font-medium mb-3 flex items-center">
                  <div class="mr-2 p-1 bg-red-500 rounded-full">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  Please fix the following errors:
                </div>
                <ul class="space-y-2">
                  {#each validationErrors as error, index}
                    <li class="flex items-center animate-slide-in" style="animation-delay: {index * 100}ms;">
                      <span class="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></span>
                      <span class="text-red-700">{error}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
          {/if}
        </div>
        
        <div class="flex justify-between items-center">
          {#if isEditMode && editingEventId}
            <button 
              on:click={removeCurrentEvent}
              disabled={isDeleting}
              class="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center"
            >
              {#if isDeleting}
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Removing...
              {:else}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Remove Schedule
              {/if}
            </button>
          {:else}
            <div></div>
          {/if}
          
          <div class="flex space-x-3">
            <button 
              on:click={() => {
                showModal = false;
                isEditMode = false;
                editingEventId = null;
              }}
              disabled={isSaving || isDeleting}
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 hover:shadow-md flex items-center"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Cancel
            </button>
            <button 
              on:click={addEvent}
              on:click={addRippleEffect}
              disabled={!startDateStr || !endDateStr || validationErrors.length > 0 || isSaving || isDeleting}
              class="btn-primary px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg disabled:from-gray-400 disabled:to-gray-500 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center"
            >
              {#if isSaving}
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                {isEditMode ? 'Updating...' : 'Saving...'}
              {:else}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                {isEditMode ? 'Update Schedule' : 'Add to Calendar'}
              {/if}
            </button>
          </div>
        </div>
      </div>
    </svelte:fragment>
  </Modal>
{/if}

{#if showConfirmModal && eventToDelete}
  <Modal 
    show={showConfirmModal} 
    onClose={cancelDelete}
  >
    <svelte:fragment slot="header">
      Confirm Delete Schedule
    </svelte:fragment>
    <svelte:fragment slot="body">
      <div class="p-6">
        <div class="mb-4">
          <div class="flex items-center mb-3">
            <div 
              class="w-4 h-4 rounded mr-3" 
              style="background-color: {eventToDelete.backgroundColor}">
            </div>
            <h3 class="text-lg font-semibold">{eventToDelete.title}</h3>
          </div>
          <p class="text-gray-600 mb-2">Location: {eventToDelete.extendedProps.location}</p>
          <p class="text-gray-600 mb-4">
            Date: {new Date(eventToDelete.start).toLocaleDateString()}
            {#if eventToDelete.end && eventToDelete.end !== eventToDelete.start}
              - {new Date(eventToDelete.end).toLocaleDateString()}
            {/if}
          </p>
        </div>
        
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <div class="flex">
            <svg class="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div class="text-sm text-yellow-800">
              <p class="font-medium">Are you sure you want to delete this schedule?</p>
              <p class="mt-1">This action cannot be undone.</p>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button 
            on:click={cancelDelete}
            disabled={isDeleting}
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
          >
            Cancel
          </button>
          <button 
            on:click={confirmDelete}
            disabled={isDeleting}
            class="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center"
          >
            {#if isDeleting}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Deleting...
            {:else}
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete Schedule
            {/if}
          </button>
        </div>
      </div>
    </svelte:fragment>
  </Modal>
{/if}

<style>
  .fc .fc-event {
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .fc .fc-event:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  /* Fade in animation for company containers */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.6s ease-out forwards;
  }
  
  /* Pulse animation for loading states */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* Bounce animation for scheduled items */
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translate3d(0, 0, 0);
    }
    40%, 43% {
      transform: translate3d(0, -8px, 0);
    }
    70% {
      transform: translate3d(0, -4px, 0);
    }
    90% {
      transform: translate3d(0, -2px, 0);
    }
  }
  
  .animate-bounce {
    animation: bounce 1s infinite;
  }
  
  /* Scale animation for hover effects */
  .hover-scale {
    transition: transform 0.2s ease-out;
  }
  
  .hover-scale:hover {
    transform: scale(1.02);
  }
  
  /* Gradient text animation */
  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
  
  /* Modal entrance animation */
  .modal-enter {
    animation: modalEnter 0.3s ease-out;
  }
  
  @keyframes modalEnter {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  /* Success checkmark animation */
  @keyframes checkmark {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  .animate-checkmark {
    animation: checkmark 0.5s ease-out;
  }
  
  /* Shimmer loading effect */
  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
    }
  }
  
  .shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: shimmer 1.5s infinite;
  }
  
  /* Ripple effect for buttons */
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
  }
  
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  /* Enhanced button styles */
  .btn-primary {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  /* Floating action button effect */
  .floating-btn {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .floating-btn:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
  
  /* Card hover effects */
  .card-hover {
    transition: all 0.3s ease;
  }
  
  .card-hover:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  }

  /* Confetti animation */
  .confetti-piece {
    position: fixed;
    top: -10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: confetti-fall linear infinite;
    z-index: 9999;
    pointer-events: none;
  }

  @keyframes confetti-fall {
    0% {
      transform: translateY(-10px) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }

  /* Enhanced animations */
  .animate-bounce-in {
    animation: bounceIn 0.6s ease-out;
  }

  @keyframes bounceIn {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.9);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .animate-slide-in {
    animation: slideIn 0.5s ease-out forwards;
    opacity: 0;
    transform: translateX(-20px);
  }

  @keyframes slideIn {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .floating-animation {
    animation: floating 3s ease-in-out infinite;
  }

  @keyframes floating {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  /* Location item hover effects */
  .location-item {
    position: relative;
    overflow: hidden;
  }

  .location-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .location-item:hover::before {
    left: 100%;
  }

  /* Company skeleton animation */
  .company-skeleton {
    opacity: 0;
    animation: skeletonFadeIn 0.6s ease-out forwards;
  }

  @keyframes skeletonFadeIn {
    to {
      opacity: 1;
    }
  }

  /* Enhanced modal animations */
  .modal-enter {
    animation: modalEnter 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes modalEnter {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-30px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Pulse animation for scheduled items */
  .scheduled-pulse {
    animation: scheduledPulse 2s ease-in-out infinite;
  }

  @keyframes scheduledPulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  /* Sparkle effect */
  .sparkle-effect {
    position: fixed;
    font-size: 2rem;
    pointer-events: none;
    z-index: 10000;
    animation: sparkle 3s ease-out forwards;
  }

  @keyframes sparkle {
    0% {
      transform: scale(0) rotate(0deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.5) rotate(180deg);
      opacity: 1;
    }
    100% {
      transform: scale(0) rotate(360deg);
      opacity: 0;
    }
  }

  /* Enhanced loading states */
  .loading-shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Hover effects for interactive elements */
  .interactive-hover {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .interactive-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  /* Success state animations */
  .success-glow {
    animation: successGlow 2s ease-out;
  }

  @keyframes successGlow {
    0% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
    }
    50% {
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.8);
    }
    100% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
    }
  }
</style>
