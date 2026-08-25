<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { FileItem } from '$lib/types/workshop';

  export let files: FileItem[] = [];
  export let error: string = '';
  export let minFilesRequired: number = 0;
  export let workshopStatus: string | null = null;

  let uploadFileInput: HTMLInputElement | null = null;

  const dispatch = createEventDispatcher<{
    filesUpdated: { files: FileItem[] };
    error: { message: string };
    fileClick: { fileIndex: number };
  }>();

  function triggerUploadFile() {
    uploadFileInput?.click();
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
    const newItems: FileItem[] = [];
    Array.from(fileList).forEach((file) => {
      const url = URL.createObjectURL(file);
      newItems.push({
        file,
        url,
        isExisting: false,
        name: file.name,
        size: file.size,
        type: file.type
      });
    });
    files = [...files, ...newItems];
    console.log('Added new files:', newItems.length, 'Total files:', files.length);
    dispatch('filesUpdated', { files });
    dispatch('error', { message: '' });
  }

  function removeFile(index: number) {
    const [removed] = files.splice(index, 1);
    if (removed && !removed.isExisting) {
      // Only revoke URLs for new files created with URL.createObjectURL
      URL.revokeObjectURL(removed.url);
    }
    files = [...files];
    dispatch('filesUpdated', { files });
    dispatch('error', { message: '' });
  }

  async function handleFileClick(index: number, event: Event) {
    event.stopPropagation(); // Prevent event bubbling

    const file = files[index];
    if (file.url) {
      // For private buckets, get a signed URL
      try {
        const fileName = file.url.split('/storage/v1/object/public/workshop-files/')[1];
        if (fileName) {
          const { data, error } = await import('$lib/supabase').then(m => m.supabase.storage
            .from('workshop-files')
            .createSignedUrl(fileName, 3600)); // 1 hour expiry

          if (error) throw error;
          window.open(data.signedUrl, '_blank');
          return;
        }
      } catch (error) {
        console.error('Failed to create signed URL:', error);
      }
    }

    // Fallback to direct URL
    dispatch('fileClick', { fileIndex: index });
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getFileIcon(type: string): string {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('document') || type.includes('word')) return '📝';
    if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📊';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📄';
  }

  onDestroy(() => {
    files.forEach((f) => {
      if (!f.isExisting) {
        // Only revoke URLs for new files created with URL.createObjectURL
        URL.revokeObjectURL(f.url);
      }
    });
  });

  // Reactive statement to update error when files change
  $: if (files.length < minFilesRequired) {
    dispatch('error', { message: `At least ${minFilesRequired} file(s) required` });
  } else {
    dispatch('error', { message: '' });
  }
</script>

<div id="files-section">
  <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-[#181b20] border border-[#262a30]">
    <h3 class="font-semibold text-white">
      Files
      <span class="text-sm text-gray-400 ml-2">
        ({files.length} uploaded) <span class="text-gray-500">(optional)</span>
      </span>
    </h3>
    {#if workshopStatus !== 'pickup'}
      <div class="flex gap-2">
        <button type="button" class="btn-primary text-xs sm:text-sm px-3 py-1.5" on:click={triggerUploadFile}>Upload Files</button>
      </div>
    {/if}
  </div>

  <!-- Hidden input for file upload -->
  <input id="upload-file" class="hidden" type="file" multiple bind:this={uploadFileInput} on:change={onFilesSelected} />

  {#if files.length > 0}
    <div class="mt-4 space-y-3">
      {#each files as f, i}
        <div class="flex items-center justify-between p-3.5 bg-[#181b20] border border-[#262a30] rounded-xl hover:border-[#333842] transition-colors">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="text-2xl">{getFileIcon(f.type)}</div>
            <div class="flex-1 min-w-0">
              <button
                type="button"
                class="text-left w-full hover:text-lime-400 transition-colors"
                on:click={(e) => handleFileClick(i, e)}
                aria-label="View file {f.name}"
              >
                <div class="font-medium text-gray-200 truncate">{f.name}</div>
                <div class="text-xs text-gray-400 mt-0.5">{formatFileSize(f.size)} • {f.type || 'Unknown type'}</div>
              </button>
            </div>
          </div>
          {#if workshopStatus !== 'pickup'}
            <button
              type="button"
              class="ml-2 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
              aria-label="Remove file"
              on:click={() => removeFile(i)}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="mt-4 p-8 bg-[#181b20]/50 border-2 border-dashed border-[#262a30] rounded-xl text-center">
      <div class="text-gray-500 mb-2">
        <svg class="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
        </svg>
      </div>
      <p class="text-gray-300 text-sm font-medium">No files uploaded yet</p>
      <p class="text-gray-500 text-xs mt-1">Use the upload button above to add files</p>
    </div>
  {/if}

  {#if error}
    <div class="mt-4 p-3 bg-red-950/30 border border-red-500/30 text-red-300 rounded-lg text-sm">
      {error}
    </div>
  {/if}
</div>
