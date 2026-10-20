# Subphase 9: Task Photo Viewer (`TaskPhotoViewer.svelte`)

## Goal for the Model
Create and integrate `src/routes/(protected)/tasks/components/TaskPhotoViewer.svelte` to deliver an image viewing and gallery experience across the Tasks module:
1. **Interactive Fullscreen Photo Viewer (Lightbox)**:
   - Backdrop blur (`bg-black/90 backdrop-blur-md`) with fade-in animation.
   - Header bar displaying task context, file name, image count (`X of Y`), file size badge, zoom controls (`-`, zoom percentage reset, `+`), 90° clockwise rotation, download button, open original in new tab button, and close (`Esc`).
   - Prev/Next chevron buttons with wrap-around navigation and keyboard arrow shortcuts (`ArrowLeft`, `ArrowRight`).
   - Double-click to toggle 2x zoom; click-and-drag pan support when zoomed in.
   - Horizontal thumbnail strip along the bottom for instant navigation between photos with active image highlighted in lime.
2. **Visual Photo Gallery in Task Detail Modal (`TaskDetailModal.svelte`)**:
   - Categorizes task attachments into **Photos & Images** and **Documents & Files**.
   - Responsive photo thumbnail grid (`aspect-video`) with cover images, filename overlays, file size, hover quick-action buttons (view in lightbox, open original, delete).
   - "Open viewer" button to launch the lightbox.
   - Individual attachment deletion via `deleteTaskAttachment`.
3. **Card & List View Triggers**:
   - `TaskCard.svelte`: Shows photo count button in footer (`📷 X`) and "View photos" option in the card `...` menu, directly launching the viewer.
   - `TasksListView.svelte`: Shows photo badge beside task title to launch the photo viewer directly.
4. **Pre-upload Photo Preview in `CreateTaskModal.svelte`**:
   - When creating a task with image attachments, provides an instant preview button opening the photo viewer before creation.

---

## Component Interface (`TaskPhotoViewer.svelte`)

### Props
- `open: boolean` — Controls whether the viewer modal is visible.
- `photos: TaskPhoto[]` — Array of photo items with `{ id?, url, name, byte_size?, created_at? }`.
- `index: number` — Currently active photo index (0-based).
- `taskTitle: string` — Context title of the task the photos belong to.
- `canDelete: boolean` — (Optional) whether to show a delete button inside the viewer header.

### Dispatched Events
- `close: void` — Fires when the user clicks backdrop, close button, or presses `Escape`.
- `indexChange: { index: number }` — Fires when navigating photos or clicking a thumbnail.
- `delete: { photo: TaskPhoto; index: number }` — Fires when photo deletion is triggered from inside the viewer.

### Keyboard Shortcuts
- `Escape`: Close viewer
- `ArrowLeft` / `ArrowRight`: Navigate previous / next photo
- `+` / `=`: Zoom in
- `-` / `_`: Zoom out
- `0`: Reset zoom and rotation
- `R` / `r`: Rotate 90° clockwise

---

## File Integration Map

1. `src/routes/(protected)/tasks/types.ts`:
   - `TaskPhoto` interface
   - `isImageAttachment(att)` helper
   - `formatByteSize(bytes)` helper
   - `getImageAttachments(attachments)` helper
   - `getNonImageAttachments(attachments)` helper
2. `src/routes/(protected)/tasks/tasksService.ts`:
   - `deleteTaskAttachment(attachmentId, storagePath)`
3. `src/routes/(protected)/tasks/components/TaskPhotoViewer.svelte`:
   - Fullscreen lightbox component with zoom, pan, rotate, download, and bottom thumbnail carousel.
4. `src/routes/(protected)/tasks/components/TaskDetailModal.svelte`:
   - Photo gallery grid with hover action buttons, separate document list, upload integration, and embedded `TaskPhotoViewer`.
5. `src/routes/(protected)/tasks/components/TaskCard.svelte`:
   - Photo count indicator pill and card action menu trigger.
6. `src/routes/(protected)/tasks/components/TasksListView.svelte`:
   - Table row photo count button opening viewer.
7. `src/routes/(protected)/tasks/components/CreateTaskModal.svelte`:
   - Attachment photo preview prior to submission.
8. `src/routes/(protected)/tasks/+page.svelte`:
   - Top-level `TaskPhotoViewer` instance wired to `TasksBoardView` and `TasksListView` `openPhotos` events.
