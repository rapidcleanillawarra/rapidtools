<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listBrochureTemplateVersions,
		saveBrochureTemplateVersion,
		deleteBrochureTemplateVersion,
		buildBrochureHtmlDocument,
		type BrochureTemplateVersion
	} from './brochureTemplates';
	import { computeHtmlDiff, type DiffResult } from './htmlDiff';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	let {
		slug,
		title = 'Brochure',
		currentHtml = '',
		currentCss = '',
		currentJs = '',
		open = $bindable(false),
		onRestore,
		onVersionChange
	}: {
		slug: string;
		title?: string;
		currentHtml?: string;
		currentCss?: string;
		currentJs?: string;
		open?: boolean;
		onRestore?: (version: BrochureTemplateVersion) => void;
		onVersionChange?: (count: number) => void;
	} = $props();

	type ViewTab = 'list' | 'diff' | 'preview';
	let activeViewTab = $state<ViewTab>('list');

	let versions = $state<BrochureTemplateVersion[]>([]);
	let isLoading = $state(true);
	let isSavingSnapshot = $state(false);
	let snapshotLabel = $state('');

	// Selected version for diff/preview
	let selectedVersion = $state<BrochureTemplateVersion | null>(null);
	let diffResult = $state<DiffResult | null>(null);

	// Load versions whenever opened or slug changes
	$effect(() => {
		if (open && slug) {
			loadVersions();
		}
	});

	async function loadVersions() {
		isLoading = true;
		const res = await listBrochureTemplateVersions(slug);
		if (res.versions) {
			versions = res.versions;
			onVersionChange?.(versions.length);
		}
		isLoading = false;
	}

	async function handleCreateSnapshot() {
		const label = snapshotLabel.trim() || `Manual Snapshot (v${versions.length + 1})`;
		isSavingSnapshot = true;
		const res = await saveBrochureTemplateVersion({
			slug,
			html: currentHtml,
			css: currentCss,
			js: currentJs,
			label
		});
		isSavingSnapshot = false;

		if (res.error) {
			toastError(`Failed to save snapshot: ${res.error}`);
			return;
		}

		snapshotLabel = '';
		toastSuccess(`Snapshot "${label}" created successfully!`);
		await loadVersions();
	}

	function handleSelectForDiff(version: BrochureTemplateVersion) {
		selectedVersion = version;
		diffResult = computeHtmlDiff(version.html, currentHtml);
		activeViewTab = 'diff';
	}

	function handleSelectForPreview(version: BrochureTemplateVersion) {
		selectedVersion = version;
		activeViewTab = 'preview';
	}

	function handleRestore(version: BrochureTemplateVersion) {
		if (
			!confirm(
				`Restore ${version.label || 'Version ' + version.version_number}? Your current editor contents will be replaced with this version.`
			)
		) {
			return;
		}

		onRestore?.(version);
		toastSuccess(`Restored Version ${version.version_number} (${version.label})`);
		open = false;
	}

	async function handleDelete(version: BrochureTemplateVersion) {
		if (version.id.startsWith('baseline_')) {
			toastError('The baseline default version cannot be deleted');
			return;
		}

		if (!confirm(`Delete Version ${version.version_number} (${version.label})?`)) {
			return;
		}

		const res = await deleteBrochureTemplateVersion(version.id, slug);
		if (res.error) {
			toastError(`Failed to delete version: ${res.error}`);
			return;
		}

		toastSuccess('Version deleted');
		if (selectedVersion?.id === version.id) {
			selectedVersion = null;
			activeViewTab = 'list';
		}
		await loadVersions();
	}

	function copyHtml(text: string) {
		navigator.clipboard.writeText(text);
		toastSuccess('HTML copied to clipboard!');
	}

	function formatDate(iso: string): string {
		try {
			const d = new Date(iso);
			return d.toLocaleString([], {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}

	function timeAgo(iso: string): string {
		try {
			const diffMs = Date.now() - new Date(iso).getTime();
			const sec = Math.floor(diffMs / 1000);
			if (sec < 60) return 'Just now';
			const min = Math.floor(sec / 60);
			if (min < 60) return `${min}m ago`;
			const hrs = Math.floor(min / 60);
			if (hrs < 24) return `${hrs}h ago`;
			const days = Math.floor(hrs / 24);
			return `${days}d ago`;
		} catch {
			return '';
		}
	}

	let previewDoc = $derived(
		selectedVersion
			? buildBrochureHtmlDocument({
					title: `${title} - Version ${selectedVersion.version_number}`,
					html: selectedVersion.html,
					css: selectedVersion.css,
					js: selectedVersion.js
			  })
			: ''
	);
</script>

{#if open}
	<div
		class="version-backdrop"
		onclick={() => (open = false)}
		role="button"
		tabindex="0"
		aria-label="Close Version History backdrop"
	></div>

	<div
		class="version-modal"
		role="dialog"
		aria-labelledby="version-modal-title"
		tabindex="-1"
	>
		<!-- Header -->
		<header class="version-header">
			<div class="header-info">
				<div class="header-icon">🕒</div>
				<div>
					<h3 id="version-modal-title">Version History &middot; {title}</h3>
					<p class="header-subtitle">
						Track, compare HTML changes, and restore previous edits for this brochure.
					</p>
				</div>
			</div>

			<div class="header-actions">
				<div class="tab-pills" role="tablist">
					<button
						type="button"
						class={['pill-btn', { active: activeViewTab === 'list' }]}
						onclick={() => (activeViewTab = 'list')}
					>
						Versions ({versions.length})
					</button>
					{#if selectedVersion}
						<button
							type="button"
							class={['pill-btn', { active: activeViewTab === 'diff' }]}
							onclick={() => handleSelectForDiff(selectedVersion!)}
						>
							HTML Diff (v{selectedVersion.version_number})
						</button>
						<button
							type="button"
							class={['pill-btn', { active: activeViewTab === 'preview' }]}
							onclick={() => (activeViewTab = 'preview')}
						>
							Preview (v{selectedVersion.version_number})
						</button>
					{/if}
				</div>

				<button
					type="button"
					class="close-btn"
					onclick={() => (open = false)}
					aria-label="Close Version History modal"
				>
					&times;
				</button>
			</div>
		</header>

		<!-- Body -->
		<div class="version-body">
			<!-- Snapshot Bar -->
			<div class="snapshot-bar">
				<div class="snapshot-input-wrap">
					<input
						type="text"
						class="snapshot-input"
						placeholder="Add note for new version (e.g. Kaercher pricing update, revised layout)..."
						bind:value={snapshotLabel}
						onkeydown={(e) => {
							if (e.key === 'Enter') handleCreateSnapshot();
						}}
					/>
				</div>
				<button
					type="button"
					class="snapshot-btn"
					onclick={handleCreateSnapshot}
					disabled={isSavingSnapshot}
				>
					{isSavingSnapshot ? 'Saving...' : '+ Snapshot Current HTML'}
				</button>
			</div>

			<!-- Tab 1: Versions List -->
			{#if activeViewTab === 'list'}
				{#if isLoading}
					<div class="loading-state">
						<div class="spinner"></div>
						<span>Loading saved versions...</span>
					</div>
				{:else if versions.length === 0}
					<div class="empty-state">
						<span class="empty-icon">📁</span>
						<h4>No saved versions yet</h4>
						<p>Whenever you save your brochure edits or create a snapshot, versions will appear here.</p>
					</div>
				{:else}
					<div class="versions-table-wrap">
						<table class="versions-table">
							<thead>
								<tr>
									<th>Version</th>
									<th>Description / Label</th>
									<th>Saved At</th>
									<th>HTML Stats</th>
									<th class="text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each versions as ver (ver.id)}
									<tr class={['version-row', { selected: selectedVersion?.id === ver.id }]}>
										<td>
											<span class="ver-pill">v{ver.version_number}</span>
										</td>
										<td>
											<span class="ver-label">{ver.label || `Version ${ver.version_number}`}</span>
										</td>
										<td>
											<div class="date-cell">
												<span class="date-primary">{formatDate(ver.created_at)}</span>
												<span class="date-relative">{timeAgo(ver.created_at)}</span>
											</div>
										</td>
										<td>
											<span class="stat-badge">
												{ver.html.split('\n').length} lines &middot; {(ver.html.length / 1024).toFixed(1)} KB
											</span>
										</td>
										<td class="text-right">
											<div class="actions-group">
												<button
													type="button"
													class="action-btn preview-btn"
													onclick={() => handleSelectForPreview(ver)}
													title="Preview this version in sandboxed viewer"
												>
													👁️ Preview
												</button>
												<button
													type="button"
													class="action-btn diff-btn"
													onclick={() => handleSelectForDiff(ver)}
													title="Compare HTML differences against current editor"
												>
													↔️ Diff
												</button>
												<button
													type="button"
													class="action-btn copy-btn"
													onclick={() => copyHtml(ver.html)}
													title="Copy version HTML to clipboard"
												>
													📋 Copy
												</button>
												<button
													type="button"
													class="action-btn restore-btn"
													onclick={() => handleRestore(ver)}
													title="Restore this version into editor"
												>
													↺ Restore
												</button>
												{#if !ver.id.startsWith('baseline_')}
													<button
														type="button"
														class="action-btn delete-btn"
														onclick={() => handleDelete(ver)}
														title="Delete this version"
													>
														🗑️
													</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

			<!-- Tab 2: HTML Diff View -->
			{:else if activeViewTab === 'diff' && selectedVersion && diffResult}
				<div class="diff-view-container">
					<div class="diff-header-bar">
						<div class="diff-meta">
							<span class="diff-target-label">
								Comparing <strong>Version {selectedVersion.version_number}</strong> with <strong>Current Editor HTML</strong>
							</span>
							<span class="diff-badge add">+{diffResult.additions} lines</span>
							<span class="diff-badge del">-{diffResult.deletions} lines</span>
							<span class="diff-badge neutral">{diffResult.unchanged} unchanged</span>
						</div>
						<div class="diff-actions">
							<button
								type="button"
								class="btn-sm btn-secondary"
								onclick={() => (activeViewTab = 'list')}
							>
								&larr; Back to List
							</button>
							<button
								type="button"
								class="btn-sm btn-primary"
								onclick={() => handleRestore(selectedVersion!)}
							>
								↺ Restore v{selectedVersion.version_number}
							</button>
						</div>
					</div>

					<div class="diff-code-window">
						<pre class="diff-pre"><code>{#each diffResult.lines as line}<div class={['diff-line', line.type]}><span class="line-num old">{line.oldLineNo ?? ''}</span><span class="line-num new">{line.newLineNo ?? ''}</span><span class="line-prefix">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span><span class="line-text">{line.text}</span></div>{/each}</code></pre>
					</div>
				</div>

			<!-- Tab 3: Sandbox Preview -->
			{:else if activeViewTab === 'preview' && selectedVersion}
				<div class="preview-view-container">
					<div class="preview-header-bar">
						<div class="preview-meta">
							<span>Viewing <strong>v{selectedVersion.version_number} ({selectedVersion.label})</strong> rendered sandbox</span>
							<span class="preview-timestamp">{formatDate(selectedVersion.created_at)}</span>
						</div>
						<div class="preview-actions">
							<button
								type="button"
								class="btn-sm btn-secondary"
								onclick={() => (activeViewTab = 'list')}
							>
								&larr; Back to List
							</button>
							<button
								type="button"
								class="btn-sm btn-primary"
								onclick={() => handleRestore(selectedVersion!)}
							>
								↺ Restore v{selectedVersion.version_number} to Editor
							</button>
						</div>
					</div>

					<div class="preview-iframe-wrapper">
						<iframe
							srcdoc={previewDoc}
							title="Version Preview Sandbox"
							sandbox="allow-scripts allow-same-origin"
							class="preview-iframe"
						></iframe>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.version-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 31, 0.7);
		backdrop-filter: blur(3px);
		z-index: 10000;
	}

	.version-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90vw;
		max-width: 1200px;
		height: 85vh;
		background: #1e262f;
		color: #e2e8f0;
		border-radius: 12px;
		box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
		border: 1px solid #334155;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		z-index: 10001;
	}

	.version-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		background: #161d26;
		border-bottom: 1px solid #334155;
	}

	.header-info {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.header-icon {
		font-size: 24px;
		background: #232d3a;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #3b4758;
	}

	.header-info h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #f8fafc;
	}

	.header-subtitle {
		margin: 2px 0 0;
		font-size: 13px;
		color: #94a3b8;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.tab-pills {
		display: flex;
		background: #0f1720;
		padding: 3px;
		border-radius: 8px;
		border: 1px solid #2d3748;
		gap: 2px;
	}

	.pill-btn {
		background: transparent;
		color: #94a3b8;
		border: none;
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pill-btn:hover {
		color: #f1f5f9;
	}

	.pill-btn.active {
		background: #2f6f2f;
		color: #ffffff;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		font-size: 26px;
		cursor: pointer;
		line-height: 1;
		padding: 4px 8px;
		border-radius: 6px;
	}

	.close-btn:hover {
		color: #ffffff;
		background: #2d3748;
	}

	.version-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #18202a;
	}

	.snapshot-bar {
		display: flex;
		gap: 12px;
		padding: 12px 24px;
		background: #141b24;
		border-bottom: 1px solid #2b3646;
		align-items: center;
	}

	.snapshot-input-wrap {
		flex: 1;
	}

	.snapshot-input {
		width: 100%;
		background: #0f151d;
		border: 1px solid #334155;
		color: #f8fafc;
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 13px;
		outline: none;
		transition: border-color 0.15s;
	}

	.snapshot-input:focus {
		border-color: #78be20;
	}

	.snapshot-btn {
		background: #2f6f2f;
		color: #ffffff;
		border: none;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.snapshot-btn:hover:not(:disabled) {
		background: #255825;
	}

	.snapshot-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Loading & Empty states */
	.loading-state,
	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
		gap: 12px;
		padding: 40px;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #334155;
		border-top-color: #78be20;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-icon {
		font-size: 40px;
	}

	.empty-state h4 {
		margin: 0;
		font-size: 16px;
		color: #e2e8f0;
	}

	.empty-state p {
		margin: 0;
		font-size: 13px;
		max-width: 400px;
		text-align: center;
	}

	/* Versions Table */
	.versions-table-wrap {
		flex: 1;
		overflow-y: auto;
		padding: 16px 24px;
	}

	.versions-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.versions-table th {
		text-align: left;
		padding: 10px 14px;
		color: #94a3b8;
		font-weight: 600;
		border-bottom: 1px solid #334155;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.versions-table td {
		padding: 12px 14px;
		border-bottom: 1px solid #283240;
		vertical-align: middle;
	}

	.version-row:hover {
		background: #232c38;
	}

	.version-row.selected {
		background: #253342;
	}

	.ver-pill {
		display: inline-block;
		background: #1a3820;
		color: #78be20;
		border: 1px solid #2f6f2f;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 6px;
		font-size: 12px;
	}

	.ver-label {
		font-weight: 500;
		color: #f1f5f9;
	}

	.date-cell {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.date-primary {
		color: #cbd5e1;
		font-size: 13px;
	}

	.date-relative {
		color: #64748b;
		font-size: 11px;
	}

	.stat-badge {
		color: #94a3b8;
		font-size: 12px;
		background: #141b24;
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid #2d3848;
	}

	.text-right {
		text-align: right;
	}

	.actions-group {
		display: inline-flex;
		gap: 6px;
	}

	.action-btn {
		background: #232d3a;
		border: 1px solid #3b4758;
		color: #cbd5e1;
		padding: 5px 10px;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: #2f3b4c;
		color: #ffffff;
		border-color: #4b5a6f;
	}

	.restore-btn {
		background: #234d28;
		border-color: #2f6f2f;
		color: #8ae032;
		font-weight: 600;
	}

	.restore-btn:hover {
		background: #2f6f2f;
		color: #ffffff;
	}

	.delete-btn {
		background: transparent;
		border-color: transparent;
		color: #94a3b8;
		padding: 5px 8px;
	}

	.delete-btn:hover {
		background: #451a1a;
		color: #f87171;
		border-color: #7f1d1d;
	}

	/* Diff View */
	.diff-view-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.diff-header-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 20px;
		background: #141c26;
		border-bottom: 1px solid #2b3646;
	}

	.diff-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
	}

	.diff-target-label {
		color: #cbd5e1;
	}

	.diff-badge {
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}

	.diff-badge.add {
		background: #143818;
		color: #4ade80;
		border: 1px solid #225429;
	}

	.diff-badge.del {
		background: #3e1818;
		color: #f87171;
		border: 1px solid #632424;
	}

	.diff-badge.neutral {
		background: #1e2632;
		color: #94a3b8;
	}

	.diff-actions {
		display: flex;
		gap: 8px;
	}

	.btn-sm {
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		border: none;
	}

	.btn-secondary {
		background: #2a3544;
		color: #e2e8f0;
	}

	.btn-secondary:hover {
		background: #364457;
	}

	.btn-primary {
		background: #2f6f2f;
		color: #ffffff;
	}

	.btn-primary:hover {
		background: #255825;
	}

	.diff-code-window {
		flex: 1;
		overflow: auto;
		background: #0f141c;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 12px;
		line-height: 1.5;
	}

	.diff-pre {
		margin: 0;
		padding: 8px 0;
	}

	.diff-line {
		display: flex;
		align-items: flex-start;
		padding: 1px 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.diff-line.added {
		background: rgba(34, 197, 94, 0.15);
		color: #86efac;
	}

	.diff-line.removed {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
	}

	.diff-line.unchanged {
		color: #94a3b8;
	}

	.line-num {
		display: inline-block;
		width: 44px;
		text-align: right;
		padding-right: 8px;
		color: #475569;
		user-select: none;
		flex-shrink: 0;
	}

	.line-prefix {
		width: 18px;
		text-align: center;
		flex-shrink: 0;
		font-weight: bold;
		user-select: none;
	}

	.diff-line.added .line-prefix {
		color: #4ade80;
	}

	.diff-line.removed .line-prefix {
		color: #f87171;
	}

	.line-text {
		flex: 1;
		padding-right: 16px;
	}

	/* Preview View */
	.preview-view-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.preview-header-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 20px;
		background: #141c26;
		border-bottom: 1px solid #2b3646;
	}

	.preview-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		color: #cbd5e1;
	}

	.preview-timestamp {
		color: #64748b;
		font-size: 12px;
	}

	.preview-actions {
		display: flex;
		gap: 8px;
	}

	.preview-iframe-wrapper {
		flex: 1;
		background: #d8dcd5;
		overflow: hidden;
	}

	.preview-iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
</style>
