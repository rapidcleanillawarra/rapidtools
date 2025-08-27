fix(workshop): Remove direct camera access feature

This commit removes the recently added direct camera access feature, reverting back to the original file input implementation for better compatibility and simpler maintenance.

### Files Modified:

#### 1. `src/routes/(protected)/workshop/camera/+page.svelte`
- REMOVED: Direct camera access using `navigator.mediaDevices.getUserMedia()`
- REMOVED: Live camera preview and capture interface
- REMOVED: Camera support detection
- REMOVED: Photo counter display
- REMOVED: Visual feedback animations
- REMOVED: Canvas-based photo capture
- FIXED: Memory cleanup with proper `onDestroy` hook
- DIFF:
  ```diff
  - // Direct camera access
  - let cameraStream: MediaStream | null = null;
  - let cameraVideo: HTMLVideoElement | null = null;
  - let cameraCanvas: HTMLCanvasElement | null = null;
  - let showCamera = false;
  - let cameraSupported = false;

  - async function startCamera() {
  -   try {
  -     const constraints = {
  -       video: {
  -         facingMode: { ideal: 'environment' },
  -         width: { ideal: 1920 },
  -         height: { ideal: 1080 }
  -       }
  -     };
  -     cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  -   } catch (error) {
  -     console.error('Error accessing camera:', error);
  -   }
  - }

  + type PhotoItem = { file: File; url: string };
  + let photos: PhotoItem[] = [];
  ```

#### 2. `src/routes/(protected)/workshop/create/+page.svelte`
- REVERTED: PhotoItem type to original structure
- REMOVED: Timestamp from photo metadata
- DIFF:
  ```diff
  - type PhotoItem = { file: File | null; url: string; timestamp: number };
  + type PhotoItem = { file: File; url: string };

  - newItems.push({ file, url, timestamp: Date.now() });
  + newItems.push({ file, url });
  ```

### Technical Improvements:
- BEFORE: Complex direct camera implementation with potential browser compatibility issues
- AFTER: Simple, reliable file input method with native mobile camera support
- SECURITY: Reduced browser permission requirements
- PERFORMANCE: Removed unnecessary video stream processing
- MAINTENANCE: Simplified codebase with fewer potential points of failure

### Testing Instructions:
1. Navigate to Workshop > Camera
2. Verify "Take Photo" opens native camera on mobile
3. Verify "Upload from Device" allows file selection
4. Confirm photos display correctly in grid
5. Verify photo removal works
6. Check memory cleanup on component destroy

### Browser Compatibility:
- Works on all modern browsers
- No special permissions required
- Uses native file input capabilities

### Notes:
- No breaking changes
- No database schema changes
- No API endpoint modifications
- Maintains original functionality while removing experimental features