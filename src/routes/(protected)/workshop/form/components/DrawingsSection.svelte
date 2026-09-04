<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { FileItem } from '$lib/types/workshop';

  export let drawings: FileItem[] = [];
  export let error: string = '';
  export let workshopStatus: string | null = null;
  export let disabled: boolean = false;

  let uploadInput: HTMLInputElement | null = null;
  let isDragging = false;

  const dispatch = createEventDispatcher<{
    drawingsUpdated: { drawings: FileItem[] };
    error: { message: string };
    drawingClick: { drawingIndex: number };
  }>();

  function triggerUpload() {
    if (disabled) return;
    uploadInput?.click();
  }

  function onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      addFiles(input.files);
      input.value = '';
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled) {
      isDragging = true;
    }
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (disabled) return;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function addFiles(fileList: FileList) {
    const newItems: FileItem[] = [];
    Array.from(fileList).forEach((file) => {
      const url = URL.createObjectURL(file);
      newItems.push({
        file,
        url,
        isExisting: false,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream'
      });
    });

    drawings = [...drawings, ...newItems];
    dispatch('drawingsUpdated', { drawings });
    dispatch('error', { message: '' });
  }

  function removeDrawing(index: number, event: Event) {
    event.stopPropagation();
    const [removed] = drawings.splice(index, 1);
    if (removed && !removed.isExisting) {
      URL.revokeObjectURL(removed.url);
    }
    drawings = [...drawings];
    dispatch('drawingsUpdated', { drawings });
    dispatch('error', { message: '' });
  }

  async function handleDrawingClick(index: number, event: Event) {
    event.stopPropagation();
    const item = drawings[index];
    if (item.url) {
      try {
        const fileName = item.url.split('/storage/v1/object/public/workshop-files/')[1];
        if (fileName) {
          const { supabase } = await import('$lib/supabase');
          const { data, error } = await supabase.storage
            .from('workshop-files')
            .createSignedUrl(fileName, 3600);

          if (error) throw error;
          window.open(data.signedUrl, '_blank');
          return;
        }
      } catch (err) {
        console.error('Failed to create signed URL for drawing:', err);
      }
    }
    dispatch('drawingClick', { drawingIndex: index });
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getDrawingIcon(name: string, type: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'cad'].includes(ext)) return '📐';
    if (type.includes('pdf') || ext === 'pdf') return '📄';
    if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (type.includes('zip') || type.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) return '📦';
    if (type.includes('document') || type.includes('word') || ['doc', 'docx'].includes(ext)) return '📝';
    return '📐';
  }

  onDestroy(() => {
    drawings.forEach((d) => {
      if (!d.isExisting) {
        URL.revokeObjectURL(d.url);
      }
    });
  });
</script>

<div id="drawings-section" class="rounded-xl border border-violet-500/30 bg-violet-950/10 p-5 shadow-sm space-y-4">
  <!-- Header bar -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-violet-500/20">
    <div class="flex items-center gap-2.5">
      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 text-lg border border-violet-500/30">
        📐
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-white tracking-tight">Drawings & Schematics</h3>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-400/15 text-violet-300 border border-violet-500/30">
            Drawing Request
          </span>
        </div>
        <p class="text-xs text-gray-400 mt-0.5">
          Upload technical drawings, schematics, or CAD files ({drawings.length} attached)
        </p>
      </div>
    </div>

    {#if !disabled}
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-violet-900/30 transition-colors"
        on:click={triggerUpload}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
        </svg>
        Upload Drawings
      </button>
    {/if}
  </div>

  <!-- Hidden file input -->
  <input
    id="upload-drawing"
    class="hidden"
    type="file"
    multiple
    accept="image/*,application/pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.doc,.docx,.xls,.xlsx,.zip,.rar"
    bind:this={uploadInput}
    on:change={onFilesSelected}
  />

  <!-- Dropzone / List of drawings -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="relative rounded-xl transition-colors {isDragging ? 'bg-violet-950/40 border-2 border-dashed border-violet-400' : ''}"
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    {#if drawings.length > 0}
      <div class="space-y-2.5">
        {#each drawings as d, i}
          <div class="flex items-center justify-between p-3 bg-[#181b20] border border-[#262a30] hover:border-violet-500/40 rounded-xl transition-colors group">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xl border border-violet-500/20">
                {getDrawingIcon(d.name, d.type)}
              </div>
              <div class="flex-1 min-w-0">
                <button
                  type="button"
                  class="text-left w-full hover:text-violet-300 transition-colors"
                  on:click={(e) => handleDrawingClick(i, e)}
                  aria-label="View drawing {d.name}"
                >
                  <div class="font-medium text-gray-200 truncate group-hover:text-violet-300">{d.name}</div>
                  <div class="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                    <span>{d.size > 0 ? formatFileSize(d.size) : 'Saved in storage'}</span>
                    <span>•</span>
                    <span class="text-violet-400 hover:underline">Click to view/download</span>
                  </div>
                </button>
              </div>
            </div>

            {#if !disabled}
              <button
                type="button"
                class="ml-3 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors flex-shrink-0"
                aria-label="Remove drawing"
                on:click={(e) => removeDrawing(i, e)}
                title="Remove drawing"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Add more button drop area -->
      {#if !disabled}
        <button
          type="button"
          on:click={triggerUpload}
          class="mt-3 w-full py-2 px-3 border border-dashed border-violet-500/30 hover:border-violet-500/60 rounded-lg text-xs text-violet-300 hover:text-violet-200 text-center transition-colors bg-violet-950/20"
        >
          + Add more drawing files (or drag and drop here)
        </button>
      {/if}
    {:else}
      <!-- Empty state -->
      <div
        class="py-8 px-4 bg-[#181b20]/60 border-2 border-dashed border-violet-500/30 rounded-xl text-center cursor-pointer hover:border-violet-400/60 hover:bg-violet-950/20 transition-all"
        on:click={triggerUpload}
        role="button"
        tabindex="0"
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerUpload(); } }}
      >
        <div class="flex justify-center mb-2">
          <div class="h-12 w-12 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-2xl text-violet-400">
            📐
          </div>
        </div>
        <p class="text-sm font-semibold text-gray-200">No drawings uploaded yet</p>
        <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          Click here or drag and drop drawings (PDF, DWG, DXF, images, CAD files) to attach them to this drawing request.
        </p>
      </div>
    {/if}
  </div>

  {#if error}
    <div class="p-3 bg-red-950/30 border border-red-500/30 text-red-300 rounded-lg text-sm">
      {error}
    </div>
  {/if}
</div>
