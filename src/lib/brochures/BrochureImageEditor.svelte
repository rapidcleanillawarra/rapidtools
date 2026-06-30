<script lang="ts">
	import {
		uploadBrochureImage,
		setBrochureImageUrl,
		resetBrochureImage,
		type BrochureImageSlot
	} from './brochureImages';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	let {
		slug,
		slots,
		images = $bindable(),
		open = $bindable(false)
	}: {
		slug: string;
		slots: BrochureImageSlot[];
		images: Record<string, string>;
		open?: boolean;
	} = $props();

	let busyKey = $state<string | null>(null);
	let linkInputs = $state<Record<string, string>>({});

	function currentUrl(slot: BrochureImageSlot): string {
		return images[slot.key] ?? slot.defaultUrl;
	}

	async function handleUpload(slot: BrochureImageSlot, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		busyKey = slot.key;
		const { url, error } = await uploadBrochureImage(slug, slot.key, file);
		busyKey = null;
		input.value = '';

		if (error || !url) {
			toastError(`Upload failed: ${error ?? 'unknown error'}`);
			return;
		}
		images = { ...images, [slot.key]: url };
		toastSuccess(`${slot.label} updated`);
	}

	async function handleApplyLink(slot: BrochureImageSlot) {
		const value = (linkInputs[slot.key] ?? '').trim();
		if (!value) {
			toastError('Please paste an image link first');
			return;
		}
		if (!/^https?:\/\//i.test(value)) {
			toastError('Link must start with http:// or https://');
			return;
		}

		busyKey = slot.key;
		const { error } = await setBrochureImageUrl(slug, slot.key, value);
		busyKey = null;

		if (error) {
			toastError(`Could not save link: ${error}`);
			return;
		}
		images = { ...images, [slot.key]: value };
		linkInputs = { ...linkInputs, [slot.key]: '' };
		toastSuccess(`${slot.label} updated`);
	}

	async function handleReset(slot: BrochureImageSlot) {
		busyKey = slot.key;
		const { error } = await resetBrochureImage(slug, slot.key);
		busyKey = null;

		if (error) {
			toastError(`Could not reset: ${error}`);
			return;
		}
		const next = { ...images };
		delete next[slot.key];
		images = next;
		toastSuccess(`${slot.label} reset to default`);
	}
</script>

{#if open}
	<div class="editor-backdrop" onclick={() => (open = false)} aria-hidden="true"></div>

	<aside class="editor-drawer" aria-label="Edit brochure images">
		<header class="editor-head">
			<div>
				<h2>Edit images</h2>
				<p>Upload a file or paste a link. Changes save automatically.</p>
			</div>
			<button type="button" class="close-btn" onclick={() => (open = false)} aria-label="Close editor"
				>&times;</button
			>
		</header>

		<div class="editor-body">
			{#each slots as slot (slot.key)}
				<section class="slot" class:busy={busyKey === slot.key}>
					<div class="slot-preview">
						<img src={currentUrl(slot)} alt={slot.label} loading="lazy" />
					</div>

					<div class="slot-main">
						<div class="slot-title">
							<strong>{slot.label}</strong>
							{#if images[slot.key]}<span class="badge">Custom</span>{/if}
						</div>
						{#if slot.hint}<p class="slot-hint">{slot.hint}</p>{/if}

						<div class="slot-actions">
							<label class="file-btn">
								Upload
								<input
									type="file"
									accept="image/*"
									disabled={busyKey === slot.key}
									onchange={(e) => handleUpload(slot, e)}
								/>
							</label>
							{#if images[slot.key]}
								<button
									type="button"
									class="reset-btn"
									disabled={busyKey === slot.key}
									onclick={() => handleReset(slot)}>Reset</button
								>
							{/if}
						</div>

						<div class="link-row">
							<input
								type="url"
								placeholder="Paste image link…"
								bind:value={linkInputs[slot.key]}
								disabled={busyKey === slot.key}
							/>
							<button
								type="button"
								class="apply-btn"
								disabled={busyKey === slot.key}
								onclick={() => handleApplyLink(slot)}>Apply</button
							>
						</div>
					</div>
				</section>
			{/each}
		</div>
	</aside>
{/if}

<style>
	.editor-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 31, 0.45);
		z-index: 998;
	}

	.editor-drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 380px;
		max-width: 92vw;
		background: #ffffff;
		box-shadow: -8px 0 28px rgba(0, 0, 0, 0.22);
		z-index: 999;
		display: flex;
		flex-direction: column;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		color: #11181f;
	}

	.editor-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 18px 20px;
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		color: #fff;
	}

	.editor-head h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 800;
	}

	.editor-head p {
		margin: 4px 0 0;
		font-size: 12px;
		opacity: 0.9;
	}

	.close-btn {
		background: rgba(255, 255, 255, 0.18);
		border: none;
		color: #fff;
		font-size: 22px;
		line-height: 1;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		cursor: pointer;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.editor-body {
		flex: 1;
		overflow-y: auto;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.slot {
		display: grid;
		grid-template-columns: 72px 1fr;
		gap: 12px;
		border: 1px solid #e2e8e0;
		border-radius: 12px;
		padding: 12px;
		background: #fbfcf8;
		transition: opacity 0.15s ease;
	}

	.slot.busy {
		opacity: 0.55;
		pointer-events: none;
	}

	.slot-preview {
		width: 72px;
		height: 72px;
		border-radius: 8px;
		overflow: hidden;
		background: #eef2ec;
		border: 1px solid #dfe8d8;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.slot-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.slot-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.slot-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.slot-title strong {
		font-size: 13px;
		color: #1f2933;
	}

	.badge {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: #2f6f2f;
		background: #e7f3da;
		border-radius: 999px;
		padding: 2px 7px;
	}

	.slot-hint {
		margin: 0;
		font-size: 11px;
		color: #6b7680;
		line-height: 1.35;
	}

	.slot-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		background: #2f6f2f;
		border-radius: 7px;
		padding: 6px 12px;
		cursor: pointer;
	}

	.file-btn:hover {
		background: #275c27;
	}

	.file-btn input {
		display: none;
	}

	.reset-btn,
	.apply-btn {
		font-size: 12px;
		font-weight: 700;
		border-radius: 7px;
		padding: 6px 12px;
		cursor: pointer;
		border: 1px solid transparent;
	}

	.reset-btn {
		background: #fff;
		border-color: #d6ddd2;
		color: #5f6b76;
	}

	.reset-btn:hover {
		border-color: #c0392b;
		color: #c0392b;
	}

	.link-row {
		display: flex;
		gap: 6px;
	}

	.link-row input {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		padding: 6px 8px;
		border: 1px solid #d6ddd2;
		border-radius: 7px;
	}

	.link-row input:focus {
		outline: none;
		border-color: #78be20;
	}

	.apply-btn {
		background: #78be20;
		color: #fff;
	}

	.apply-btn:hover {
		background: #6aa81c;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media print {
		.editor-backdrop,
		.editor-drawer {
			display: none !important;
		}
	}
</style>
