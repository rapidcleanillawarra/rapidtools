<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import { onDestroy } from 'svelte';
  import CustomerDropdown from '$lib/components/CustomerDropdown.svelte';
  import type { Customer } from '$lib/services/customers';
  import { getCustomerDisplayName } from '$lib/services/customers';
  import { createWorkshop, getPhotoStatistics, cleanupOrphanedPhotos } from '$lib/services/workshop';
  import { page } from '$app/stores';

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
  type Contact = { name: string; number: string; email: string };
  let optionalContacts: Contact[] = [];
  let newContact: Contact = { name: '', number: '', email: '' };
  let contactError = '';

  // Photos
  type PhotoItem = { file: File; url: string };
  let photos: PhotoItem[] = [];
  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;
  let photoError = '';
  const MIN_PHOTOS_REQUIRED = 2;

  // Validation errors
  let siteLocationError = '';

  // Form submission state
  let isSubmitting = false;
  let submitError = '';
  let submitSuccess = false;

  // Determine entry point
  let startedWith: 'form' | 'camera' = 'form';

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
  }

  // Clear site location error when location changes or site location is entered
  $: if (locationOfRepair !== 'Site') {
    siteLocationError = '';
  }
  $: if (siteLocation.trim()) {
    siteLocationError = '';
  }

  function triggerTakePhoto() {
    takePhotoInput?.click();
  }

  function triggerUploadPhoto() {
    uploadPhotoInput?.click();
  }

  function onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      addFiles(input.files);
      // Reset to allow selecting the same file again
      input.value = '';
    }
  }

  function addFiles(fileList: FileList) {
    const newItems: PhotoItem[] = [];
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      newItems.push({ file, url });
    });
    photos = [...photos, ...newItems];
    // Clear photo error when photos are added
    photoError = '';
  }

  function removePhoto(index: number) {
    const [removed] = photos.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    photos = [...photos];
    // Update photo error if below minimum
    if (photos.length < MIN_PHOTOS_REQUIRED) {
      photoError = `At least ${MIN_PHOTOS_REQUIRED} photos are required`;
    } else {
      photoError = '';
    }
  }

  onDestroy(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
  });

  function addOptionalContact() {
    // Trim all inputs
    const trimmedName = newContact.name.trim();
    const trimmedNumber = newContact.number.trim();
    const trimmedEmail = newContact.email.trim();

    // Clear previous error
    contactError = '';

    // Validate: require name and at least one contact method
    if (!trimmedName) {
      contactError = 'Name is required';
      return;
    }

    if (!trimmedNumber && !trimmedEmail) {
      contactError = 'At least one contact method (number or email) is required';
      return;
    }

    // Check for duplicate contacts
    const isDuplicate = optionalContacts.some(contact =>
      contact.name.toLowerCase() === trimmedName.toLowerCase() &&
      (contact.number === trimmedNumber || contact.email.toLowerCase() === trimmedEmail.toLowerCase())
    );

    if (isDuplicate) {
      contactError = 'This contact already exists';
      return;
    }

    // Add the contact 
    optionalContacts = [...optionalContacts, {
      name: trimmedName,
      number: trimmedNumber,
      email: trimmedEmail
    }];

    // Reset form
    newContact = { name: '', number: '', email: '' };
  }

  function removeOptionalContact(index: number) {
    optionalContacts = optionalContacts.filter((_, i) => i !== index);
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

  function handleSubmit(event: Event) {
    event.preventDefault();

    // Reset previous states
    submitError = '';
    submitSuccess = false;

    // Optional: Validate site location when location is 'Site' and field is not empty
    // Only show error if user has entered something but it's just whitespace
    if (locationOfRepair === 'Site' && siteLocation && !siteLocation.trim()) {
      siteLocationError = 'Please enter a valid site location or leave empty';
      // Scroll to site location field
      document.getElementById('site-location')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Validate photo requirement
    if (photos.length < MIN_PHOTOS_REQUIRED) {
      photoError = `At least ${MIN_PHOTOS_REQUIRED} photos are required`;
      // Scroll to photos section
      document.getElementById('photos-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Clear any existing errors
    siteLocationError = '';
    photoError = '';

    // Start submission
    isSubmitting = true;

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
      optionalContacts,
      photos: photos.map(p => p.file),
      startedWith
    };

    // Submit to Supabase
    createWorkshop(formData)
      .then((workshop) => {
        console.log('Workshop created successfully:', workshop);
        console.log('Started with:', startedWith);
        submitSuccess = true;
        // Reset form after successful submission
        resetForm();
      })
      .catch((error) => {
        console.error('Error creating workshop:', error);
        submitError = error.message || 'Failed to create workshop. Please try again.';
      })
      .finally(() => {
        isSubmitting = false;
      });
  }

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
    newContact = { name: '', number: '', email: '' };

    // Clear photos
    photos.forEach(p => URL.revokeObjectURL(p.url));
    photos = [];

    // Clear errors
    siteLocationError = '';
    photoError = '';
    contactError = '';
  }
</script>

  <div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Create Workshop Job</h1>
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
        ✅ Workshop created successfully! The form has been reset.
      </div>
    {/if}

    {#if submitError}
      <div class="mx-6 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        ❌ {submitError}
      </div>
    {/if}

    <form class="p-6 space-y-8" on:submit|preventDefault={handleSubmit}>
      <!-- Machine Information -->
      <div>
        <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
          <h2 class="font-medium text-gray-800">Machine Information</h2>
        </div>

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
            <label class="block text-sm font-medium text-gray-700 mb-1" for="product-name">Product Name</label>
            <input id="product-name" type="text" bind:value={productName} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

        <!-- Photos -->
        <div class="mt-6" id="photos-section">
          <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
            <h3 class="font-medium text-gray-800">
              Photos
              <span class="text-sm text-gray-600 ml-2">
                ({photos.length}/{MIN_PHOTOS_REQUIRED} required)
              </span>
            </h3>
            <div class="flex gap-2">
              <button type="button" class="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" on:click={triggerTakePhoto}>Take Photo</button>
              <button type="button" class="px-3 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800" on:click={triggerUploadPhoto}>Upload</button>
            </div>
          </div>
          <!-- Hidden inputs for capture/upload -->
          <input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
          <input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

          {#if photos.length > 0}
            <div class="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {#each photos as p, i}
                <div class="relative group">
                  <img src={p.url} alt="" class="w-full h-24 sm:h-28 object-cover rounded-md border" />
                  <button type="button" class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-90 group-hover:opacity-100" aria-label="Remove photo" on:click={() => removePhoto(i)}>×</button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md text-center">
              <p class="text-gray-500 text-sm">No photos added yet</p>
              <p class="text-gray-400 text-xs mt-1">Use the buttons above to take photos or upload images</p>
            </div>
          {/if}

          {#if photoError}
            <div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {photoError}
            </div>
          {/if}
        </div>
      </div>

      <!-- User Information -->
      <div>
        <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
          <h2 class="font-medium text-gray-800">User Information</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="customer-name">Customer Name (Maropost)</label>
            <CustomerDropdown
              id="customer-name"
              bind:value={customerName}
              placeholder="Search customers..."
              on:select={handleCustomerSelect}
              on:clear={handleCustomerClear}
            />

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
      </div>

      <!-- Optional Contacts -->
      <div>
        <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
          <h2 class="font-medium text-gray-800">Optional Contacts</h2>
          <button type="button" class="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600" on:click={addOptionalContact}>Add</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 items-end">
          <div class="md:col-span-4">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="opt-name">Name</label>
            <input id="opt-name" type="text" bind:value={newContact.name} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="md:col-span-4">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="opt-number">Number</label>
            <input id="opt-number" type="text" bind:value={newContact.number} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="md:col-span-4">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="opt-email">Email</label>
            <input id="opt-email" type="email" bind:value={newContact.email} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {#if contactError}
          <div class="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {contactError}
          </div>
        {/if}

        {#if optionalContacts.length > 0}
          <div class="mt-4">
            <div class="overflow-hidden border border-gray-200 rounded">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th class="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each optionalContacts as contact, i}
                    <tr>
                      <td class="px-4 py-3 text-sm text-gray-900">{contact.name}</td>
                      <td class="px-4 py-3 text-sm text-gray-900">{contact.number}</td>
                      <td class="px-4 py-3 text-sm text-gray-900">{contact.email}</td>
                      <td class="px-4 py-3 text-right">
                        <button type="button" class="text-red-600 hover:text-red-800 text-sm" on:click={() => removeOptionalContact(i)}>Remove</button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-end gap-3">
        <a href="{base}/workshop" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</a>
        <button
          type="submit"
          disabled={isSubmitting}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if isSubmitting}
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating...
          {:else}
            Create Job
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>


