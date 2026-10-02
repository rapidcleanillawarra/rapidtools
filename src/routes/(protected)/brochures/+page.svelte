<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		loadBrochureTemplate,
		saveBrochureTemplate,
		resetBrochureTemplate,
		getDefaultBrochureTemplate,
		buildBrochureHtmlDocument,
		listAllBrochureTemplates,
		listBrochureTemplateVersions,
		type BrochureTemplate,
		type BrochureTemplateSummary,
		type BrochureTemplateVersion
	} from '$lib/brochures/brochureTemplates';
	import BrochureAiAssistant from '$lib/brochures/BrochureAiAssistant.svelte';
	import BrochureVersionHistory from '$lib/brochures/BrochureVersionHistory.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	// Templates & selection
	let templatesList = $state<BrochureTemplateSummary[]>([]);
	let selectedSlug = $state('preventative_maintenance');
	let currentTemplate = $state<BrochureTemplate | null>(null);
	let isLoading = $state(true);
	let historyOpen = $state(false);
	let versionCount = $state(0);

	// Editor state
	type TabType = 'html' | 'css' | 'js';
	let activeTab = $state<TabType>('html');
	let htmlContent = $state('');
	let cssContent = $state('');
	let jsContent = $state('');
	let isActive = $state(true);
	let brochureTitle = $state('Preventative Maintenance');

	// Workspace layout state
	type ViewMode = 'split' | 'code' | 'preview';
	let viewMode = $state<ViewMode>('split');
	let showCode = $state(true);
	let aiPanelOpen = $state(true);
	let isFullscreen = $state(false);
	let previewDevice = $state<'a4' | 'desktop' | 'mobile'>('a4');

	// Saving & Resetting
	let isSaving = $state(false);
	let isResetting = $state(false);
	let lastSavedSnapshot = $state('');

	// Create new brochure modal
	let showNewModal = $state(false);
	let newBrochureTitle = $state('');
	let newBrochureSlug = $state('');

	// Elements
	let previewIframeEl = $state<HTMLIFrameElement | null>(null);

	let hasUnsavedChanges = $derived(
		JSON.stringify({ html: htmlContent, css: cssContent, js: jsContent, isActive }) !==
			lastSavedSnapshot
	);

	let previewDoc = $derived(
		buildBrochureHtmlDocument({
			title: brochureTitle,
			html: htmlContent,
			css: cssContent,
			js: jsContent
		})
	);

	onMount(async () => {
		await refreshTemplatesList();
		await selectBrochure(selectedSlug);
	});

	async function refreshTemplatesList() {
		const res = await listAllBrochureTemplates();
		if (res.templates) {
			templatesList = res.templates;
		}
	}

	async function refreshVersionCount(slug: string) {
		const res = await listBrochureTemplateVersions(slug);
		if (res.versions) {
			versionCount = res.versions.length;
		}
	}

	async function selectBrochure(slug: string) {
		isLoading = true;
		selectedSlug = slug;

		// Fetch DB version if present
		const { template: dbTemplate, error } = await loadBrochureTemplate(slug);

		if (dbTemplate) {
			currentTemplate = dbTemplate;
			brochureTitle = dbTemplate.title;
			htmlContent = dbTemplate.html;
			cssContent = dbTemplate.css;
			jsContent = dbTemplate.js;
			isActive = dbTemplate.is_active;
		} else {
			const fallback = getDefaultBrochureTemplate(slug);
			currentTemplate = null;
			brochureTitle = fallback.title;
			htmlContent = fallback.html;
			cssContent = fallback.css;
			jsContent = fallback.js;
			isActive = true;
		}

		lastSavedSnapshot = JSON.stringify({
			html: htmlContent,
			css: cssContent,
			js: jsContent,
			isActive
		});

		await refreshVersionCount(slug);
		isLoading = false;
	}

	function handleBrochureDropdownChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const val = target.value;
		if (val === '__new__') {
			showNewModal = true;
			newBrochureTitle = '';
			newBrochureSlug = '';
			// Reset dropdown back to current
			target.value = selectedSlug;
			return;
		}
		if (hasUnsavedChanges) {
			if (!confirm('You have unsaved edits on the current brochure. Switch anyway?')) {
				target.value = selectedSlug;
				return;
			}
		}
		selectBrochure(val);
	}

	function handleTextareaKeyDown(e: KeyboardEvent) {
		const target = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Tab') {
			e.preventDefault();
			const start = target.selectionStart;
			const end = target.selectionEnd;
			const val = target.value;
			target.value = val.substring(0, start) + '  ' + val.substring(end);
			target.selectionStart = target.selectionEnd = start + 2;
			if (activeTab === 'html') htmlContent = target.value;
			else if (activeTab === 'css') cssContent = target.value;
			else if (activeTab === 'js') jsContent = target.value;
		}
	}

	function toggleCodeVisibility() {
		showCode = !showCode;
		if (showCode && viewMode === 'preview') {
			viewMode = 'split';
		}
	}

	function handleWindowKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
			e.preventDefault();
			toggleCodeVisibility();
		}
	}

	async function handleSave(customLabel?: string) {
		isSaving = true;
		const payload: BrochureTemplate = {
			slug: selectedSlug,
			title: brochureTitle,
			html: htmlContent,
			css: cssContent,
			js: jsContent,
			is_active: isActive
		};

		const { error, version } = await saveBrochureTemplate(payload, {
			versionLabel: customLabel || 'Saved studio edits'
		});
		isSaving = false;

		if (error) {
			toastError(`Failed to save template: ${error}`);
			return;
		}

		currentTemplate = payload;
		lastSavedSnapshot = JSON.stringify({
			html: htmlContent,
			css: cssContent,
			js: jsContent,
			isActive
		});

		await refreshVersionCount(selectedSlug);
		toastSuccess(
			version
				? `Brochure saved to database (Version ${version.version_number})`
				: 'Brochure saved to database'
		);
		await refreshTemplatesList();
	}

	async function handleResetToDefault() {
		if (
			!confirm(
				'Revert brochure to default built-in version? This will delete the custom database record.'
			)
		) {
			return;
		}

		isResetting = true;
		const { error } = await resetBrochureTemplate(selectedSlug);
		isResetting = false;

		if (error) {
			toastError(`Reset failed: ${error}`);
			return;
		}

		const fallback = getDefaultBrochureTemplate(selectedSlug);
		htmlContent = fallback.html;
		cssContent = fallback.css;
		jsContent = fallback.js;
		isActive = false;
		currentTemplate = null;

		lastSavedSnapshot = JSON.stringify({
			html: htmlContent,
			css: cssContent,
			js: jsContent,
			isActive
		});

		toastSuccess('Reverted to default built-in template');
		await refreshTemplatesList();
	}

	function loadDefaultIntoEditor() {
		if (
			confirm(
				'Replace current editor content with default built-in code? Unsaved changes will be replaced.'
			)
		) {
			const fallback = getDefaultBrochureTemplate(selectedSlug);
			htmlContent = fallback.html;
			cssContent = fallback.css;
			jsContent = fallback.js;
		}
	}

	function handlePrint() {
		if (previewIframeEl?.contentWindow) {
			previewIframeEl.contentWindow.focus();
			previewIframeEl.contentWindow.print();
		}
	}

	function openInNewTab() {
		const blob = new Blob([previewDoc], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		window.open(url, '_blank');
	}

	async function createNewBrochure() {
		const title = newBrochureTitle.trim();
		let slug = newBrochureSlug
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_]+/g, '_')
			.replace(/^_+|_+$/g, '');

		if (!title) {
			toastError('Title is required');
			return;
		}
		if (!slug) {
			slug = title
				.toLowerCase()
				.replace(/[^a-z0-9_]+/g, '_')
				.replace(/^_+|_+$/g, '');
		}

		const defaultMarkup = `<div class="brochure">
  <!-- Front Cover -->
  <section class="page cover-page">
    <div class="cover-content">
      <div class="brand-bar">
        <img src="${base}/brochures/shared/company_logo_white.png" alt="RapidClean Illawarra" class="logo" />
      </div>
      <div class="cover-body">
        <span class="eyebrow">Service &middot; Supply &middot; Support</span>
        <h1>${title}</h1>
        <p class="lead">Professional commercial cleaning equipment and facility hygiene solutions.</p>
      </div>
    </div>
  </section>

  <!-- Page 1 Content -->
  <section class="page">
    <div class="brand-bar">
      <img src="${base}/brochures/shared/company_logo_white.png" alt="RapidClean Illawarra" class="logo" />
    </div>
    <div class="page-inner">
      <h2>About Our Program</h2>
      <p>RapidClean Illawarra provides structured maintenance, commercial equipment, and chemical supply programs tailored to your facility.</p>
      
      <div class="callout">
        <h3>Why choose RapidClean?</h3>
        <p>Local support, factory-trained technicians, scheduled test & tag, and reliable product delivery across NSW.</p>
      </div>
    </div>
  </section>
</div>`;

		const defaultCss = `/* Design Tokens */
:root {
  --rapid-green: #78be20;
  --deep-green: #2f6f2f;
  --dark: #1f2933;
  --ink: #11181f;
  --white: #ffffff;
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  background: #d8dcd5;
  color: var(--ink);
  margin: 0;
  padding: 0;
}

.page {
  width: 210mm;
  height: 297mm;
  margin: 18px auto;
  background: var(--white);
  position: relative;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  page-break-after: always;
}

.brand-bar {
  background: #111;
  padding: 4mm 16mm;
  display: flex;
  align-items: center;
}

.brand-bar .logo {
  max-height: 14mm;
}

.page-inner {
  padding: 16mm;
}

h1 {
  font-size: 32pt;
  color: var(--deep-green);
  margin: 0 0 4mm;
}

h2 {
  font-size: 22pt;
  color: var(--deep-green);
  margin: 0 0 4mm;
}

.callout {
  background: #f4f8f1;
  border-left: 4px solid var(--rapid-green);
  padding: 12px 16px;
  border-radius: 8px;
  margin: 16px 0;
}`;

		const newTemplate: BrochureTemplate = {
			slug,
			title,
			html: defaultMarkup,
			css: defaultCss,
			js: '',
			is_active: true
		};

		const { error } = await saveBrochureTemplate(newTemplate);
		if (error) {
			toastError(`Failed to create template: ${error}`);
			return;
		}

		showNewModal = false;
		toastSuccess(`Created new brochure "${title}"!`);
		await refreshTemplatesList();
		await selectBrochure(slug);
	}
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

