<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import { onDestroy } from 'svelte';

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

  // Optional Contacts
  type Contact = { name: string; number: string; email: string };
  let optionalContacts: Contact[] = [];
  let newContact: Contact = { name: '', number: '', email: '' };

  // Photos
  type PhotoItem = { file: File; url: string };
  let photos: PhotoItem[] = [];
  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

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
  }

  function removePhoto(index: number) {
    const [removed] = photos.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    photos = [...photos];
  }

  onDestroy(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
  });

  function addOptionalContact() {
    if (newContact.name || newContact.number || newContact.email) {
      optionalContacts = [...optionalContacts, { ...newContact }];
      newContact = { name: '', number: '', email: '' };
    }
  }

  function removeOptionalContact(index: number) {
    optionalContacts = optionalContacts.filter((_, i) => i !== index);
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    // Placeholder: integrate submit action later
    console.log({
      machine: {
        locationOfRepair,
        productName,
        clientsWorkOrder,
        makeModel,
        serialNumber,
        siteLocation,
        faultDescription
      },
      user: {
        customerName,
        contactEmail,
        contactNumber,
        optionalContacts
      }
    });
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h1 class="text-xl font-semibold">Create Workshop Job</h1>
    </div>

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
            <label class="block text-sm font-medium text-gray-700 mb-1" for="site-location">Site/Location</label>
            <input id="site-location" type="text" bind:value={siteLocation} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="fault-description">Fault Description</label>
            <textarea id="fault-description" rows="3" bind:value={faultDescription} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>
        </div>

        <!-- Photos -->
        <div class="mt-6">
          <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
            <h3 class="font-medium text-gray-800">Photos</h3>
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
            <input id="customer-name" type="text" bind:value={customerName} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create Job</button>
      </div>
    </form>
  </div>
</div>


