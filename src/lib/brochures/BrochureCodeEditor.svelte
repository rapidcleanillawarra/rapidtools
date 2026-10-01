<script lang="ts">
	import {
		type BrochureTemplate,
		getDefaultBrochureTemplate,
		saveBrochureTemplate,
		resetBrochureTemplate,
		buildBrochureHtmlDocument
	} from './brochureTemplates';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import BrochureAiAssistant from './BrochureAiAssistant.svelte';

	let {
		slug,
		title = 'Brochure',
		open = $bindable(false),
		currentTemplate = $bindable(null),
		onSave,
		onReset
	}: {
		slug: string;
		title?: string;
		open?: boolean;
		currentTemplate?: BrochureTemplate | null;
		onSave?: (saved: BrochureTemplate) => void;
		onReset?: () => void;
	} = $props();

	type TabType = 'html' | 'css' | 'js' | 'preview';
	let activeTab = $state<TabType>('html');
	let isSplitView = $state(true);
	let isFullscreen = $state(false);
	let aiOpen = $state(false);
	let showCode = $state(true);

	let htmlContent = $state('');
	let cssContent = $state('');
	let jsContent = $state('');
	let isActive = $state(true);
	let isSaving = $state(false);
	let isResetting = $state(false);

	// Sync editor content whenever opened or currentTemplate changes
	$effect(() => {
		if (open) {
			if (currentTemplate) {
				htmlContent = currentTemplate.html || '';
				cssContent = currentTemplate.css || '';
				jsContent = currentTemplate.js || '';
				isActive = currentTemplate.is_active;
			} else {
				const fallback = getDefaultBrochureTemplate(slug);
				htmlContent = fallback.html;
				cssContent = fallback.css;
				jsContent = fallback.js;
				isActive = true;
			}
		}
	});

	let previewDoc = $derived(
		buildBrochureHtmlDocument({
			title,
			html: htmlContent,
			css: cssContent,
			js: jsContent
		})
	);

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
			e.preventDefault();
			showCode = !showCode;
		}
		if (e.key === 'Escape') {
			open = false;
		}
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

	async function handleSave() {
		isSaving = true;
		const payload: BrochureTemplate = {
			slug,
			title,
			html: htmlContent,
			css: cssContent,
			js: jsContent,
			is_active: isActive
		};

		const { error } = await saveBrochureTemplate(payload);
		isSaving = false;

		if (error) {
			toastError(`Failed to save template: ${error}`);
			return;
		}

		currentTemplate = payload;
		toastSuccess('Brochure template saved successfully');
		onSave?.(payload);
	}

	async function handleResetToDefault() {
		if (!confirm('Revert brochure to default built-in version? This will remove custom database overrides.')) {
			return;
		}

		isResetting = true;
		const { error } = await resetBrochureTemplate(slug);
		isResetting = false;

		if (error) {
			toastError(`Reset failed: ${error}`);
			return;
		}

		const fallback = getDefaultBrochureTemplate(slug);
		htmlContent = fallback.html;
		cssContent = fallback.css;
		jsContent = fallback.js;
		isActive = false;
		currentTemplate = null;

		toastSuccess('Reverted to default built-in template');
		onReset?.();
	}

	function loadDefaultIntoEditor() {
		if (confirm('Replace current editor content with default built-in code? Unsaved changes will be lost.')) {
			const fallback = getDefaultBrochureTemplate(slug);
			htmlContent = fallback.html;
			cssContent = fallback.css;
			jsContent = fallback.js;
		}
	}
</script>

<svelte:window onkeydown={open ? handleKeyDown : undefined} />

