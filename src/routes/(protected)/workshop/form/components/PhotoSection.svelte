<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PhotoManager from '$lib/components/PhotoManager.svelte';
  import type { PhotoItem } from '$lib/types/workshop';
  import type { JobStatus } from '../workshop-status.service';

  export let photos: PhotoItem[] = [];
  export let photoError = '';
  export let workshopStatus: JobStatus;

  const dispatch = createEventDispatcher();

  function handlePhotosUpdated(event: CustomEvent) {
    photos = event.detail.photos;
    dispatch('photosUpdated', { photos });
  }

  function handlePhotoError(event: CustomEvent) {
    photoError = event.detail.message;
    dispatch('photoError', { message: photoError });
  }

  function handlePhotoClick(event: CustomEvent) {
    dispatch('photoClick', { photoIndex: event.detail.photoIndex });
  }

  // Photos are always required to be 0 (optional)
  const MIN_PHOTOS_REQUIRED = 0;
</script>

<!-- Photos Section - Always visible -->
<div>
  <PhotoManager
    bind:photos
    bind:error={photoError}
    minPhotosRequired={MIN_PHOTOS_REQUIRED}
    workshopStatus={workshopStatus}
    on:photosUpdated={handlePhotosUpdated}
    on:error={handlePhotoError}
    on:photoClick={handlePhotoClick}
  />
</div>
