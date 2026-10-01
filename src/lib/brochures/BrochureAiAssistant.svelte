<script lang="ts">
	import {
		askDeepSeekBrochure,
		testDeepSeekConnection,
		getStoredDeepSeekApiKey,
		setStoredDeepSeekApiKey,
		getStoredDeepSeekModel,
		setStoredDeepSeekModel,
		getStoredDeepSeekTemperature,
		setStoredDeepSeekTemperature,
		type DeepSeekMessage,
		type ExtractedCodeChanges
	} from './deepseek';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	let {
		title = 'Brochure',
		slug = 'brochure',
		htmlContent = $bindable(''),
		cssContent = $bindable(''),
		jsContent = $bindable(''),
		open = $bindable(true),
		onApply
	}: {
		title: string;
		slug: string;
		htmlContent: string;
		cssContent: string;
		jsContent: string;
		open?: boolean;
		onApply?: (changes: { html?: string; css?: string; js?: string }) => void;
	} = $props();

	interface ChatItem {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		extracted?: ExtractedCodeChanges;
		applied?: boolean;
		timestamp: Date;
	}

	interface UndoSnapshot {
		html: string;
		css: string;
		js: string;
		description: string;
	}

	let messages = $state<ChatItem[]>([]);
	let userInput = $state('');
	let isLoading = $state(false);
	let includeCode = $state(true);
	let showSettingsModal = $state(false);
	let activeCodePreview = $state<Record<string, 'html' | 'css' | 'js' | null>>({});

	// Settings state
	let apiKey = $state(getStoredDeepSeekApiKey());
	let model = $state(getStoredDeepSeekModel());
	let temperature = $state(getStoredDeepSeekTemperature());
	let testStatus = $state<{ loading: boolean; ok?: boolean; message?: string } | null>(null);

	// Undo stack
	let undoHistory = $state<UndoSnapshot[]>([]);

	let hasKey = $derived(Boolean(apiKey.trim()));

	const QUICK_PROMPTS = [
		{
			label: '🎨 Modern Brand Colors',
			prompt: 'Update the CSS color scheme to modern RapidClean branding with vibrant green (#78be20), deep forest (#2f6f2f), and clean neutral cards.'
		},
		{
			label: '✨ Polish Copywriting',
			prompt: 'Review and polish all marketing headlines, bullet points, and subheadings in the HTML for punchy, professional B2B tone.'
		},
		{
			label: '📦 Add 3-Column Service Grid',
			prompt: 'Add a modern 3-column service feature cards section to the HTML with icons, bold titles, and concise benefit descriptions, styled in CSS.'
		},
		{
			label: '🖨️ Fix Print & Page Breaks',
			prompt: 'Ensure all pages have proper A4 page break rules, exact print margins, and zero clipping or overflow during PDF export.'
		},
		{
			label: '📞 Modern Contact Bar',
			prompt: 'Restyle the contact information sections into clean pill cards with call, email, and location icons.'
		}
	];

	async function handleSend(customPrompt?: string) {
		const text = (customPrompt || userInput).trim();
		if (!text) return;

		if (!hasKey) {
			showSettingsModal = true;
			toastError('Please enter your DeepSeek API key to continue');
			return;
		}

		const userMsg: ChatItem = {
			id: Math.random().toString(36).slice(2),
			role: 'user',
			content: text,
			timestamp: new Date()
		};

		messages = [...messages, userMsg];
		if (!customPrompt) userInput = '';
		isLoading = true;

		// Build conversation history for DeepSeek
		const historyForApi: DeepSeekMessage[] = messages.slice(-6).map((m) => ({
			role: m.role,
			content: m.content
		}));

		const res = await askDeepSeekBrochure({
			prompt: text,
			history: historyForApi,
			currentHtml: htmlContent,
			currentCss: cssContent,
			currentJs: jsContent,
			brochureTitle: title,
			brochureSlug: slug,
			includeCodeContext: includeCode,
			config: {
				apiKey: apiKey.trim(),
				model,
				temperature
			}
		});

		isLoading = false;

		if (res.error) {
			toastError(res.error);
			messages = [
				...messages,
				{
					id: Math.random().toString(36).slice(2),
					role: 'assistant',
					content: `⚠️ **Error communicating with DeepSeek:**\n\n${res.error}\n\nPlease check your API key in settings or try again.`,
					timestamp: new Date()
				}
			];
			return;
		}

		const assistantMsg: ChatItem = {
			id: Math.random().toString(36).slice(2),
			role: 'assistant',
			content: res.extracted.explanation || res.reply,
			extracted: res.extracted,
			applied: false,
			timestamp: new Date()
		};

		messages = [...messages, assistantMsg];
	}

	function handleApplyChanges(item: ChatItem, target: 'all' | 'html' | 'css' | 'js' = 'all') {
		if (!item.extracted) return;

		// Save current state to undo history
		undoHistory.push({
			html: htmlContent,
			css: cssContent,
			js: jsContent,
			description: item.content.slice(0, 40)
		});

		const appliedParts: string[] = [];

		if ((target === 'all' || target === 'html') && item.extracted.html !== undefined) {
			htmlContent = item.extracted.html;
			appliedParts.push('HTML');
		}

		if ((target === 'all' || target === 'css') && item.extracted.css !== undefined) {
			cssContent = item.extracted.css;
			appliedParts.push('CSS');
		}

		if ((target === 'all' || target === 'js') && item.extracted.js !== undefined) {
			jsContent = item.extracted.js;
			appliedParts.push('JS');
		}

		item.applied = true;
		onApply?.({
			html: target === 'all' || target === 'html' ? item.extracted.html : undefined,
			css: target === 'all' || target === 'css' ? item.extracted.css : undefined,
			js: target === 'all' || target === 'js' ? item.extracted.js : undefined
		});

		toastSuccess(`Applied ${appliedParts.join(', ')} to brochure code!`);
	}

	function handleUndo() {
		const prev = undoHistory.pop();
		if (!prev) return;

		htmlContent = prev.html;
		cssContent = prev.css;
		jsContent = prev.js;

		onApply?.({ html: prev.html, css: prev.css, js: prev.js });
		toastSuccess('Reverted last AI edit');
	}

	function saveSettings() {
		setStoredDeepSeekApiKey(apiKey.trim());
		setStoredDeepSeekModel(model);
		setStoredDeepSeekTemperature(temperature);
		showSettingsModal = false;
		toastSuccess('DeepSeek settings saved');
	}

	async function testConnection() {
		testStatus = { loading: true };
		const result = await testDeepSeekConnection(apiKey.trim(), model);
		testStatus = {
			loading: false,
			ok: result.ok,
			message: result.message
		};
	}

	function togglePreviewCode(msgId: string, lang: 'html' | 'css' | 'js') {
		if (activeCodePreview[msgId] === lang) {
			activeCodePreview[msgId] = null;
		} else {
			activeCodePreview[msgId] = lang;
		}
	}

	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		toastSuccess(`Copied ${label} to clipboard!`);
	}
