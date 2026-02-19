<script lang="ts">
  /** Shown when workshop status is pickup or return. Assign a person and set schedule. */
  export let workshopStatus: string | null;
  export let assignedTo: string = '';
  export let assignedToName: string = '';
  /** Schedule as ISO string (timestamptz). Bound to parent. */
  export let schedule: string = '';
  export let canEdit: boolean = true;
  export let minDateTime: string = '';

  $: scheduleLabel =
    workshopStatus === 'return' ? 'Return schedule' : 'Pickup schedule';
  $: sectionTitle =
    workshopStatus === 'return' ? 'Transport (return)' : 'Transport (pickup)';

  // datetime-local uses YYYY-MM-DDTHH:mm (no seconds, no Z)
  function isoToDatetimeLocal(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}`;
    } catch {
      return '';
    }
  }

  function datetimeLocalToIso(local: string): string {
    if (!local) return '';
    try {
      const d = new Date(local);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch {
      return '';
    }
  }

  $: scheduleLocal = schedule ? isoToDatetimeLocal(schedule) : '';

  function handleScheduleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    schedule = datetimeLocalToIso(value);
  }
</script>

{#if workshopStatus === 'pickup' || workshopStatus === 'return'}
  <div class="transport-section">
    <div
      class="flex items-center justify-between px-4 py-3 rounded"
      style="background-color: rgb(30, 30, 30);"
    >
      <h2 class="font-medium text-white">{sectionTitle}</h2>
    </div>

    <div class="space-y-4 bg-gray-50 border border-gray-200 border-t-0 px-4 py-3 rounded">
      <p class="text-sm text-gray-600">
        Assign a person for this transport and set the scheduled date and time.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="transport-assigned-email">
            Assigned to (email)
          </label>
          <input
            id="transport-assigned-email"
            type="email"
            bind:value={assignedTo}
            class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="e.g. mario@rapidcleanillawarra.com.au"
            disabled={!canEdit}
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="transport-assigned-name">
            Assigned to (name)
          </label>
          <input
            id="transport-assigned-name"
            type="text"
            bind:value={assignedToName}
            class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="e.g. Mario Gomes"
            disabled={!canEdit}
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="transport-schedule">
          {scheduleLabel}
        </label>
        <input
          id="transport-schedule"
          type="datetime-local"
          value={scheduleLocal}
          on:input={handleScheduleInput}
          min={minDateTime}
          class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Select date and time"
          disabled={!canEdit}
        />
      </div>
    </div>
  </div>
{/if}
