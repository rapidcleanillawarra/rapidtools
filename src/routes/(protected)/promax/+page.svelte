<script lang="ts">
	import type { Shape, TemplateConfig } from './templates/utils/types';
	import {
		defaultTemplateBackgroundColor,
		toPx
	} from './templates/utils/shapeUtils';
	import { exportPdf } from './templates/utils/pdfUtils';
	import PreviewToolbar from './templates/components/PreviewToolbar.svelte';
	import TemplateCanvas from './templates/components/TemplateCanvas.svelte';
	import { supabase } from '$lib/supabase';
	import { toastError, toastSuccess } from '$lib/utils/toast';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

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

	const templateId = $derived($page.url.searchParams.get('template_id') ?? null);

	async function doExportPdf() {
		if (!templateEl) return;
		await exportPdf(templateEl);
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

	// No-op handlers for the canvas to disable editing
	const noop = () => {};
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
							<TemplateCanvas
								bind:templateEl
								templateConfig={template_config}
								templateContents={template_contents}
								selectedShapeId={null}
								dragging={null}
								onStartDrag={noop}
								onStartResize={noop}
								onBackgroundClick={noop}
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

