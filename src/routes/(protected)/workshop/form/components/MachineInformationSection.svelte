<script lang="ts">
  export let isMachineInfoExpanded: boolean;
  export let machineInfoSummaryItems: Array<{ label: string; value: string }>;
  export let currentJobStatus: any;

  export let locationOfMachine: 'Site' | 'Workshop';
  export let action: string;
  export let productName: string;
  export let clientsWorkOrder: string;
  export let makeModel: string;
  export let serialNumber: string;
  export let siteLocation: string;
  export let faultDescription: string;

  export let startedWith: 'form' | 'camera';
  export let scheduleLabel: string;
  export let pickupSchedule: string;
  export let minDateTime: string;
  export let updatePickupSchedule: (value: string) => void;
</script>

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