</script>

{#if open}
	<div class="ai-assistant-panel">
		<!-- Panel Header -->
		<header class="ai-header">
			<div class="ai-header-left">
				<div class="ai-logo-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
						<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</div>
				<div>
					<h3 class="ai-title">DeepSeek AI Assistant</h3>
					<span class="ai-subtitle">
						{#if hasKey}
							<span class="status-dot online"></span> {model}
						{:else}
							<span class="status-dot offline"></span> No API Key
						{/if}
					</span>
				</div>
			</div>

			<div class="ai-header-right">
				{#if undoHistory.length > 0}
					<button
						type="button"
						class="ai-action-btn undo-btn"
						onclick={handleUndo}
						title="Undo last AI modification"
					>
						↩️ Undo ({undoHistory.length})
					</button>
				{/if}

				<button
					type="button"
					class="ai-action-btn"
					onclick={() => (showSettingsModal = true)}
					title="DeepSeek API Settings"
				>
					⚙️ Settings
				</button>

				{#if messages.length > 0}
					<button
						type="button"
						class="ai-action-btn"
						onclick={() => (messages = [])}
						title="Clear chat history"
					>
						Clear
					</button>
				{/if}

				<button
					type="button"
					class="ai-close-btn"
					onclick={() => (open = false)}
					title="Close AI Assistant"
				>
					&times;
				</button>
			</div>
		</header>

		<!-- No API Key Alert Banner -->
		{#if !hasKey}
			<div class="api-key-banner">
				<div>
					<strong>DeepSeek API Key Required</strong>
					<p>Enter your API key to let DeepSeek modify HTML, CSS, and JS code.</p>
				</div>
				<button type="button" class="banner-btn" onclick={() => (showSettingsModal = true)}>
					Configure Key
				</button>
			</div>
		{/if}

		<!-- Quick Actions / Suggestions -->
		<div class="quick-prompts-bar">
			<span class="quick-title">Quick Actions:</span>
			<div class="quick-chips">
				{#each QUICK_PROMPTS as qp}
					<button
						type="button"
						class="quick-chip"
						disabled={isLoading}
						onclick={() => handleSend(qp.prompt)}
					>
						{qp.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Chat Messages Scroll Area -->
		<div class="ai-messages">
			{#if messages.length === 0}
				<div class="empty-state">
					<div class="empty-icon">🤖</div>
					<h4>Ask DeepSeek to edit this brochure</h4>
					<p>
						You can prompt DeepSeek to modify the layout, update brand colors, add service grids, fix print margins, or polish content.
					</p>
					<div class="example-box">
						<span>Example Prompts:</span>
						<code>"Add a 3-column guarantee card on page 2"</code>
						<code>"Change primary color to Navy #1e3a8a"</code>
						<code>"Update contact email and phone on all pages"</code>
					</div>
				</div>
			{/if}

			{#each messages as msg}
				<div class={['message-bubble', msg.role]}>
					<div class="message-meta">
						<span class="role-name">{msg.role === 'user' ? 'You' : 'DeepSeek'}</span>
						<span class="timestamp">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
					</div>

					<div class="message-content">
						{msg.content}
					</div>

					<!-- Code Changes Proposal Card -->
					{#if msg.extracted?.hasChanges}
						<div class="code-proposal-card">
							<div class="proposal-header">
								<span class="proposal-title">⚡ Suggested Code Updates</span>
								<div class="proposal-badges">
									{#if msg.extracted.html !== undefined}
										<span class="lang-badge html">HTML ({msg.extracted.html.split('\n').length}L)</span>
									{/if}
									{#if msg.extracted.css !== undefined}
										<span class="lang-badge css">CSS ({msg.extracted.css.split('\n').length}L)</span>
									{/if}
									{#if msg.extracted.js !== undefined}
										<span class="lang-badge js">JS ({msg.extracted.js.split('\n').length}L)</span>
									{/if}
								</div>
							</div>

							<div class="proposal-actions">
								<button
									type="button"
									class="apply-btn primary"
									disabled={msg.applied}
									onclick={() => handleApplyChanges(msg, 'all')}
								>
									{msg.applied ? '✓ Changes Applied' : 'Apply All to Editor'}
								</button>

								{#if msg.extracted.html !== undefined}
									<button
										type="button"
										class="apply-btn secondary"
										onclick={() => togglePreviewCode(msg.id, 'html')}
									>
										{activeCodePreview[msg.id] === 'html' ? 'Hide HTML' : 'View HTML'}
									</button>
								{/if}

								{#if msg.extracted.css !== undefined}
									<button
										type="button"
										class="apply-btn secondary"
										onclick={() => togglePreviewCode(msg.id, 'css')}
									>
										{activeCodePreview[msg.id] === 'css' ? 'Hide CSS' : 'View CSS'}
									</button>
								{/if}

								{#if msg.extracted.js !== undefined}
									<button
										type="button"
										class="apply-btn secondary"
										onclick={() => togglePreviewCode(msg.id, 'js')}
									>
										{activeCodePreview[msg.id] === 'js' ? 'Hide JS' : 'View JS'}
									</button>
								{/if}
							</div>

							<!-- Code Inspection Area -->
							{#if activeCodePreview[msg.id]}
								{@const previewLang = activeCodePreview[msg.id]}
								<div class="code-preview-pane">
									<div class="code-preview-toolbar">
										<span>{previewLang?.toUpperCase()} Snippet</span>
										<div class="code-preview-actions">
											<button
												type="button"
												class="copy-btn"
												onclick={() => {
													const text =
														previewLang === 'html'
															? msg.extracted?.html || ''
															: previewLang === 'css'
																? msg.extracted?.css || ''
																: msg.extracted?.js || '';
													copyToClipboard(text, previewLang || '');
												}}
											>
												Copy Code
											</button>
											<button
												type="button"
												class="apply-snippet-btn"
												onclick={() => handleApplyChanges(msg, previewLang || 'all')}
											>
												Apply {previewLang?.toUpperCase()}
											</button>
										</div>
									</div>
									<pre class="code-block"><code>{previewLang === 'html' ? msg.extracted.html : previewLang === 'css' ? msg.extracted.css : msg.extracted.js}</code></pre>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			{#if isLoading}
				<div class="loading-indicator">
					<div class="spinner"></div>
					<span>DeepSeek is analyzing brochure code and generating updates...</span>
				</div>
			{/if}
		</div>

		<!-- Footer Input -->
		<footer class="ai-footer">
			<div class="footer-options">
				<label class="context-checkbox" title="Passes current HTML, CSS, and JS to DeepSeek for context-aware changes">
					<input type="checkbox" bind:checked={includeCode} />
					<span>Send current brochure code ({htmlContent.split('\n').length + cssContent.split('\n').length} lines)</span>
				</label>
			</div>

			<div class="input-row">
				<textarea
					class="prompt-input"
					bind:value={userInput}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							handleSend();
						}
					}}
					placeholder="Describe what you want DeepSeek to change (e.g. 'Add a customer testimonial section on page 3')..."
					rows="2"
					disabled={isLoading}
				></textarea>

				<button
					type="button"
					class="send-btn"
					disabled={isLoading || !userInput.trim()}
					onclick={() => handleSend()}
					title="Send prompt to DeepSeek"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
						<path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</footer>
	</div>
{/if}

<!-- DeepSeek Settings Modal -->
{#if showSettingsModal}
	<div
		class="settings-modal-backdrop"
		onclick={() => (showSettingsModal = false)}
		role="button"
		tabindex="0"
		aria-label="Close modal"
	></div>

	<div class="settings-modal" role="dialog" aria-labelledby="deepseek-settings-title">
		<header class="settings-modal-header">
			<div class="modal-title-group">
				<span class="ai-badge">DeepSeek AI</span>
				<h3 id="deepseek-settings-title">API Configuration</h3>
			</div>
			<button
				type="button"
				class="close-modal-btn"
				onclick={() => (showSettingsModal = false)}
			>
				&times;
			</button>
		</header>

		<div class="settings-modal-body">
			<div class="form-group">
				<label for="ds-api-key">DeepSeek API Key</label>
				<input
					id="ds-api-key"
					type="password"
					bind:value={apiKey}
					placeholder="sk-..."
					class="settings-input"
					autocomplete="off"
				/>
				<p class="field-hint">
					Your key is saved locally in your browser and used securely for brochure generation.
					Get a key from <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer">platform.deepseek.com</a>.
				</p>
			</div>

			<div class="form-group">
				<label for="ds-model">Model</label>
				<select id="ds-model" bind:value={model} class="settings-select">
					<option value="deepseek-chat">deepseek-chat (DeepSeek-V3 · Fast, Recommended)</option>
					<option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1 · Deep Reasoning)</option>
				</select>
			</div>

			<div class="form-group">
				<div class="label-row">
					<label for="ds-temp">Temperature: {temperature}</label>
					<span class="hint-small">0.0 (Strict code) to 0.7 (Creative design)</span>
				</div>
				<input
					id="ds-temp"
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={temperature}
					class="settings-slider"
				/>
			</div>

			{#if testStatus}
				<div class={['test-status-box', { ok: testStatus.ok, error: !testStatus.ok }]}>
					{#if testStatus.loading}
						<span class="spinner-small"></span> Testing connection to DeepSeek API...
					{:else if testStatus.ok}
						<span>✅ {testStatus.message}</span>
					{:else}
						<span>❌ {testStatus.message}</span>
					{/if}
				</div>
			{/if}
		</div>

		<footer class="settings-modal-footer">
			<button
				type="button"
				class="test-btn"
				onclick={testConnection}
				disabled={testStatus?.loading || !apiKey.trim()}
			>
				Test Connection
			</button>
			<div class="modal-footer-right">
				<button type="button" class="btn-cancel" onclick={() => (showSettingsModal = false)}>
					Cancel
				</button>
				<button type="button" class="btn-save-key" onclick={saveSettings}>
					Save Settings
				</button>
			</div>
		</footer>
	</div>
{/if}

<style>
	.ai-assistant-panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background: #18181b;
		border-left: 1px solid #27272a;
		color: #e4e4e7;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		min-width: 320px;
	}

	.ai-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: #202023;
		border-bottom: 1px solid #2e2e33;
		gap: 8px;
	}

	.ai-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ai-logo-icon {
		width: 26px;
		height: 26px;
		border-radius: 6px;
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}

	.ai-title {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: #f4f4f5;
	}

	.ai-subtitle {
		font-size: 10px;
		color: #a1a1aa;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.status-dot.online {
		background: #78be20;
		box-shadow: 0 0 6px #78be20;
	}

	.status-dot.offline {
		background: #e11d48;
	}

	.ai-header-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ai-action-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #d4d4d8;
		font-size: 11px;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.ai-action-btn:hover {
		background: #3f3f46;
		color: #fff;
	}

	.undo-btn {
		background: #312e81;
		border-color: #4338ca;
		color: #c7d2fe;
		font-weight: 600;
	}

	.undo-btn:hover {
		background: #3730a3;
		color: #ffffff;
	}

	.ai-close-btn {
		background: transparent;
		border: none;
		color: #a1a1aa;
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
		padding: 0 4px;
	}

	.ai-close-btn:hover {
		color: #fff;
	}

	.api-key-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: #451a1a;
		border-bottom: 1px solid #7f1d1d;
		color: #fecaca;
		font-size: 11px;
		gap: 8px;
	}

	.api-key-banner strong {
		display: block;
		font-size: 12px;
		color: #fff;
	}

	.api-key-banner p {
		margin: 2px 0 0;
		font-size: 10.5px;
		color: #fca5a5;
	}

	.banner-btn {
		background: #ef4444;
		border: none;
		color: #ffffff;
		font-size: 11px;
		font-weight: 700;
		padding: 5px 10px;
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
	}

	.banner-btn:hover {
		background: #dc2626;
	}

	.quick-prompts-bar {
		padding: 8px 12px;
		background: #1c1c1f;
		border-bottom: 1px solid #27272a;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.quick-title {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #71717a;
	}

	.quick-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.quick-chip {
		background: #27272a;
		border: 1px solid #38383e;
		color: #a1a1aa;
		font-size: 10.5px;
		padding: 3px 8px;
		border-radius: 999px;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.quick-chip:hover:not(:disabled) {
		background: #333338;
		color: #78be20;
		border-color: #78be20;
	}

	.quick-chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ai-messages {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty-state {
		text-align: center;
		padding: 24px 14px;
		color: #71717a;
	}

	.empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
	}

	.empty-state h4 {
		margin: 0 0 6px;
		font-size: 14px;
		color: #e4e4e7;
	}

	.empty-state p {
		margin: 0 0 16px;
		font-size: 11.5px;
		line-height: 1.4;
	}

	.example-box {
		background: #202023;
		border: 1px solid #2e2e33;
		border-radius: 8px;
		padding: 10px;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.example-box span {
		font-size: 10.5px;
		font-weight: 700;
		color: #a1a1aa;
	}

	.example-box code {
		font-size: 11px;
		color: #9cdcfe;
		font-family: monospace;
	}

	.message-bubble {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 96%;
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.message-bubble.user {
		align-self: flex-end;
	}

	.message-bubble.assistant {
		align-self: flex-start;
		width: 100%;
	}

	.message-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: #71717a;
		padding: 0 4px;
	}

	.message-bubble.user .message-meta {
		justify-content: flex-end;
	}

	.role-name {
		font-weight: 700;
	}

	.message-content {
		padding: 9px 12px;
		border-radius: 8px;
		font-size: 12px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.message-bubble.user .message-content {
		background: #2f6f2f;
		color: #ffffff;
		border-bottom-right-radius: 2px;
	}

	.message-bubble.assistant .message-content {
		background: #202023;
		border: 1px solid #2e2e33;
		color: #d4d4d8;
		border-bottom-left-radius: 2px;
	}

	.code-proposal-card {
		margin-top: 6px;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.proposal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 6px;
	}

	.proposal-title {
		font-size: 11.5px;
		font-weight: 700;
		color: #78be20;
	}

	.proposal-badges {
		display: flex;
		gap: 4px;
	}

	.lang-badge {
		font-size: 9.5px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.lang-badge.html { background: #e34f26; color: #fff; }
	.lang-badge.css { background: #1572b6; color: #fff; }
	.lang-badge.js { background: #f7df1e; color: #000; }

	.proposal-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.apply-btn {
		font-size: 11px;
		font-weight: 700;
		padding: 5px 12px;
		border-radius: 4px;
		cursor: pointer;
		border: none;
		transition: all 0.15s;
	}

	.apply-btn.primary {
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		color: #fff;
		flex: 1;
		min-width: 140px;
	}

	.apply-btn.primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.apply-btn.primary:disabled {
		background: #27272a;
		color: #71717a;
		cursor: not-allowed;
	}

	.apply-btn.secondary {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #d4d4d8;
	}

	.apply-btn.secondary:hover {
		background: #3f3f46;
		color: #fff;
	}

	.code-preview-pane {
		background: #111113;
		border: 1px solid #27272a;
		border-radius: 6px;
		overflow: hidden;
		max-height: 220px;
		display: flex;
		flex-direction: column;
	}

	.code-preview-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		background: #1c1c1f;
		border-bottom: 1px solid #27272a;
		font-size: 10px;
		color: #9cdcfe;
	}

	.code-preview-actions {
		display: flex;
		gap: 5px;
	}

	.copy-btn,
	.apply-snippet-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #d4d4d8;
		font-size: 9.5px;
		padding: 2px 6px;
		border-radius: 3px;
		cursor: pointer;
	}

	.apply-snippet-btn {
		background: #2f6f2f;
		border-color: #78be20;
		color: #fff;
		font-weight: 600;
	}

	.code-block {
		margin: 0;
		padding: 8px;
		overflow: auto;
		font-family: 'Consolas', monospace;
		font-size: 11px;
		line-height: 1.4;
		color: #d4d4d4;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: #202023;
		border-radius: 8px;
		font-size: 11.5px;
		color: #78be20;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(120, 190, 32, 0.2);
		border-top-color: #78be20;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	.spinner-small {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.ai-footer {
		padding: 10px 12px;
		background: #202023;
		border-top: 1px solid #2e2e33;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.footer-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.context-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10.5px;
		color: #a1a1aa;
		cursor: pointer;
	}

	.context-checkbox input {
		accent-color: #78be20;
		cursor: pointer;
	}

	.input-row {
		display: flex;
		gap: 6px;
		align-items: flex-end;
	}

	.prompt-input {
		flex: 1;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		color: #f4f4f5;
		font-family: inherit;
		font-size: 12px;
		line-height: 1.4;
		padding: 8px 10px;
		resize: none;
		outline: none;
		transition: border-color 0.15s;
	}

	.prompt-input:focus {
		border-color: #78be20;
	}

	.send-btn {
		width: 34px;
		height: 34px;
		border-radius: 6px;
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		border: none;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: filter 0.15s;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Settings Modal */
	.settings-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(10, 10, 12, 0.7);
		backdrop-filter: blur(2px);
		z-index: 10000;
	}

	.settings-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 480px;
		max-width: 92vw;
		background: #1f1f23;
		border: 1px solid #333338;
		border-radius: 12px;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
		z-index: 10001;
		color: #e4e4e7;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.settings-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		background: #25252a;
		border-bottom: 1px solid #333338;
	}

	.modal-title-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ai-badge {
		font-size: 10.5px;
		font-weight: 800;
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		color: #fff;
		padding: 2px 7px;
		border-radius: 4px;
	}

	.settings-modal-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		color: #fff;
	}

	.close-modal-btn {
		background: none;
		border: none;
		color: #a1a1aa;
		font-size: 22px;
		cursor: pointer;
		line-height: 1;
	}

	.close-modal-btn:hover {
		color: #fff;
	}

	.settings-modal-body {
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-group label {
		font-size: 12px;
		font-weight: 600;
		color: #d4d4d8;
	}

	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.hint-small {
		font-size: 10.5px;
		color: #71717a;
	}

	.settings-input,
	.settings-select {
		background: #141416;
		border: 1px solid #38383e;
		border-radius: 6px;
		color: #fff;
		font-size: 13px;
		padding: 8px 10px;
		outline: none;
	}

	.settings-input:focus,
	.settings-select:focus {
		border-color: #78be20;
	}

	.field-hint {
		margin: 2px 0 0;
		font-size: 11px;
		color: #71717a;
		line-height: 1.4;
	}

	.field-hint a {
		color: #78be20;
		text-decoration: underline;
	}

	.settings-slider {
		accent-color: #78be20;
		cursor: pointer;
	}

	.test-status-box {
		padding: 10px;
		border-radius: 6px;
		font-size: 11.5px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.test-status-box.ok {
		background: #14532d25;
		border: 1px solid #22c55e50;
		color: #4ade80;
	}

	.test-status-box.error {
		background: #7f1d1d25;
		border: 1px solid #ef444450;
		color: #f87171;
	}

	.settings-modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 18px;
		background: #25252a;
		border-top: 1px solid #333338;
	}

	.test-btn {
		background: #27272a;
		border: 1px solid #3f3f46;
		color: #d4d4d8;
		font-size: 11.5px;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 6px;
		cursor: pointer;
	}

	.test-btn:hover:not(:disabled) {
		background: #3f3f46;
		color: #fff;
	}

	.test-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-footer-right {
		display: flex;
		gap: 8px;
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

	.btn-save-key {
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		border: none;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		padding: 6px 16px;
		border-radius: 6px;
		cursor: pointer;
	}

	.btn-save-key:hover {
		filter: brightness(1.08);
	}
</style>