{#if open}
	<div
		class="code-editor-backdrop"
		onclick={() => (open = false)}
		role="button"
		tabindex="0"
		aria-label="Close code editor backdrop"
	></div>

	<div
		class={['code-editor-modal', { fullscreen: isFullscreen }]}
		role="dialog"
		aria-labelledby="code-editor-title"
		tabindex="-1"
	>
		<!-- Header -->
		<header class="editor-header">
			<div class="header-left">
				<div class="header-title-wrap">
					<h2 id="code-editor-title">Edit Brochure Source &middot; {title}</h2>
					<span class="db-badge">Database Driven</span>
					{#if currentTemplate?.updated_at}
						<span class="updated-time">
							Saved: {new Date(currentTemplate.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
						</span>
					{/if}
				</div>
			</div>

			<div class="header-center">
				<button
					type="button"
					class={['toggle-code-btn', { 'is-hidden': !showCode }]}
					onclick={() => (showCode = !showCode)}
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
					<div class="tab-group" role="tablist">
						<button
							type="button"
							class={['tab-btn', { active: activeTab === 'html' }]}
							onclick={() => (activeTab = 'html')}
						>
							HTML <span class="tab-count">{htmlContent.split('\n').length}L</span>
						</button>
						<button
							type="button"
							class={['tab-btn', { active: activeTab === 'css' }]}
							onclick={() => (activeTab = 'css')}
						>
							CSS <span class="tab-count">{cssContent.split('\n').length}L</span>
						</button>
						<button
							type="button"
							class={['tab-btn', { active: activeTab === 'js' }]}
							onclick={() => (activeTab = 'js')}
						>
							JS <span class="tab-count">{jsContent.split('\n').length}L</span>
						</button>
						<button
							type="button"
							class={['tab-btn preview-tab', { active: activeTab === 'preview' }]}
							onclick={() => (activeTab = 'preview')}
						>
							Preview
						</button>
					</div>
				{/if}
			</div>

			<div class="header-right">
				<button
					type="button"
					class={['ai-header-btn', { active: aiOpen }]}
					onclick={() => (aiOpen = !aiOpen)}
					title="Toggle DeepSeek AI Assistant"
				>
					✨ DeepSeek AI
				</button>

				<label class="toggle-wrap" title="Toggle active status of database template">
					<input type="checkbox" bind:checked={isActive} />
					<span class="toggle-label">{isActive ? 'Custom Active' : 'Default Inactive'}</span>
				</label>

				<button
					type="button"
					class="icon-btn"
					onclick={() => (isSplitView = !isSplitView)}
					title={isSplitView ? 'Switch to single pane' : 'Switch to split side-by-side view'}
				>
					{isSplitView ? 'Single View' : 'Split View'}
				</button>

				<button
					type="button"
					class="icon-btn"
					onclick={() => (isFullscreen = !isFullscreen)}
					title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
				>
					{isFullscreen ? 'Exit Full' : 'Fullscreen'}
				</button>

				<button
					type="button"
					class="close-btn"
					onclick={() => (open = false)}
					aria-label="Close editor"
				>
					&times;
				</button>
			</div>
		</header>

		<!-- Main Workspace -->
		<div class={['editor-workspace', { 'split-active': isSplitView && activeTab !== 'preview' && showCode, 'code-hidden': !showCode }]}>
			<!-- Left / Main Code Area -->
			{#if showCode && (activeTab !== 'preview' || !isSplitView)}
				<div class="code-pane">
					<div class="code-toolbar">
						<span class="code-lang-label">
							Editing <strong>{activeTab.toUpperCase()}</strong> &middot; Ctrl+S to save
						</span>
						<div class="code-toolbar-actions">
							<button type="button" class="text-action-btn" onclick={loadDefaultIntoEditor}>
								Reset to built-in code
							</button>
						</div>
					</div>

					{#if activeTab === 'html'}
						<textarea
							class="code-textarea"
							bind:value={htmlContent}
							onkeydown={handleTextareaKeyDown}
							placeholder="Enter brochure HTML markup..."
							spellcheck="false"
						></textarea>
					{:else if activeTab === 'css'}
						<textarea
							class="code-textarea"
							bind:value={cssContent}
							onkeydown={handleTextareaKeyDown}
							placeholder="Enter brochure CSS styles..."
							spellcheck="false"
						></textarea>
					{:else if activeTab === 'js'}
						<textarea
							class="code-textarea"
							bind:value={jsContent}
							onkeydown={handleTextareaKeyDown}
							placeholder="Enter optional brochure JavaScript..."
							spellcheck="false"
						></textarea>
					{/if}
				</div>
			{/if}

			<!-- Right / Preview Pane (in Split View or when Preview tab active or code hidden) -->
			{#if !showCode || isSplitView || activeTab === 'preview'}
				<div class="preview-pane">
					<div class="preview-header">
						<div class="preview-header-left">
							<span>Live Preview (Sandboxed)</span>
							{#if !showCode}
								<button
									type="button"
									class="show-code-badge-btn"
									onclick={() => (showCode = true)}
									title="Show code editor (Ctrl+E)"
								>
									👁️ Show Code
								</button>
							{/if}
						</div>
						<span class="preview-sub">Updates automatically as you type</span>
					</div>
					<iframe
						class="preview-iframe"
						srcdoc={previewDoc}
						title="Brochure Preview"
						sandbox="allow-scripts allow-same-origin"
					></iframe>
				</div>
			{/if}

			<!-- DeepSeek AI Assistant Drawer -->
			{#if aiOpen}
				<aside class="ai-editor-drawer">
					<BrochureAiAssistant
						{title}
						{slug}
						bind:htmlContent
						bind:cssContent
						bind:jsContent
						bind:open={aiOpen}
					/>
				</aside>
			{/if}
		</div>

		<!-- Footer -->
		<footer class="editor-footer">
			<div class="footer-left">
				<button
					type="button"
					class="btn-danger"
					onclick={handleResetToDefault}
					disabled={isResetting || isSaving || !currentTemplate}
				>
					{isResetting ? 'Reverting...' : 'Delete Database Override'}
				</button>
			</div>

			<div class="footer-right">
				<button type="button" class="btn-secondary" onclick={() => (open = false)}>
					Cancel
				</button>
				<button
					type="button"
					class="btn-save"
					onclick={handleSave}
					disabled={isSaving}
				>
					{isSaving ? 'Saving...' : 'Save to Database'}
				</button>
			</div>
		</footer>
	</div>
{/if}

<style>
	.code-editor-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 31, 0.65);
		backdrop-filter: blur(2px);
		z-index: 9998;
	}

	.code-editor-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 95vw;
		height: 90vh;
		background: #1e1e1e;
		border-radius: 12px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		color: #e4e4e7;
		transition: all 0.2s ease-out;
	}

	.code-editor-modal.fullscreen {
		top: 0;
		left: 0;
		transform: none;
		width: 100vw;
		height: 100vh;
		border-radius: 0;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 18px;
		background: #252526;
		border-bottom: 1px solid #333333;
		gap: 12px;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-title-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-title-wrap h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #f4f4f5;
	}

	.db-badge {
		font-size: 11px;
		font-weight: 600;
		background: #2f6f2f;
		color: #ffffff;
		padding: 2px 7px;
		border-radius: 4px;
	}

	.updated-time {
		font-size: 11px;
		color: #a1a1aa;
	}

	.header-center {
		display: flex;
		align-items: center;
	}

	.tab-group {
		display: flex;
		background: #18181b;
		border-radius: 6px;
		padding: 3px;
		gap: 2px;
	}

	.tab-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 12px;
		font-weight: 600;
		padding: 5px 12px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s;
	}

	.tab-btn:hover {
		color: #ffffff;
		background: #27272a;
	}

	.tab-btn.active {
		background: #3f3f46;
		color: #ffffff;
	}

	.tab-btn.preview-tab {
		color: #78be20;
	}

	.tab-btn.preview-tab.active {
		background: #2f6f2f;
		color: #ffffff;
	}

	.tab-count {
		font-size: 10px;
		background: rgba(255, 255, 255, 0.1);
		padding: 1px 4px;
		border-radius: 3px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.toggle-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #d4d4d8;
		cursor: pointer;
	}

	.toggle-wrap input {
		accent-color: #78be20;
		cursor: pointer;
	}

	.icon-btn {
		background: #333333;
		border: 1px solid #444444;
		color: #d4d4d8;
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
	}

	.icon-btn:hover {
		background: #444444;
		color: #ffffff;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		padding: 0 4px;
	}

	.close-btn:hover {
		color: #ffffff;
	}

	.editor-workspace {
		flex: 1;
		display: flex;
		min-height: 0;
		background: #1e1e1e;
	}

	.code-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
		border-right: 1px solid #333333;
	}

	.code-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		background: #252526;
		border-bottom: 1px solid #2d2d30;
		font-size: 11px;
		color: #9cdcfe;
	}

	.text-action-btn {
		background: none;
		border: none;
		color: #dcdcaa;
		font-size: 11px;
		cursor: pointer;
		text-decoration: underline;
	}

	.text-action-btn:hover {
		color: #ffffff;
	}

	.code-textarea {
		flex: 1;
		width: 100%;
		height: 100%;
		background: #1e1e1e;
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
		overflow: auto;
	}

	.preview-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
		background: #2d2d30;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		background: #252526;
		border-bottom: 1px solid #2d2d30;
		font-size: 11px;
		color: #9cdcfe;
	}

	.preview-sub {
		color: #858585;
		font-size: 10px;
	}

	.preview-iframe {
		flex: 1;
		width: 100%;
		height: 100%;
		border: none;
		background: #ffffff;
	}

	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 18px;
		background: #252526;
		border-top: 1px solid #333333;
	}

	.btn-danger {
		background: #451a1a;
		border: 1px solid #7f1d1d;
		color: #fca5a5;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
	}

	.btn-danger:hover:not(:disabled) {
		background: #7f1d1d;
		color: #ffffff;
	}

	.btn-danger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.footer-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.btn-secondary {
		background: #333333;
		border: 1px solid #444444;
		color: #d4d4d8;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
	}

	.btn-secondary:hover {
		background: #444444;
		color: #ffffff;
	}

	.btn-save {
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		border: none;
		color: #ffffff;
		font-size: 12px;
		font-weight: 700;
		padding: 7px 18px;
		border-radius: 6px;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(47, 111, 47, 0.4);
	}

	.btn-save:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.btn-save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ai-header-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #e4e4e7;
		font-size: 11px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		transition: all 0.15s;
	}

	.ai-header-btn:hover {
		background: #3f3f46;
		border-color: #78be20;
		color: #78be20;
	}

	.ai-header-btn.active {
		background: linear-gradient(135deg, rgba(47, 111, 47, 0.3) 0%, rgba(120, 190, 32, 0.25) 100%);
		border-color: #78be20;
		color: #78be20;
		box-shadow: 0 0 8px rgba(120, 190, 32, 0.25);
	}

	.ai-editor-drawer {
		width: 380px;
		min-width: 330px;
		max-width: 440px;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #18181b;
		border-left: 1px solid #333333;
		z-index: 10;
		animation: slideInRight 0.2s ease-out;
		transition: width 0.2s ease-out;
	}

	.editor-workspace.code-hidden .ai-editor-drawer {
		width: 440px;
		min-width: 380px;
		max-width: 520px;
	}

	.toggle-code-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #e4e4e7;
		font-size: 11px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		transition: all 0.15s;
	}

	.toggle-code-btn:hover {
		background: #3f3f46;
		color: #fff;
	}

	.toggle-code-btn.is-hidden {
		background: #202c1e;
		border-color: #78be20;
		color: #78be20;
		font-weight: 700;
	}

	.icon-toggle {
		width: 13px;
		height: 13px;
	}

	.preview-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.show-code-badge-btn {
		background: #202c1e;
		border: 1px solid #78be20;
		color: #78be20;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 4px;
		cursor: pointer;
	}
</style>
