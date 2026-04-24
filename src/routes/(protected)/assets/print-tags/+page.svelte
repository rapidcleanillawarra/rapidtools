<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { assetPrintTagStorageKey } from '$lib/assetPrintTagStorage';
	import { supabase } from '$lib/supabase';

	const TAG_QR_PX = 64;

	type TagRow = {
		id: string;
		label: string;
		area: string;
		qrSrc: string;
	};

	let tags = $state<TagRow[]>([]);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let errorMessage = $state<string | null>(null);
	let logoHref = $state('');
	const COMPANY_LOGO_URL =
		'https://www.rapidsupplies.com.au/assets/images/company_logo_thermal_transparent.png';

	function displayText(s: string | null) {
		return s?.trim() ? s.trim() : '—';
	}

	function tagLogoSrc() {
		return COMPANY_LOGO_URL;
	}

	function editPageUrl(assetId: string) {
		const path = `${base}/assets/${assetId}`;
		return new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin).href;
	}

	function qrCodeImageUrl(editUrl: string) {
		const s = TAG_QR_PX;
		return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encodeURIComponent(editUrl)}`;
	}

	function waitForImagesThenPrint() {
		const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
		let left = imgs.length;
		const done = () => {
			left--;
			if (left <= 0) setTimeout(() => window.print(), 200);
		};
		if (left === 0) {
			setTimeout(() => window.print(), 200);
			return;
		}
		for (const img of imgs) {
			if (img.complete) done();
			else {
				img.onload = done;
				img.onerror = done;
			}
		}
	}

	onMount(() => {
		if (!browser) return;

		(async () => {
			const slot = get(page).url.searchParams.get('slot');
			if (!slot?.trim()) {
				status = 'error';
				errorMessage =
					'Missing print link. Close this tab, open the Assets list, select rows, and click Print Tag again.';
				return;
			}

			const storageKey = assetPrintTagStorageKey(slot);
			const raw = localStorage.getItem(storageKey);
			localStorage.removeItem(storageKey);

			if (!raw) {
				status = 'error';
				errorMessage =
					'Print data expired or already used. Close this tab, select assets on the Assets list, and choose Print Tag again.';
				return;
			}

			let ids: string[];
			try {
				const parsed = JSON.parse(raw) as unknown;
				if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
					status = 'error';
					errorMessage = 'Invalid print payload. Try again from the Assets list.';
					return;
				}
				ids = parsed;
			} catch {
				status = 'error';
				errorMessage = 'Invalid print payload. Try again from the Assets list.';
				return;
			}

			if (ids.length === 0) {
				status = 'error';
				errorMessage = 'No assets selected.';
				return;
			}

			const { data, error } = await supabase
				.from('assets')
				.select('id, asset_number, asset_name, area')
				.in('id', ids)
				.is('deleted_at', null);

			if (error) {
				status = 'error';
				errorMessage = error.message;
				return;
			}

			const rows = (data ?? []) as {
				id: string;
				asset_number: string | null;
				asset_name: string | null;
				area: string | null;
			}[];

			const order = new Map(ids.map((id, i) => [id, i]));
			rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

			logoHref = tagLogoSrc();
			tags = rows.map((r) => {
				const label =
					r.asset_number?.trim() || r.asset_name?.trim() || r.id;
				const url = editPageUrl(r.id);
				return {
					id: r.id,
					label,
					area: displayText(r.area),
					qrSrc: qrCodeImageUrl(url)
				};
			});

			status = 'ready';

			requestAnimationFrame(() => {
				requestAnimationFrame(() => waitForImagesThenPrint());
			});
		})();
	});
</script>

<svelte:head>
	<title>Asset tags</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="print-tags-page">
	{#if status === 'loading'}
		<p class="msg">Loading tags…</p>
	{:else if status === 'error'}
		<p class="msg" role="alert">{errorMessage}</p>
		<p class="actions">
			<a class="link" href="{base}/assets">Back to Assets</a>
		</p>
	{:else}
		<div class="screen-only">
			<button type="button" class="btn" onclick={() => window.print()}>Print again</button>
			<a class="link" href="{base}/assets">Back to Assets</a>
		</div>
		<div class="grid">
			{#each tags as t (t.id)}
				<div class="tag">
					<img class="logo" src={logoHref} alt="" />
					<img
						class="qr"
						src={t.qrSrc}
						alt=""
						width={TAG_QR_PX}
						height={TAG_QR_PX}
					/>
					<div class="label">{t.label}</div>
					<div class="area">{t.area}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.print-tags-page {
		font-family: system-ui, sans-serif;
		color: #111;
		padding: 12px;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	.msg {
		margin: 1rem 0;
	}

	.actions {
		margin-top: 0.75rem;
	}

	.screen-only {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 12px;
	}

	.btn {
		border-radius: 6px;
		border: 1px solid #ccc;
		background: #fff;
		padding: 0.4rem 0.75rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.btn:hover {
		background: #f5f5f5;
	}

	.link {
		color: #2563eb;
		text-decoration: underline;
		font-size: 0.875rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 1.2mm 1mm;
		align-content: start;
	}

	.tag {
		text-align: center;
		break-inside: avoid;
		page-break-inside: avoid;
		box-sizing: border-box;
		border: 0.2pt solid #ccc;
		padding: 0.8mm 0.6mm 0.6mm;
	}

	.tag .logo {
		display: block;
		width: 100%;
		max-width: 56px;
		height: 14px;
		margin: 0 auto 2px;
		object-fit: contain;
		object-position: center top;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	.tag .qr {
		display: block;
		margin: 0 auto;
		width: 64px;
		height: 64px;
	}

	.label {
		margin-top: 0.2mm;
		font-size: 5.5pt;
		line-height: 1.1;
		font-weight: 600;
		word-break: break-word;
	}

	.area {
		margin-top: 0.15mm;
		font-size: 4.8pt;
		line-height: 1.1;
		color: #333;
		word-break: break-word;
	}

	@media print {
		.print-tags-page {
			padding: 0;
		}

		.screen-only {
			display: none;
		}
	}

	@page {
		size: A4;
		margin: 5mm;
	}
</style>
