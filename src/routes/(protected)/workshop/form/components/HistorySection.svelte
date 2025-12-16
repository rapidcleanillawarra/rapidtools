<script lang="ts">
  export let history: Array<{ id: string; timestamp: string; user: string; status: string; isCreation?: boolean }>;
</script>

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
