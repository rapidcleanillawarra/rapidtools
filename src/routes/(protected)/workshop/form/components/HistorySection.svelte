<script lang="ts">
  export let history: Array<{ id: string; timestamp: string; user: string; status: string; isCreation?: boolean }>;
</script>

<!-- History Section -->
<div class="grid grid-cols-1 gap-6">
  <div>
    <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-[#181b20] border border-[#262a30]">
      <h2 class="font-semibold text-white">History</h2>
      {#if history.length > 0}
        <span class="text-gray-300 text-xs bg-[#1f2329] border border-[#333842] px-2.5 py-1 rounded-full font-medium">
          {history.length} event{history.length !== 1 ? 's' : ''}
        </span>
      {/if}
    </div>

    <div class="mt-4 space-y-4">
      <!-- History Timeline -->
      {#if history.length > 0}
        <div class="space-y-3">
          {#each history as historyEntry (historyEntry.id)}
            <div class="bg-[#181b20] border border-[#262a30] rounded-xl p-4 shadow-sm">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-[#1f2329] border border-[#333842] rounded-full flex items-center justify-center">
                      <svg class="w-4 h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold {historyEntry.isCreation ? 'bg-lime-950/40 text-lime-400 border border-lime-500/30' : 'bg-blue-950/40 text-blue-300 border border-blue-500/30'} capitalize">
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
                    <div class="text-xs text-gray-400">
                      by <span class="text-gray-300">{historyEntry.user}</span> • {new Date(historyEntry.timestamp).toLocaleDateString('en-US', {
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
        <div class="text-center py-8 bg-[#181b20]/50 border border-[#262a30] rounded-xl">
          <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-300">No history yet</h3>
          <p class="mt-1 text-sm text-gray-500">Job history will appear here as the job progresses through different stages.</p>
        </div>
      {/if}
    </div>
  </div>
</div>
