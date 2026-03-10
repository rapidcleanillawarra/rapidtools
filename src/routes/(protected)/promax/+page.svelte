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

	const templateId = $derived($page.url.searchParams.get('template_id') ?? null);

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
				editedColor = parentDial?.backgroundColor || '#ffffff';
			} else {
				editedColor = '#ffffff';
			}
		}
		isEditingDescription = true;
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
						template_contents[dialIndex].backgroundColor = editedColor;
					}
				}
			}
			toastSuccess('Item updated');
		}
		
		isEditingDescription = false;
		editingShape = null;
	}

	$effect(() => {
		const id = templateId;
		if (!id) {
			// If no template_id, fetch the latest one and redirect
			(async () => {
				const { data, error } = await supabase
					.from('promax_templates')
					.select('id')
					.is('deleted_at', null)
					.order('created_at', { ascending: false })
					.limit(1)
					.maybeSingle();

				if (error) {
					toastError(error.message);
					return;
				}

				if (data?.id) {
					const url = new URL($page.url);
					url.searchParams.set('template_id', data.id);
					goto(url.toString(), { replaceState: true });
				} else {
					toastError('No templates found');
				}
			})();
			return;
		}
		
		let cancelled = false;
		templateLoading = true;
		(async () => {
			const { data, error } = await supabase
				.from('promax_templates')
				.select('id, name, template')
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
					<PreviewToolbar onExport={doExportPdf} />
				</div>

				<div class="preview-content">
					{#if templateLoading}
						<div class="loading-state">
							<div class="spinner"></div>
							<p>Loading template...</p>
						</div>
					{:else if !templateId}
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
				<div class="empty-placeholder">
					<!-- Future content goes here -->
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
						class="w-12 h-12 p-1 rounded cursor-pointer border-none bg-transparent"
					/>
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
		overflow-y: auto;
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