<svelte:head>
	<title>Brochure Studio &middot; DeepSeek AI Editor &middot; RapidClean</title>
</svelte:head>

<div class={['studio-container', { fullscreen: isFullscreen }]}>
	<!-- Studio Top Bar -->
	<header class="studio-header">
		<!-- Left: Selection & Meta -->
		<div class="header-left">
			<div class="brand-badge-wrap">
				<span class="rapid-badge">RapidClean</span>
				<span class="studio-title">Brochure Studio</span>
			</div>

			<div class="brochure-select-wrap">
				<select
					class="brochure-select"
					value={selectedSlug}
					onchange={handleBrochureDropdownChange}
					disabled={isLoading || isSaving}
				>
					<optgroup label="Available Brochures">
						{#each templatesList as item}
							<option value={item.slug}>
								{item.title} {item.is_custom ? '(Custom DB)' : '(Built-in)'}
							</option>
						{/each}
					</optgroup>
					<option value="__new__">+ Create New Brochure...</option>
				</select>
			</div>

			<label class="status-toggle" title="When active, this custom database code overrides the built-in brochure">
				<input type="checkbox" bind:checked={isActive} />
				<span class="toggle-text">{isActive ? 'DB Active' : 'Default Inactive'}</span>
			</label>

			{#if currentTemplate?.updated_at}
				<span class="save-status-text">
					Saved: {new Date(currentTemplate.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
				</span>
			{/if}

			{#if hasUnsavedChanges}
				<span class="unsaved-badge">Unsaved changes</span>
			{/if}
		</div>

		<!-- Center: Tabs & View Switcher -->
		<div class="header-center">
			<button
				type="button"
				class={['toggle-code-btn', { 'is-hidden': !showCode }]}
				onclick={toggleCodeVisibility}
				title={showCode ? 'Hide Code Tab & Editor (Ctrl+E) for larger preview and DeepSeek view' : 'Show Code Tab & Editor (Ctrl+E)'}
			>
				{#if showCode}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-toggle">
						<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke-linecap="round" stroke-linejoin="round"/>
						<line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>Hide Code</span>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-toggle">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/>
						<circle cx="12" cy="12" r="3"/>
					</svg>
					<span>Show Code</span>
				{/if}
			</button>

			{#if showCode}
				<div class="code-tabs" role="tablist">
					<button
						type="button"
						class={['tab-item', { active: activeTab === 'html' }]}
						onclick={() => (activeTab = 'html')}
					>
						HTML <span class="tab-len">{htmlContent.split('\n').length}L</span>
					</button>
					<button
						type="button"
						class={['tab-item', { active: activeTab === 'css' }]}
						onclick={() => (activeTab = 'css')}
					>
						CSS <span class="tab-len">{cssContent.split('\n').length}L</span>
					</button>
					<button
						type="button"
						class={['tab-item', { active: activeTab === 'js' }]}
						onclick={() => (activeTab = 'js')}
					>
						JS <span class="tab-len">{jsContent.split('\n').length}L</span>
					</button>
				</div>
			{/if}

			<div class="view-mode-group">
				{#if showCode}
					<button
						type="button"
						class={['view-btn', { active: viewMode === 'code' }]}
						onclick={() => (viewMode = 'code')}
						title="Code Editor Only"
					>
						Code
					</button>
					<button
						type="button"
						class={['view-btn', { active: viewMode === 'split' }]}
						onclick={() => (viewMode = 'split')}
						title="Split Code & Preview"
					>
						Split
					</button>
				{/if}
				<button
					type="button"
					class={['view-btn', { active: !showCode || viewMode === 'preview' }]}
					onclick={() => {
						showCode = false;
						viewMode = 'preview';
					}}
					title="Preview & DeepSeek Focus (Code tab hidden)"
				>
					Preview + AI
				</button>
			</div>
		</div>

		<!-- Right: Actions -->
		<div class="header-right">
			<button
				type="button"
				class={['history-toggle-btn', { active: historyOpen }]}
				onclick={() => (historyOpen = !historyOpen)}
				title="Open Version History & HTML Diff"
			>
				🕒 Versions {#if versionCount > 0}<span class="history-count-badge">{versionCount}</span>{/if}
			</button>

			<button
				type="button"
				class={['ai-toggle-btn', { active: aiPanelOpen }]}
				onclick={() => (aiPanelOpen = !aiPanelOpen)}
				title="Toggle DeepSeek AI Assistant"
			>
				<span class="ai-sparkle">✨</span> DeepSeek AI
			</button>

			<button
				type="button"
				class="tool-btn-secondary"
				onclick={handlePrint}
				title="Print or Save PDF via sandboxed browser preview"
			>
				🖨️ Print / PDF
			</button>

			<button
				type="button"
				class="save-btn"
				onclick={() => handleSave()}
				disabled={isSaving}
				title="Save to database (Ctrl+S)"
			>
				{isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
			</button>

			<button
				type="button"
				class="icon-action-btn"
				onclick={() => (isFullscreen = !isFullscreen)}
				title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
			>
				{isFullscreen ? 'Exit Full' : 'Fullscreen'}
			</button>
		</div>
	</header>

	<!-- Main Workspace -->
	<main class={['studio-workspace', { 'code-hidden': !showCode }]}>
		<!-- Left: Code Editor Pane -->
		{#if showCode && viewMode !== 'preview'}
			<div class={['code-editor-pane', { 'full-pane': viewMode === 'code' }]}>
				<div class="pane-toolbar">
					<div class="toolbar-left">
						<span class="lang-indicator">Editing <strong>{activeTab.toUpperCase()}</strong></span>
						<span class="kbd-hint">Ctrl+S to save</span>
					</div>
					<div class="toolbar-right">
						<button type="button" class="btn-text-link" onclick={loadDefaultIntoEditor}>
							Reset tab to default code
						</button>
					</div>
				</div>

				<div class="textarea-wrapper">
					{#if activeTab === 'html'}
						<textarea
							class="code-box"
							bind:value={htmlContent}
							onkeydown={handleTextareaKeyDown}
							placeholder="Enter brochure HTML structure..."
							spellcheck="false"
						></textarea>
					{:else if activeTab === 'css'}
						<textarea
							class="code-box"
							bind:value={cssContent}
							onkeydown={handleTextareaKeyDown}
							placeholder="Enter brochure CSS styling..."
							spellcheck="false"
						></textarea>
					{:else if activeTab === 'js'}
						<textarea
							class="code-box"
							bind:value={jsContent}
							onkeydown={handleTextareaKeyDown}
							placeholder="Enter optional brochure JavaScript..."
							spellcheck="false"
						></textarea>
					{/if}
				</div>

				<div class="code-editor-footer">
					<button
						type="button"
						class="btn-delete-override"
						onclick={handleResetToDefault}
						disabled={isResetting || !currentTemplate}
						title="Delete database override and revert to original built-in template"
					>
						{isResetting ? 'Reverting...' : 'Delete DB Override'}
					</button>

					<div class="editor-info-right">
						<span>Characters: {(activeTab === 'html' ? htmlContent : activeTab === 'css' ? cssContent : jsContent).length}</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Center: Live Preview Pane -->
		{#if !showCode || viewMode !== 'code'}
			<div class={['preview-pane', { 'full-pane': !showCode || viewMode === 'preview' }]}>
				<div class="pane-toolbar preview-toolbar">
					<div class="preview-mode-switchers">
						<button
							type="button"
							class={['mode-btn', { active: previewDevice === 'a4' }]}
							onclick={() => (previewDevice = 'a4')}
						>
							A4 Print View
						</button>
						<button
							type="button"
							class={['mode-btn', { active: previewDevice === 'desktop' }]}
							onclick={() => (previewDevice = 'desktop')}
						>
							Desktop 100%
						</button>
						<button
							type="button"
							class={['mode-btn', { active: previewDevice === 'mobile' }]}
							onclick={() => (previewDevice = 'mobile')}
						>
							Mobile
						</button>
						{#if !showCode}
							<button
								type="button"
								class="mode-btn show-code-pill"
								onclick={toggleCodeVisibility}
								title="Show code editor (Ctrl+E)"
							>
								👁️ Show Code
							</button>
						{/if}
					</div>

					<div class="preview-toolbar-actions">
						<button type="button" class="btn-text-link" onclick={openInNewTab}>
							Open Full Tab ↗
						</button>
					</div>
				</div>

				<div class={['preview-frame-container', previewDevice]}>
					<iframe
						bind:this={previewIframeEl}
						srcdoc={previewDoc}
						title="Brochure Live Sandbox Preview"
						sandbox="allow-scripts allow-same-origin"
						class="preview-iframe"
					></iframe>
				</div>
			</div>
		{/if}

		<!-- Right: DeepSeek AI Assistant Side Drawer -->
		{#if aiPanelOpen}
			<aside class="ai-drawer">
				<BrochureAiAssistant
					title={brochureTitle}
					slug={selectedSlug}
					bind:htmlContent
					bind:cssContent
					bind:jsContent
					bind:open={aiPanelOpen}
				/>
			</aside>
		{/if}
	</main>
</div>

<BrochureVersionHistory
	slug={selectedSlug}
	title={brochureTitle}
	currentHtml={htmlContent}
	currentCss={cssContent}
	currentJs={jsContent}
	bind:open={historyOpen}
	onRestore={(ver) => {
		htmlContent = ver.html;
		cssContent = ver.css;
		jsContent = ver.js;
	}}
	onVersionChange={(count) => (versionCount = count)}
/>

<!-- Create New Brochure Modal -->
{#if showNewModal}
	<div
		class="modal-backdrop"
		onclick={() => (showNewModal = false)}
		role="button"
		tabindex="0"
		aria-label="Close modal"
	></div>

	<div class="create-modal" role="dialog" aria-labelledby="create-modal-title">
		<header class="create-modal-header">
			<h3 id="create-modal-title">Create New Brochure Template</h3>
			<button type="button" class="modal-close" onclick={() => (showNewModal = false)}>&times;</button>
		</header>
		<div class="create-modal-body">
			<div class="field-wrap">
				<label for="new-title">Brochure Title</label>
				<input
					id="new-title"
					type="text"
					bind:value={newBrochureTitle}
					placeholder="e.g. Industrial Floor Care Program"
					class="text-input"
				/>
			</div>

			<div class="field-wrap">
				<label for="new-slug">Slug Identifier (URL friendly)</label>
				<input
					id="new-slug"
					type="text"
					bind:value={newBrochureSlug}
					placeholder="e.g. industrial_floor_care"
					class="text-input"
				/>
				<span class="field-help">Unique database key consisting of letters, numbers, and underscores.</span>
			</div>
		</div>
		<footer class="create-modal-footer">
			<button type="button" class="btn-cancel" onclick={() => (showNewModal = false)}>
				Cancel
			</button>
			<button type="button" class="btn-create" onclick={createNewBrochure}>
				Create Template
			</button>
		</footer>
	</div>
{/if}

<style>
	.studio-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: calc(100vh - 64px);
		background: #18181b;
		color: #e4e4e7;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		overflow: hidden;
	}

	.studio-container.fullscreen {
		position: fixed;
		inset: 0;
		height: 100vh;
		z-index: 99999;
	}

	/* Top Bar */
	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: #1f1f23;
		border-bottom: 1px solid #2e2e33;
		gap: 12px;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.brand-badge-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.rapid-badge {
		font-size: 10.5px;
		font-weight: 800;
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		color: #fff;
		padding: 2px 7px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.studio-title {
		font-size: 13px;
		font-weight: 700;
		color: #f4f4f5;
	}

	.brochure-select-wrap {
		display: flex;
		align-items: center;
	}

	.brochure-select {
		background: #141416;
		border: 1px solid #3f3f46;
		color: #f4f4f5;
		font-size: 12px;
		font-weight: 600;
		padding: 5px 10px;
		border-radius: 6px;
		outline: none;
		cursor: pointer;
	}

	.brochure-select:focus {
		border-color: #78be20;
	}

	.status-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		color: #d4d4d8;
		cursor: pointer;
	}

	.status-toggle input {
		accent-color: #78be20;
		cursor: pointer;
	}

	.save-status-text {
		font-size: 11px;
		color: #71717a;
	}

	.unsaved-badge {
		font-size: 10px;
		font-weight: 700;
		background: #7c2d12;
		color: #fdba74;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.header-center {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.toggle-code-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #e4e4e7;
		font-size: 11.5px;
		font-weight: 600;
		padding: 5px 10px;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s;
	}

	.toggle-code-btn:hover {
		background: #3f3f46;
		color: #fff;
		border-color: #52525b;
	}

	.toggle-code-btn.is-hidden {
		background: #202c1e;
		border-color: #78be20;
		color: #78be20;
		font-weight: 700;
	}

	.icon-toggle {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.code-tabs {
		display: flex;
		background: #141416;
		border-radius: 6px;
		padding: 2px;
		gap: 2px;
		border: 1px solid #2e2e33;
	}

	.tab-item {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 11.5px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		transition: all 0.15s;
	}

	.tab-item:hover {
		color: #fff;
		background: #27272a;
	}

	.tab-item.active {
		background: #3f3f46;
		color: #fff;
	}

	.tab-len {
		font-size: 9.5px;
		background: rgba(255, 255, 255, 0.1);
		padding: 1px 4px;
		border-radius: 3px;
	}

	.view-mode-group {
		display: flex;
		background: #141416;
		border-radius: 6px;
		padding: 2px;
		gap: 2px;
		border: 1px solid #2e2e33;
	}

	.view-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 11px;
		font-weight: 600;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.view-btn:hover {
		color: #fff;
	}

	.view-btn.active {
		background: #27272a;
		color: #78be20;
		font-weight: 700;
	}

	.show-code-pill {
		background: #202c1e !important;
		border-color: #78be20 !important;
		color: #78be20 !important;
		font-weight: 700;
		cursor: pointer;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.history-toggle-btn {
		background: #1e2632;
		border: 1px solid #334155;
		color: #38bdf8;
		font-size: 12px;
		font-weight: 700;
		padding: 5px 11px;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s;
	}

	.history-toggle-btn:hover {
		background: #253346;
		border-color: #38bdf8;
	}

	.history-toggle-btn.active {
		background: #0369a1;
		color: #ffffff;
		border-color: #38bdf8;
		box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
	}

	.history-count-badge {
		background: rgba(255, 255, 255, 0.2);
		padding: 1px 5px;
		border-radius: 4px;
		font-size: 10px;
	}

	.ai-toggle-btn {
		background: #202025;
		border: 1px solid #383842;
		color: #e4e4e7;
		font-size: 12px;
		font-weight: 700;
		padding: 5px 12px;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s;
	}

	.ai-toggle-btn:hover {
		background: #2c2c34;
		border-color: #78be20;
	}

	.ai-toggle-btn.active {
		background: linear-gradient(135deg, rgba(47, 111, 47, 0.3) 0%, rgba(120, 190, 32, 0.25) 100%);
		border-color: #78be20;
		color: #78be20;
		box-shadow: 0 0 10px rgba(120, 190, 32, 0.2);
	}

	.ai-sparkle {
		font-size: 13px;
	}

	.tool-btn-secondary {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #d4d4d8;
		font-size: 11.5px;
		font-weight: 600;
		padding: 5px 10px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tool-btn-secondary:hover {
		background: #3f3f46;
		color: #fff;
	}

	.save-btn {
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		border: none;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(47, 111, 47, 0.3);
		transition: filter 0.15s;
	}

	.save-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon-action-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #a1a1aa;
		font-size: 11px;
		padding: 5px 8px;
		border-radius: 6px;
		cursor: pointer;
	}

	.icon-action-btn:hover {
		color: #fff;
		background: #3f3f46;
	}

	/* Workspace */
	.studio-workspace {
		flex: 1;
		display: flex;
		min-height: 0;
		background: #141416;
		overflow: hidden;
	}

	.code-editor-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
		border-right: 1px solid #2e2e33;
		background: #18181b;
	}

	.code-editor-pane.full-pane {
		flex: 1;
		border-right: none;
	}

	.pane-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		background: #202023;
		border-bottom: 1px solid #2e2e33;
		font-size: 11px;
		color: #9cdcfe;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.kbd-hint {
		color: #71717a;
		font-size: 10px;
	}

	.btn-text-link {
		background: none;
		border: none;
		color: #dcdcaa;
		font-size: 11px;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.btn-text-link:hover {
		color: #fff;
	}

	.textarea-wrapper {
		flex: 1;
		min-height: 0;
		position: relative;
	}

	.code-box {
		width: 100%;
		height: 100%;
		background: #18181b;
		color: #d4d4d4;
		font-family: 'Consolas', 'Fira Code', 'Monaco', monospace;
		font-size: 13px;
		line-height: 1.6;
		padding: 12px;
		border: none;
		outline: none;
		resize: none;
		tab-size: 2;
		white-space: pre;
		box-sizing: border-box;
		overflow: auto;
	}

	.code-editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		background: #202023;
		border-top: 1px solid #2e2e33;
		font-size: 11px;
		color: #71717a;
	}

	.btn-delete-override {
		background: #451a1a;
		border: 1px solid #7f1d1d;
		color: #fca5a5;
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-delete-override:hover:not(:disabled) {
		background: #7f1d1d;
		color: #fff;
	}

	.btn-delete-override:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Preview Pane */
	.preview-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
		background: #27272a;
	}

	.preview-pane.full-pane {
		flex: 1;
	}

	.preview-toolbar {
		background: #202023;
	}

	.preview-mode-switchers {
		display: flex;
		gap: 3px;
	}

	.mode-btn {
		background: #18181b;
		border: 1px solid #333338;
		color: #a1a1aa;
		font-size: 10.5px;
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	.mode-btn:hover {
		color: #fff;
	}

	.mode-btn.active {
		background: #2f6f2f;
		border-color: #78be20;
		color: #fff;
		font-weight: 600;
	}

	.preview-frame-container {
		flex: 1;
		display: flex;
		justify-content: center;
		overflow: auto;
		background: #3f3f46;
		padding: 12px;
	}

	.preview-frame-container.a4 .preview-iframe {
		width: 210mm;
		min-height: 297mm;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
		border-radius: 2px;
	}

	.preview-frame-container.desktop .preview-iframe {
		width: 100%;
		height: 100%;
	}

	.preview-frame-container.mobile .preview-iframe {
		width: 390px;
		height: 844px;
		border-radius: 24px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
		border: 8px solid #18181b;
	}

	.preview-iframe {
		border: none;
		background: #ffffff;
		display: block;
	}

	/* AI Drawer */
	.ai-drawer {
		width: 380px;
		min-width: 340px;
		max-width: 450px;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #18181b;
		border-left: 1px solid #2e2e33;
		z-index: 10;
		animation: slideInRight 0.2s ease-out;
		transition: width 0.2s ease-out;
	}

	.studio-workspace.code-hidden .ai-drawer {
		width: 440px;
		min-width: 380px;
		max-width: 520px;
	}

	@keyframes slideInRight {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	/* Create Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(10, 10, 12, 0.7);
		backdrop-filter: blur(2px);
		z-index: 10000;
	}

	.create-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 440px;
		max-width: 90vw;
		background: #1f1f23;
		border: 1px solid #333338;
		border-radius: 12px;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
		z-index: 10001;
		color: #e4e4e7;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.create-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		background: #25252a;
		border-bottom: 1px solid #333338;
	}

	.create-modal-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
	}

	.modal-close {
		background: none;
		border: none;
		color: #a1a1aa;
		font-size: 22px;
		cursor: pointer;
		line-height: 1;
	}

	.modal-close:hover {
		color: #fff;
	}

	.create-modal-body {
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field-wrap {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-wrap label {
		font-size: 12px;
		font-weight: 600;
		color: #d4d4d8;
	}

	.text-input {
		background: #141416;
		border: 1px solid #38383e;
		border-radius: 6px;
		color: #fff;
		font-size: 13px;
		padding: 8px 10px;
		outline: none;
	}

	.text-input:focus {
		border-color: #78be20;
	}

	.field-help {
		font-size: 10.5px;
		color: #71717a;
	}

	.create-modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 18px;
		background: #25252a;
		border-top: 1px solid #333338;
	}

	.btn-cancel {
		background: transparent;
		border: 1px solid #3f3f46;
		color: #a1a1aa;
		font-size: 12px;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
	}

	.btn-cancel:hover {
		color: #fff;
		background: #27272a;
	}

	.btn-create {
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		border: none;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		padding: 6px 16px;
		border-radius: 6px;
		cursor: pointer;
	}

	.btn-create:hover {
		filter: brightness(1.08);
	}
</style>
