<script lang="ts">
	import type { Shape, TemplateConfig } from './templates/utils/types';
	import {
		defaultTemplateBackgroundColor,
		toPx
	} from './templates/utils/shapeUtils';
	import { exportPdf } from './templates/utils/pdfUtils';
	import PreviewToolbar from './templates/components/PreviewToolbar.svelte';
	import ViewerCanvas from './components/ViewerCanvas.svelte';
	import { supabase } from '$lib/supabase';
	import { toastError, toastSuccess } from '$lib/utils/toast';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import { userProfile } from '$lib/userProfile';

	let template_config = $state<TemplateConfig>({
		width: 358.9,
		height: 850.93,
		borderRadius: 25,
		borderWidth: 0,
		backgroundColor: defaultTemplateBackgroundColor
	});

	let template_contents = $state<Shape[]>([]);
	let templateName = $state('');
	let templateLoading = $state(false);
	let templateEl = $state<HTMLDivElement | null>(null);

	// Description Editing State
	let isEditingDescription = $state(false);
	let editingShape = $state<Shape | null>(null);
	let editedText = $state('');
	let editedColor = $state('#ffffff');
	let editedBackgroundImage = $state<string | null>(null);
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let isTransparent = $state(false);

	// Promax record state
	let promaxId = $state<string | null>(null);
	let isSaving = $state(false);

	// Template Selection State
	let showTemplatePicker = $state(false);
	let availableTemplates = $state<any[]>([]);
	let templatesLoading = $state(false);
	
	// Saved ProMax Rows State
	let savedPromaxRows = $state<any[]>([]);
	let rowsLoading = $state(false);



	async function doExportPdf() {
		if (!templateEl) return;
		await exportPdf(templateEl);
	}

	function handleEditDescription(shape: Shape) {
		editingShape = shape;
		if (shape.functionName === 'product_icon' && shape.src) {
			// Extract icon name from URL: .../icons/bottle_fill.png -> bottle
			const match = shape.src.match(/\/icons\/([^/]+)_fill\.png/);
			editedText = match ? match[1] : 'bottle';
			editedColor = '#ffffff';
		} else {
			editedText = shape.text || '';
			// Find parent dial color if applicable
			if (shape.functionLink) {
				const parentDial = template_contents.find(s => s.id === shape.functionLink);
				if (parentDial) {
					editedColor = parentDial.backgroundColor || '#ffffff';
					editedBackgroundImage = parentDial.backgroundImage || null;
				}
			} else {
				editedColor = '#ffffff';
				editedBackgroundImage = null;
			}
		}
		selectedFile = null;
		previewUrl = null;
		isEditingDescription = true;
		
		// Reset transparency based on parent dial
		if (shape.functionLink) {
			const parentDial = template_contents.find(s => s.id === shape.functionLink);
			isTransparent = parentDial?.backgroundColor === 'transparent';
		} else {
			isTransparent = false;
		}
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files[0];
			previewUrl = URL.createObjectURL(selectedFile);
		}
	}

	async function uploadShapeImages(recordId: string) {
		const pendingShapes = template_contents.filter(s => s.file);
		if (pendingShapes.length === 0) return true;

		for (const shape of pendingShapes) {
			if (!shape.file) continue;
			
			const fileExt = shape.file.name.split('.').pop();
			const fileName = `${crypto.randomUUID()}.${fileExt}`;
			const folderName = `promax_${recordId}`;
			const filePath = `${folderName}/${fileName}`;

			const { error: uploadError } = await supabase.storage
				.from('promax')
				.upload(filePath, shape.file);

			if (uploadError) {
				toastError(`Upload failed for ${shape.file.name}: ${uploadError.message}`);
				return false;
			}

			const { data: { publicUrl } } = supabase.storage
				.from('promax')
				.getPublicUrl(filePath);

			// Log to promax_images
			const { error: dbError } = await supabase
				.from('promax_images')
				.insert({
					promax_id: recordId,
					file_path: filePath
				});
			
			if (dbError) console.error('Error logging image to DB:', dbError);

			// Update shape state
			shape.backgroundImage = publicUrl;
			shape.file = undefined;
		}
		return true;
	}

	async function saveToPromax() {
		if (isSaving) return;
		isSaving = true;

		const currentTemplateId = $page.url.searchParams.get('template_id');

		try {
			let workingPromaxId = promaxId;

			// 1. Initial Insert if new to get a stable ID for folder naming
			if (!workingPromaxId) {
				const profile = $userProfile;
				const { data, error } = await supabase
					.from('promax')
					.insert({
						name: templateName || 'Promax Record',
						data: { config: template_config, contents: template_contents },
						promax_template_id: currentTemplateId ?? null,
						created_by: profile?.email ?? null,
						created_by_name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : null
					})
					.select('id')
					.single();

				if (error) {
					toastError(error.message);
					return;
				}
				workingPromaxId = data.id;
				promaxId = workingPromaxId;

				// Update URL
				const url = new URL($page.url);
				url.searchParams.delete('template_id');
				url.searchParams.set('id', workingPromaxId);
				goto(url.toString(), { replaceState: true });
			}

			// 2. Handle Image Uploads (now that we definitely have a promaxId)
			const uploadSuccess = await uploadShapeImages(workingPromaxId);
			if (!uploadSuccess) return;

			// 3. Final Update with permanent URLs
			const dataPayload = {
				config: template_config,
				contents: template_contents
			};

			const profile = $userProfile;
			const { error: finalError } = await supabase
				.from('promax')
				.update({
					data: dataPayload,
					updated_at: new Date().toISOString(),
					updated_by: profile?.email ?? null,
					updated_by_name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : null
				})
				.eq('id', workingPromaxId);

			if (finalError) {
				toastError(finalError.message);
				return;
			}

			toastSuccess('Changes saved');
		} finally {
			isSaving = false;
		}
	}

	function saveDescription() {
		if (!editingShape) return;
		
		const index = template_contents.findIndex(s => s.id === editingShape?.id);
		if (index !== -1) {
			if (editingShape.functionName === 'product_icon') {
				// Update image src for icon
				const baseUrl = 'https://coywobndzyvslurwqtdt.supabase.co/storage/v1/object/public/promax/icons';
				template_contents[index].src = `${baseUrl}/${editedText}_fill.png`;
			} else {
				// Update text for name, code, description
				template_contents[index].text = editedText;

				// Update parent dial background color if it's name or code
				if (editingShape.functionLink && (editingShape.functionName === 'product_name' || editingShape.functionName === 'product_code')) {
					const dialIndex = template_contents.findIndex(s => s.id === editingShape?.functionLink);
					if (dialIndex !== -1) {
						template_contents[dialIndex].backgroundColor = isTransparent ? 'transparent' : editedColor;
						
						// Handle deferred image
						if (selectedFile) {
							template_contents[dialIndex].file = selectedFile;
							template_contents[dialIndex].backgroundImage = previewUrl || undefined;
						} else if (previewUrl === null && editedBackgroundImage === null) {
							// User explicitly removed image
							template_contents[dialIndex].file = undefined;
							template_contents[dialIndex].backgroundImage = undefined;
						}
					}
				}
			}
		}
		
		isEditingDescription = false;
		editingShape = null;
		selectedFile = null;
		previewUrl = null;
	}

	function handleCreateNew() {
		const url = new URL($page.url);
		url.searchParams.delete('id');
		url.searchParams.delete('template_id');
		goto(url.toString());
		// Reset local state
		promaxId = null;
		templateName = '';
	}

	$effect(() => {
		const id = $page.url.searchParams.get('id');
		const tmplId = $page.url.searchParams.get('template_id');

		if (id) {
			// Load from promax table
			promaxId = id;
			let cancelled = false;
			templateLoading = true;
			(async () => {
				const { data, error } = await supabase
					.from('promax')
					.select('id, name, data, promax_template_id')
					.eq('id', id)
					.is('deleted_at', null)
					.maybeSingle();

				if (cancelled) return;
				templateLoading = false;

				if (error) {
					toastError(error.message);
					return;
				}

				const row = data as any;
				if (!row?.data?.config || !row.data.contents) {
					toastError('Promax record not found or malformed');
					return;
				}

				template_config = row.data.config;
				template_contents = JSON.parse(JSON.stringify(row.data.contents)) as Shape[];
				templateName = row.name;
				toastSuccess('Record loaded');
			})();
			return () => { cancelled = true; };
		}

		if (!tmplId) {
			// No id or template_id: show template picker modal
			(async () => {
				templatesLoading = true;
				showTemplatePicker = true;
				const { data, error } = await supabase
					.from('promax_templates')
					.select('id, name')
					.is('deleted_at', null)
					.order('created_at', { ascending: false });

				templatesLoading = false;
				if (error) {
					toastError(error.message);
					return;
				}

				availableTemplates = data || [];
				if (availableTemplates.length === 0) {
					toastError('No templates found');
				}
			})();
			return;
		}

		// Load from promax_templates
		let cancelled = false;
		templateLoading = true;
		(async () => {
			const { data, error } = await supabase
				.from('promax_templates')
				.select('id, name, template')
				.eq('id', tmplId)
				.is('deleted_at', null)
				.maybeSingle();
			
			if (cancelled) return;
			templateLoading = false;

			if (error) {
				toastError(error.message);
				return;
			}
			
			const row = data as any;
			if (!row?.template?.config || !row.template.contents) {
				toastError('Template not found');
				return;
			}

			template_config = row.template.config;
			template_contents = JSON.parse(JSON.stringify(row.template.contents)) as Shape[];
			templateName = row.name;
			toastSuccess('Template loaded');
		})();
		return () => {
			cancelled = true;
		};
	});

	// Fetch saved promax rows
	$effect(() => {
		let cancelled = false;
		rowsLoading = true;
		(async () => {
			const { data, error } = await supabase
				.from('promax')
				.select('id, name, created_at')
				.is('deleted_at', null)
				.order('created_at', { ascending: false });

			if (cancelled) return;
			rowsLoading = false;

			if (error) {
				console.error('Error fetching promax rows:', error);
				return;
			}

			savedPromaxRows = data || [];
		})();

		return () => {
			cancelled = true;
		};
	});


