<script lang="ts">
  import WorkshopCard from './WorkshopCard.svelte';
  import type { WorkshopRecord } from '$lib/services/workshop';
  import { createEventDispatcher } from 'svelte';

  interface Props {
    status: string;
    title: string;
    workshops?: WorkshopRecord[];
    draggedWorkshopId?: string | null;
    recentlyMovedWorkshopId?: string | null;
    showImages?: boolean;
  }

  let {
    status,
    title,
    workshops = [],
    draggedWorkshopId = null,
    recentlyMovedWorkshopId = null,
    showImages = true
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    drop: { workshopId: string; newStatus: string };
    completed: { workshop: WorkshopRecord };
  }>();

  let isDragOver = $state(false);

  function getTopBorderColor(status: string) {
    switch (status) {
      case 'new': return 'border-t-2 border-t-yellow-400';
      case 'pickup': return 'border-t-2 border-t-sky-400';
      case 'to_be_quoted': return 'border-t-2 border-t-orange-400';
      case 'docket_ready': return 'border-t-2 border-t-blue-400';
      case 'quoted': return 'border-t-2 border-t-green-400';
      case 'waiting_approval_po': return 'border-t-2 border-t-purple-400';
      case 'waiting_for_parts': return 'border-t-2 border-t-amber-400';
      case 'booked_in_for_repair_service': return 'border-t-2 border-t-indigo-400';
      case 'repaired': return 'border-t-2 border-t-teal-400';
      case 'pickup_from_workshop': return 'border-t-2 border-t-cyan-400';
      case 'return': return 'border-t-2 border-t-lime-400';
      case 'pending_jobs': return 'border-t-2 border-t-red-400';
      case 'warranty_claim': return 'border-t-2 border-t-rose-400';
      case 'drawing_request': return 'border-t-2 border-t-violet-400';
      default: return 'border-t-2 border-t-gray-500';
    }
  }

  function getBadgeColor(status: string) {
    switch (status) {
      case 'new': return 'bg-yellow-400/10 text-yellow-400';
      case 'pickup': return 'bg-sky-400/10 text-sky-400';
      case 'to_be_quoted': return 'bg-orange-400/10 text-orange-400';
      case 'docket_ready': return 'bg-blue-400/10 text-blue-400';
      case 'quoted': return 'bg-green-400/10 text-green-400';
      case 'waiting_approval_po': return 'bg-purple-400/10 text-purple-400';
      case 'waiting_for_parts': return 'bg-amber-400/10 text-amber-400';
      case 'booked_in_for_repair_service': return 'bg-indigo-400/10 text-indigo-400';
      case 'repaired': return 'bg-teal-400/10 text-teal-400';
      case 'pickup_from_workshop': return 'bg-cyan-400/10 text-cyan-400';
      case 'return': return 'bg-lime-400/10 text-lime-400';
      case 'pending_jobs': return 'bg-red-400/10 text-red-400';
      case 'warranty_claim': return 'bg-rose-400/10 text-rose-400';
      case 'drawing_request': return 'bg-violet-400/10 text-violet-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    console.log('[COLUMN_DRAG_ENTER] Column:', status, 'Timestamp:', Date.now());
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    // Only set isDragOver to false if we're actually leaving the column (not entering a child element)
    if (event.currentTarget === event.target) {
      console.log('[COLUMN_DRAG_LEAVE] Column:', status, 'Timestamp:', Date.now());
      isDragOver = false;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    console.log('[COLUMN_DROP] Column:', status, 'Timestamp:', Date.now());
    isDragOver = false;

    try {
      const rawData = event.dataTransfer!.getData('application/json');
      console.log('[COLUMN_DROP_DATA] Raw data:', rawData);
      const data = JSON.parse(rawData);
      console.log('[COLUMN_DROP_PARSED] Parsed data:', data);

      if (data.workshopId && data.currentStatus !== status) {
        console.log('[COLUMN_DROP_DISPATCH] Dispatching drop event - Workshop:', data.workshopId, 'From:', data.currentStatus, 'To:', status);
        dispatch('drop', {
          workshopId: data.workshopId,
          newStatus: status
        });
      } else {
        console.log('[COLUMN_DROP_SKIP] Drop skipped - Workshop:', data.workshopId, 'Same status:', data.currentStatus === status);
      }
    } catch (error) {
      console.error('[COLUMN_DROP_ERROR] Error parsing drag data:', error, 'Raw data:', event.dataTransfer!.getData('application/json'));
    }
  }
  function formatSydneyDateTime(iso: string | null | undefined): string {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return iso;
    }
  }

  function downloadTextFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function generateToBeQuotedText(records: WorkshopRecord[]): string {
    const generatedAt = formatSydneyDateTime(new Date().toISOString());
    const separator = '='.repeat(80);
    const subSeparator = '-'.repeat(80);

    const header = [
      separator,
      '                     WORKSHOP DATA - TO BE QUOTED',
      separator,
      `Generated: ${generatedAt} (Australia/Sydney)`,
      `Total Records: ${records.length}`,
      separator,
      ''
    ].join('\n');

    if (records.length === 0) {
      return header + '\nNo workshops currently in "To be Quoted" status.\n';
    }

    const recordsText = records.map((w, index) => {
      const lines: string[] = [];
      const recordTitle = `RECORD #${index + 1}: ${w.order_id ? `Order #${w.order_id}` : (w.product_name || 'Workshop Job')} - ${w.customer_name || 'Unknown Customer'}`;
      lines.push(subSeparator);
      lines.push(recordTitle);
      lines.push(subSeparator);

      lines.push(`Order ID:            ${w.order_id || 'N/A'}`);
      lines.push(`Client's Work Order: ${w.clients_work_order || 'N/A'}`);
      lines.push(`Status:              ${w.status}`);
      lines.push(`Customer Name:       ${w.customer_name || 'N/A'}`);

      const company = w.customer_data?.BillingAddress?.BillCompany;
      if (company) {
        lines.push(`Company:             ${company}`);
      }

      const phone = w.contact_number || w.customer_data?.BillingAddress?.BillPhone;
      lines.push(`Contact Phone:       ${phone || 'N/A'}`);

      const email = w.contact_email || w.customer_data?.EmailAddress;
      lines.push(`Contact Email:       ${email || 'N/A'}`);

      if (w.optional_contacts && Array.isArray(w.optional_contacts) && w.optional_contacts.length > 0) {
        lines.push('Optional Contacts:');
        for (const contact of w.optional_contacts) {
          const parts = [contact.name, contact.number, contact.email].filter(Boolean);
          lines.push(`  - ${parts.join(' | ') || 'N/A'}`);
        }
      }

      lines.push('');
      lines.push(`Product Name:        ${w.product_name || 'N/A'}`);
      lines.push(`Make / Model:        ${w.make_model || 'N/A'}`);
      lines.push(`Serial Number:       ${w.serial_number || 'N/A'}`);
      lines.push(`Machine Location:    ${w.location_of_machine || 'N/A'}`);
      lines.push(`Site Location:       ${w.site_location || 'N/A'}`);
      lines.push(`Fault Description:   ${w.fault_description || 'N/A'}`);

      lines.push('');
      lines.push(`Assigned Tech:       ${w.assigned_tech_name || 'None'}`);
      if (w.tech_job_type) {
        lines.push(`Tech Job Type:       ${w.tech_job_type}`);
      }
      if (w.tech_schedule) {
        lines.push(`Tech Schedule:       ${formatSydneyDateTime(w.tech_schedule)}`);
      }

      lines.push('');
      lines.push(`Created At:          ${formatSydneyDateTime(w.created_at)}`);
      if (w.created_by) {
        lines.push(`Created By:          ${w.created_by}`);
      }

      if (w.docket_info) {
        lines.push('');
        lines.push('Docket Info:');
        if (typeof w.docket_info === 'string') {
          lines.push(`  ${w.docket_info}`);
        } else {
          lines.push(`  ${JSON.stringify(w.docket_info, null, 2).replace(/\n/g, '\n  ')}`);
        }
      }

      if (w.comments && Array.isArray(w.comments) && w.comments.length > 0) {
        lines.push('');
        lines.push('Comments:');
        for (const comment of w.comments) {
          const time = formatSydneyDateTime(comment.created_at);
          lines.push(`  - [${time}] ${comment.author || 'Unknown'}: ${comment.text || ''}`);
        }
      }

      if (w.photo_urls && Array.isArray(w.photo_urls) && w.photo_urls.length > 0) {
        lines.push('');
        lines.push(`Photos (${w.photo_urls.length}):`);
        for (const url of w.photo_urls) {
          lines.push(`  - ${url}`);
        }
      }

      lines.push('');
      return lines.join('\n');
    }).join('\n');

    return header + recordsText;
  }

  function handleGetInfo(event: MouseEvent) {
    event.stopPropagation();
    const textContent = generateToBeQuotedText(workshops);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadTextFile(textContent, `to_be_quoted_workshops_${dateStr}.txt`);
  }
</script>

<div
  class="{getTopBorderColor(status)} {isDragOver ? 'bg-[#1f2329] border-lime-500/50 ring-2 ring-lime-500/20' : 'bg-[#181b20] border-[#262a30]'} rounded-lg border snap-start flex flex-col w-72 flex-shrink-0 min-h-96 max-h-[70vh] transition-all duration-200"
  role="region"
  aria-label="{title} status column"
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <!-- Header - Fixed, non-scrollable -->
  <div class="flex items-center justify-between p-4 pb-3 border-b border-[#262a30] flex-shrink-0 gap-2">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <h3 class="text-xs font-semibold text-gray-300 uppercase tracking-wider truncate">{title}</h3>
      {#if status === 'to_be_quoted'}
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border border-[#333842] bg-[#1f2329] text-gray-300 hover:text-white hover:bg-[#262a30] hover:border-lime-500/50 transition-colors shadow-sm shrink-0"
          onclick={handleGetInfo}
          title="Download column data as text file"
          aria-label="Download to be quoted column data as text file"
        >
          <svg class="w-3 h-3 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Get Info
        </button>
      {/if}
    </div>
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getBadgeColor(status)} shrink-0">
      {workshops.length}
    </span>
  </div>

  <!-- Content - Scrollable -->
  <div class="flex-1 overflow-y-auto p-4 pt-3 status-column-scroll">
    {#if workshops.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <svg class="w-12 h-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm text-gray-600">No workshops in this status</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each workshops as workshop (workshop.id)}
          <WorkshopCard
            {workshop}
            viewMode="board"
            {draggedWorkshopId}
            {recentlyMovedWorkshopId}
            {showImages}
            on:click
            on:photoClick
            on:deleteClick
            on:dragstart
            on:completed
            on:assignTech
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Custom vertical scrollbar styles for StatusColumn */
  :global(.status-column-scroll::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.status-column-scroll::-webkit-scrollbar-track) {
    background: #141619;
    border-radius: 3px;
  }

  :global(.status-column-scroll::-webkit-scrollbar-thumb) {
    background: #262a30;
    border-radius: 3px;
    transition: background-color 0.2s ease;
  }

  :global(.status-column-scroll::-webkit-scrollbar-thumb:hover) {
    background: #333842;
  }

  /* Firefox scrollbar styling */
  :global(.status-column-scroll) {
    scrollbar-width: thin;
    scrollbar-color: #262a30 #141619;
  }
</style>
