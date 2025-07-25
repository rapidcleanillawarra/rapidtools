<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Schedule, ScheduleFormData, Contact, LocationInfo, Note } from './types';
  import { generateId, getMonthName, validateSchedule, getAvailableColors, DEFAULT_COLOR } from './utils';
  import { schedulesStore } from '../stores';

  export let schedule: ScheduleFormData | null = null;
  export let mode: 'create' | 'edit' | 'view' = 'view';
  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    save: ScheduleFormData;
    delete: string;
    close: void;
  }>();

  let formData: ScheduleFormData;
  let errors: any = {};
  let showColorDropdown = false;

  // Get available colors excluding currently used ones
  $: availableColors = getAvailableColors($schedulesStore, formData?.color, mode === 'create');

  // Debug logging for props
  $: {
    if (isOpen && mode === 'create') {
      console.log('=== MODAL OPENED IN CREATE MODE ===');
    }
  }

  $: if (schedule) {
    formData = {
      ...schedule,
      information: schedule.information?.map(info => ({
        ...info,
        contacts: [...(info.contacts || [])]
      })) || [],
      notes: [...(schedule.notes || [])]
    };
  }

  function handleSubmit() {
    if (mode === 'view') return;
    
    console.log('=== SUBMIT BUTTON CLICKED ===');
    console.log('Mode:', mode);
    console.log('Form data:', formData);
    
    errors = validateSchedule(formData);
    
    if (Object.keys(errors).length === 0) {
      console.log('Validation passed - dispatching save');
      dispatch('save', formData);
    } else {
      console.log('Validation failed:', errors);
    }
  }

  function handleDelete() {
    if (formData.id) {
      dispatch('delete', formData.id);
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function addLocation() {
    formData.information = [
      ...formData.information,
      {
        information_id: generateId(),
        sub_company_name: '',
        location: '',
        contacts: []
      }
    ];
  }

  function removeLocation(index: number) {
    formData.information = formData.information.filter((_, i) => i !== index);
  }

  function addContact(locationIndex: number) {
    formData.information[locationIndex].contacts = [
      ...formData.information[locationIndex].contacts,
      { name: '', phone: '', email: '' }
    ];
  }

  function removeContact(locationIndex: number, contactIndex: number) {
    formData.information[locationIndex].contacts = 
      formData.information[locationIndex].contacts.filter((_, i) => i !== contactIndex);
  }

  function addNote() {
    formData.notes = [...formData.notes, { title: '', content: '' }];
  }

  function removeNote(index: number) {
    formData.notes = formData.notes.filter((_, i) => i !== index);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showColorDropdown) {
        showColorDropdown = false;
      } else {
        handleClose();
      }
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.color-dropdown-container')) {
      showColorDropdown = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} on:click={handleClickOutside} />

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex justify-between items-center p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">
          {mode === 'create' ? 'Add New Company' : mode === 'edit' ? 'Edit Company' : 'View Company'}
        </h2>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Form -->
      <form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
        <!-- Basic Information -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label for="company" class="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              id="company"
              type="text"
              bind:value={formData.company}
              disabled={mode === 'view'}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              class:border-red-500={errors.company}
            />
            {#if errors.company}
              <p class="text-red-500 text-sm mt-1">{errors.company}</p>
            {/if}
          </div>

          <div>
            <label for="start_month" class="block text-sm font-medium text-gray-700 mb-1">
              Start Month *
            </label>
            <select
              id="start_month"
              bind:value={formData.start_month}
              disabled={mode === 'view'}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              class:border-red-500={errors.start_month}
            >
              {#each Array.from({length: 12}, (_, i) => i + 1) as month}
                <option value={month}>{getMonthName(month)}</option>
              {/each}
            </select>
            {#if errors.start_month}
              <p class="text-red-500 text-sm mt-1">{errors.start_month}</p>
            {/if}
          </div>

          <div>
            <label for="occurence" class="block text-sm font-medium text-gray-700 mb-1">
              Occurrence (months) *
            </label>
            <input
              id="occurence"
              type="number"
              min="1"
              max="12"
              bind:value={formData.occurence}
              disabled={mode === 'view'}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              class:border-red-500={errors.occurence}
            />
            {#if errors.occurence}
              <p class="text-red-500 text-sm mt-1">{errors.occurence}</p>
            {/if}
          </div>

          <div>
            <label for="color" class="block text-sm font-medium text-gray-700 mb-1">
              Color *
            </label>
            <div class="relative color-dropdown-container">
              <button
                type="button"
                on:click={() => showColorDropdown = !showColorDropdown}
                disabled={mode === 'view' || availableColors.length === 0}
                class="w-full px-3 py-2 pl-10 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-left flex items-center justify-between"
                class:border-red-500={errors.color}
                class:opacity-50={availableColors.length === 0}
              >
                <div class="flex items-center gap-2">
                  <div 
                    class="w-4 h-4 rounded-full border border-gray-300"
                    style="background-color: {formData.color || DEFAULT_COLOR};"
                  ></div>
                  <span>{formData.color || DEFAULT_COLOR}</span>
                  {#if availableColors.length === 0}
                    <span class="text-xs text-gray-500">(All colors used)</span>
                  {/if}
                </div>
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {#if showColorDropdown && mode !== 'view'}
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {#if availableColors.length > 0}
                    {#each availableColors as color}
                      <button
                        type="button"
                        on:click={() => {
                          formData.color = color;
                          showColorDropdown = false;
                        }}
                        class="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                      >
                        <div 
                          class="w-4 h-4 rounded-full border border-gray-300"
                          style="background-color: {color};"
                        ></div>
                        <span class="font-mono text-sm">{color}</span>
                      </button>
                    {/each}
                  {:else}
                    <div class="px-3 py-2 text-sm text-gray-500 text-center">
                      All colors are currently in use
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
            {#if errors.color}
              <p class="text-red-500 text-sm mt-1">{errors.color}</p>
            {/if}
            {#if availableColors.length === 0 && mode !== 'view'}
              <p class="text-amber-600 text-sm mt-1 flex items-center">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                All colors are currently in use. You may need to delete some companies or edit existing ones to free up colors.
              </p>
            {/if}
          </div>
        </div>

        <!-- Locations -->
        <div>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Locations & Contacts</h3>
            {#if mode !== 'view'}
              <button
                type="button"
                on:click={addLocation}
                class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Add Location
              </button>
            {/if}
          </div>
          
          {#if errors.information_required}
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p class="text-red-600 text-sm">{errors.information_required}</p>
            </div>
          {/if}

          {#each formData.information as location, locationIndex}
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
              <div class="flex justify-between items-start mb-4">
                <h4 class="text-md font-medium text-gray-800">Location {locationIndex + 1}</h4>
                {#if mode !== 'view'}
                  <button
                    type="button"
                    on:click={() => removeLocation(locationIndex)}
                    class="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                {/if}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Sub-company Name *
                  </label>
                  <input
                    type="text"
                    bind:value={location.sub_company_name}
                    disabled={mode === 'view'}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    bind:value={location.location}
                    disabled={mode === 'view'}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <!-- Contacts -->
              <div>
                <div class="flex justify-between items-center mb-2">
                  <h5 class="text-sm font-medium text-gray-700">Contacts</h5>
                  {#if mode !== 'view'}
                    <button
                      type="button"
                      on:click={() => addContact(locationIndex)}
                      class="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Add Contact
                    </button>
                  {/if}
                </div>

                {#each location.contacts as contact, contactIndex}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Name *"
                        bind:value={contact.name}
                        disabled={mode === 'view'}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Phone"
                        bind:value={contact.phone}
                        disabled={mode === 'view'}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div class="flex gap-2">
                      <input
                        type="email"
                        placeholder="Email"
                        bind:value={contact.email}
                        disabled={mode === 'view'}
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      {#if mode !== 'view'}
                        <button
                          type="button"
                          on:click={() => removeContact(locationIndex, contactIndex)}
                          class="text-red-600 hover:text-red-800 px-2"
                        >
                          ×
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <!-- Notes -->
        <div>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Notes</h3>
            {#if mode !== 'view'}
              <button
                type="button"
                on:click={addNote}
                class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Add Note
              </button>
            {/if}
          </div>

          {#each formData.notes as note, noteIndex}
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
              <div class="flex justify-between items-start mb-3">
                <input
                  type="text"
                  placeholder="Note Title *"
                  bind:value={note.title}
                  disabled={mode === 'view'}
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 mr-2"
                />
                {#if mode !== 'view'}
                  <button
                    type="button"
                    on:click={() => removeNote(noteIndex)}
                    class="text-red-600 hover:text-red-800 px-2"
                  >
                    ×
                  </button>
                {/if}
              </div>
              <textarea
                placeholder="Note Content *"
                bind:value={note.content}
                disabled={mode === 'view'}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              ></textarea>
            </div>
          {/each}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-6 border-t">
          <button
            type="button"
            on:click={handleClose}
            class="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          
          {#if mode === 'edit' && formData.id}
            <button
              type="button"
              on:click={handleDelete}
              class="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Delete
            </button>
          {/if}
          
          {#if mode !== 'view'}
            <button
              type="submit"
              class="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </button>
          {/if}
        </div>
      </form>
    </div>
  </div>
{/if} 