</script>

<div class="promax-viewer">
	<main class="viewer-main">
		<div class="split-layout">
			<!-- Left Column: Template Preview -->
			<section class="preview-column">
				<div class="preview-header">
					<div class="template-info">
						<a href="/dashboard" class="back-link">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
							Back to Dashboard
						</a>
						<h1>{templateName || 'Template Viewer'}</h1>
					</div>
					<PreviewToolbar onExport={doExportPdf} onSave={saveToPromax} isSaving={isSaving} />
				</div>

				<div class="preview-content">
					{#if templateLoading}
						<div class="loading-state">
							<div class="spinner"></div>
							<p>Loading template...</p>
						</div>
					{:else if !$page.url.searchParams.get('id') && !$page.url.searchParams.get('template_id')}
						<div class="error-state">
							<p>No template ID provided. Please select a template from the <a href="/dashboard">dashboard</a>.</p>
						</div>
					{:else}
						<div class="canvas-container">
							<ViewerCanvas
								bind:templateEl
								templateConfig={template_config}
								templateContents={template_contents}
								onEditDescription={handleEditDescription}
							/>
						</div>
					{/if}
				</div>
			</section>

			<!-- Right Column: Empty for now -->
			<aside class="side-column">
				<div class="sidebar-header">
					<h2>Saved Records</h2>
					<button class="create-new-btn" onclick={handleCreateNew}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
						New
					</button>
				</div>
				<div class="sidebar-content">
					{#if rowsLoading}
						<div class="sidebar-loading">
							<div class="spinner-small"></div>
							<p>Loading records...</p>
						</div>
					{:else if savedPromaxRows.length === 0}
						<p class="empty-msg">No saved records found.</p>
					{:else}
						<div class="saved-rows-list">
							{#each savedPromaxRows as row (row.id)}
								<button 
									class="saved-row-item {promaxId === row.id ? 'active' : ''}"
									onclick={() => {
										const url = new URL(window.location.href);
										url.searchParams.delete('template_id');
										url.searchParams.set('id', row.id);
										goto(url.toString());
									}}
								>
									<div class="row-info">
										<span class="row-name">{row.name || 'Untitled Record'}</span>
										<span class="row-date">{new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
									</div>
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="item-arrow"><path d="m9 18 6-6-6-6"/></svg>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</aside>
		</div>
	</main>
</div>

<Modal show={isEditingDescription} on:close={() => (isEditingDescription = false)}>
	<span slot="header">Edit {editingShape?.functionName?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Item'}</span>
	<div slot="body" class="description-editor">
		<label for="desc-input" class="block text-sm font-medium text-gray-700 mb-2">
			{editingShape?.functionName === 'product_icon' ? 'Icon selection' : editingShape?.functionName?.split('_').pop()?.charAt(0).toUpperCase().concat(editingShape?.functionName?.split('_').pop()?.slice(1) || '') + ' Text'}
		</label>
		
		{#if editingShape?.functionName === 'product_icon'}
			<select
				id="icon-select"
				bind:value={editedText}
				class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			>
				<option value="bottle">Bottle</option>
				<option value="bucket">Bucket</option>
				<option value="scrubber">Scrubber</option>
				<option value="sink">Sink</option>
			</select>
		{:else if editingShape?.functionName === 'product_description'}
			<textarea
				id="desc-input"
				bind:value={editedText}
				class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px]"
				placeholder="Enter description..."
			></textarea>
		{:else}
			<div class="flex flex-col gap-4">
				<input
					type="text"
					bind:value={editedText}
					class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					placeholder="Enter {editingShape?.functionName?.replace('product_', '').replace('_', ' ') || 'text'}..."
				/>
				
				<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
					<div class="flex flex-col gap-1">
						<span class="text-sm font-semibold text-gray-700">Dial Color</span>
						<span class="text-xs text-gray-500">Overrides parent dial background</span>
					</div>
					<input
						type="color"
						bind:value={editedColor}
						disabled={isTransparent}
						class="w-12 h-12 p-1 rounded cursor-pointer border-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
					/>
					<label class="flex items-center gap-2 cursor-pointer ml-auto">
						<input type="checkbox" bind:checked={isTransparent} class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
						<span class="text-sm font-medium text-gray-700">Transparent</span>
					</label>
				</div>

				<div class="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
					<div class="flex items-center justify-between">
						<div class="flex flex-col gap-1">
							<span class="text-sm font-semibold text-gray-700">Dial Background Image</span>
							<span class="text-xs text-gray-500">Upload an image as background</span>
						</div>
					</div>
					
					<div class="flex items-center gap-4 mt-2">
						{#if previewUrl || editedBackgroundImage}
							<div class="w-12 h-12 rounded border border-gray-300 overflow-hidden bg-white flex-shrink-0">
								<img src={previewUrl || editedBackgroundImage} alt="Preview" class="w-full h-full object-cover" />
							</div>
						{/if}
						<label class="flex-1">
							<input
								type="file"
								accept="image/*"
								onchange={handleFileChange}
								class="hidden"
							/>
							<div class="px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer text-center transition-colors">
								{selectedFile ? 'Change Image' : 'Choose Image'}
							</div>
						</label>
						{#if selectedFile || editedBackgroundImage}
							<button 
								class="p-2 text-gray-400 hover:text-red-500 transition-colors"
								onclick={() => {
									selectedFile = null;
									previewUrl = null;
									editedBackgroundImage = null;
								}}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
	<div slot="footer" class="flex justify-end gap-3">
		<button
			class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
			onclick={() => (isEditingDescription = false)}
		>
			Cancel
		</button>
		<button
			class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
			onclick={saveDescription}
		>
			Save Changes
		</button>
	</div>
</Modal>

<Modal show={showTemplatePicker} on:close={() => (showTemplatePicker = false)}>
	<span slot="header">Select a Template</span>
	<div slot="body" class="template-picker">
		{#if templatesLoading}
			<div class="flex flex-col items-center justify-center py-8">
				<div class="spinner"></div>
				<p class="text-gray-500 mt-2">Fetching available templates...</p>
			</div>
		{:else if availableTemplates.length === 0}
			<p class="text-center py-8 text-gray-500">No templates available. Please create one in the dashboard.</p>
		{:else}
			<div class="grid grid-cols-1 gap-3">
				{#each availableTemplates as template (template.id)}
					<button
						class="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
						onclick={() => {
							const url = new URL($page.url);
							url.searchParams.set('template_id', template.id);
							goto(url.toString());
							showTemplatePicker = false;
						}}
					>
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v18l-8-4-8 4Z"/></svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900">{template.name || 'Untitled Template'}</h3>
								<p class="text-xs text-gray-500">Click to start with this template</p>
							</div>
						</div>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 group-hover:text-blue-600 transition-colors"><path d="m9 18 6-6-6-6"/></svg>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</Modal>

<style>
	.promax-viewer {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: #f3f4f6;
		overflow: hidden;
	}

	.viewer-main {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.split-layout {
		display: grid;
		grid-template-columns: 1fr 400px;
		width: 100%;
		height: 100%;
	}

	.preview-column {
		display: flex;
		flex-direction: column;
		background: #f3f4f6;
		border-right: 1px solid #e5e7eb;
		overflow: hidden;
	}

	.preview-header {
		background: white;
		border-bottom: 1px solid #e5e7eb;
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
	}

	.template-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: #6b7280;
		text-decoration: none;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #1f2937;
	}

	.template-info h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
	}

	.preview-content {
		flex: 1;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 2rem;
		overflow-y: auto;
	}

	.side-column {
		background: white;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-left: 1px solid #e5e7eb;
	}

	.sidebar-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: white;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		color: #111827;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.create-new-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		background-color: #2563eb;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.create-new-btn:hover {
		background-color: #1d4ed8;
		transform: translateY(-1px);
		box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
	}

	.create-new-btn:active {
		transform: translateY(0);
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.saved-rows-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.saved-row-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border: 1px solid #f3f4f6;
		border-radius: 0.75rem;
		background: #f9fafb;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		gap: 1rem;
	}

	.saved-row-item:hover {
		background: white;
		border-color: #2563eb;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
		transform: translateY(-1px);
	}

	.saved-row-item.active {
		background: #eff6ff;
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
	}

	.row-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		overflow: hidden;
	}

	.row-name {
		font-weight: 600;
		color: #111827;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-date {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.item-arrow {
		color: #9ca3af;
		flex-shrink: 0;
		transition: transform 0.2s;
	}

	.saved-row-item:hover .item-arrow {
		color: #2563eb;
		transform: translateX(2px);
	}

	.sidebar-loading, .empty-msg {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
		font-size: 0.875rem;
	}

	.spinner-small {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid #e5e7eb;
		border-top-color: #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 0.5rem;
	}

	.canvas-container {
		background: white;
		padding: 2rem;
		border-radius: 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		display: inline-flex;
		justify-content: center;
	}

	.loading-state, .error-state {
		text-align: center;
		color: #6b7280;
		margin-top: 4rem;
	}

	.spinner {
		width: 2.5rem;
		height: 2.5rem;
		border: 4px solid #e5e7eb;
		border-top-color: #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-state a {
		color: #2563eb;
		text-decoration: underline;
	}
</style>
