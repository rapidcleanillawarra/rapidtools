<script lang="ts">
	import { onMount } from 'svelte';
	import { loadBrochureImages, type BrochureImageSlot } from '$lib/brochures/brochureImages';
	import { exportBrochurePdf } from '$lib/brochures/exportBrochurePdf';
	import BrochureImageEditor from '$lib/brochures/BrochureImageEditor.svelte';
	import { toastError } from '$lib/utils/toast';

	const brandTag = 'orders@rapidcleanillawarra.com.au · (02) 4227 2833';
	const address = '112a Industrial Road, Oak Flats NSW 2529';

	const svgDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

	const soapIcon = svgDataUri(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#2f6f2f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="17" width="20" height="25" rx="3"/><path d="M19 17v-4h10v4"/><rect x="21" y="6" width="6" height="7" rx="1"/><path d="M27 9h7"/></svg>'
	);
	const toiletIcon = svgDataUri(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#2f6f2f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="22" cy="15" rx="13" ry="6"/><path d="M9 15v15c0 3.3 5.8 6 13 6s13-2.7 13-6V15"/><ellipse cx="22" cy="15" rx="4.5" ry="2"/><path d="M35 24c4 0 4 9 0 9"/></svg>'
	);
	const towelIcon = svgDataUri(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#2f6f2f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="11" y="8" width="26" height="23" rx="3"/><path d="M17 15h14M17 20h14" opacity="0.6"/><path d="M21 31c0 5 6 4 6 9"/></svg>'
	);

	const SLUG = 'washroom_fitout';
	const imageSlots: BrochureImageSlot[] = [
		{
			key: 'logo',
			label: 'Company logo',
			defaultUrl: 'https://www.rapidsupplies.com.au/assets/images/company_logo_white.png',
			hint: 'Appears on every page header and both covers.'
		},
		{
			key: 'cover_hero',
			label: 'Front cover background',
			defaultUrl:
				'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=80'
		},
		{
			key: 'product_soap',
			label: 'Product · Soap dispenser',
			defaultUrl: soapIcon,
			hint: 'Page 2 thumbnail (GOJO 2L Soap Dispensers).'
		},
		{
			key: 'product_toilet',
			label: 'Product · Toilet paper',
			defaultUrl: toiletIcon,
			hint: 'Page 2 thumbnail (ESG Slim 3-Roll Toilet Paper).'
		},
		{
			key: 'product_towel',
			label: 'Product · Roll towel',
			defaultUrl: towelIcon,
			hint: 'Page 2 thumbnail (ESG Auto-Cut Roll Towel).'
		},
		{
			key: 'support_logo',
			label: 'Recognition card logo',
			defaultUrl: 'https://www.rapidsupplies.com.au/assets/images/Company%20Logo%20New%20Black.png',
			hint: 'Logo on the page 3 “Supplied By” recognition card.'
		},
		{
			key: 'back_cover_hero',
			label: 'Back cover background',
			defaultUrl:
				'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=80'
		}
	];

	const defaults: Record<string, string> = Object.fromEntries(
		imageSlots.map((slot) => [slot.key, slot.defaultUrl])
	);

	let images = $state<Record<string, string>>({ ...defaults });
	let editorOpen = $state(false);
	let exporting = $state(false);
	let brochureEl = $state<HTMLDivElement | null>(null);

	onMount(async () => {
		const overrides = await loadBrochureImages(SLUG);
		images = { ...defaults, ...overrides };
	});

	async function downloadPdf() {
		if (!brochureEl || exporting) return;
		exporting = true;
		try {
			await exportBrochurePdf(brochureEl, 'rapidclean-washroom-fit-out.pdf');
		} catch (error) {
			toastError(`Could not generate PDF: ${error instanceof Error ? error.message : 'unknown error'}`);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head>
	<title>RapidClean Illawarra · Free Washroom Fit-Out Brochure</title>
	<meta
		name="description"
		content="RapidClean Illawarra Free Washroom Fit-Out — a sporting club sponsorship opportunity offering free supply, installation and first fill of washroom dispensing solutions."
	/>
</svelte:head>

<div class="brochure" bind:this={brochureEl}>
	<!-- ========== FRONT COVER ========== -->
	<section class="page cover-page" aria-label="Front cover">
		<div
			class="cover-hero"
			role="img"
			aria-label="Modern commercial washroom"
			style="background-image: url('{images.cover_hero}');"
		></div>

		<div class="cover-content">
			<div class="cover-top">
				<img class="logo" src={images.logo} alt="RapidClean Illawarra" />
				<span class="tag">Service · Supply · Support<br />Illawarra · NSW</span>
			</div>

			<div class="cover-body">
				<span class="eyebrow-light">Sporting Club Sponsorship Opportunity</span>
				<h1>Free Washroom<br />Fit-Out</h1>
				<p class="lead">
					Free supply, installation and first fill included &mdash; a complete washroom dispensing
					upgrade for your club at no upfront cost.
				</p>
			</div>

			<div class="cover-meta">
				<div class="item">
					<span class="label">Offer</span>
					<span class="value">Free Fit-Out</span>
				</div>
				<div class="item">
					<span class="label">Eligibility</span>
					<span class="value">Local Sporting Clubs</span>
				</div>
				<div class="item">
					<span class="label">Contact</span>
					<span class="value">(02) 4227 2833</span>
				</div>
			</div>
		</div>
	</section>

	<!-- ========== PAGE 1 · THE OFFER ========== -->
	<section class="page" aria-label="Page 1: The offer">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>01</span> The Offer</div>
			<h1>Upgrade your club amenities at no upfront cost</h1>
			<p class="subtitle">
				RapidClean Illawarra is partnering with local sporting clubs to improve washroom hygiene,
				presentation and efficiency.
			</p>

			<div class="callout">
				<h3>A complete washroom dispensing solution</h3>
				<p>
					We install a complete washroom dispensing solution and provide the first fill of
					consumables on rollout &mdash; so your club is ready to go from day one, with no upfront
					cost.
				</p>
			</div>

			<h3>What your club receives</h3>
			<ul class="check-list">
				<li>Free supply and professional installation of washroom dispensers</li>
				<li>GOJO 2L soap dispensers for hand hygiene areas</li>
				<li>ESG Slim 3-roll toilet paper dispensers</li>
				<li>ESG auto-cut / controlled-use roll towel dispensers</li>
				<li>First fill of consumables supplied in each dispenser</li>
			</ul>

			<div class="callout">
				<h3>Why we're doing this</h3>
				<p>
					Better washroom presentation and reliable consumables improve the experience for members,
					visitors and volunteers &mdash; while reducing waste and ongoing hassle for your club.
				</p>
			</div>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>01</strong> / 03</span>
		</div>
	</section>

	<!-- ========== PAGE 2 · PRODUCT BENEFITS ========== -->
	<section class="page" aria-label="Page 2: Program details and product benefits">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>02</span> Product Benefits</div>
			<h2>Installed washroom systems</h2>
			<p class="subtitle">Cleaner washrooms. Less waste. Better club presentation.</p>

			<div class="systems-layout">
				<div class="system-list">
					<div class="system-item">
						<div class="thumb">
							<span class="badge">Soap</span>
							<img class="thumb-img" src={images.product_soap} alt="GOJO 2L Soap Dispensers" />
						</div>
						<div>
							<strong>GOJO 2L Soap Dispensers</strong>
							<p>
								Reliable high-capacity soap dispensing for club change rooms, public toilets and
								clubhouse amenities.
							</p>
						</div>
					</div>

					<div class="system-item">
						<div class="thumb">
							<span class="badge">Toilet</span>
							<img class="thumb-img" src={images.product_toilet} alt="ESG Slim 3-Roll Toilet Paper" />
						</div>
						<div>
							<strong>ESG Slim 3-Roll Toilet Paper</strong>
							<p>
								High-capacity controlled-use dispensing. ESG material notes up to 4,800 sheets of
								1-ply or 2,400 sheets of 2-ply when fully loaded.
							</p>
						</div>
					</div>

					<div class="system-item">
						<div class="thumb">
							<span class="badge">Towel</span>
							<img class="thumb-img" src={images.product_towel} alt="ESG Auto-Cut Roll Towel" />
						</div>
						<div>
							<strong>ESG Auto-Cut Roll Towel</strong>
							<p>
								Holds up to 243m roll towel, requires no batteries and uses a translucent window to
								reduce unnecessary dispenser checks.
							</p>
						</div>
					</div>
				</div>

				<aside class="benefits-panel">
					<h3>Why it works for clubs</h3>
					<div class="benefits">
						<div class="benefit">
							<h4>Improves presentation</h4>
							<p>Cleaner, more consistent amenities for players, families, referees and visiting teams.</p>
						</div>
						<div class="benefit">
							<h4>Reduces volunteer workload</h4>
							<p>High-capacity systems reduce refill frequency and help staff see refill levels faster.</p>
						</div>
						<div class="benefit">
							<h4>Controls consumption</h4>
							<p>Controlled-use dispensing helps reduce overuse, mess and unnecessary wastage.</p>
						</div>
						<div class="benefit">
							<h4>Supports hygiene</h4>
							<p>
								Paper towel drying is promoted by ESG as a hygienic option, with referenced
								reductions in bacteria on fingertips and palms of up to 77%.
							</p>
						</div>
					</div>
				</aside>
			</div>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>02</strong> / 03</span>
		</div>
	</section>

	<!-- ========== PAGE 3 · PROGRAM DETAILS ========== -->
	<section class="page" aria-label="Page 3: Program details and requirements">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>03</span> Program Details</div>
			<h2>What we ask in return</h2>
			<p>
				There are no hidden costs and no long-term lock-in &mdash; just a cleaner, better-presented
				washroom for your club, with simple recognition of RapidClean Illawarra's support.
			</p>

			<div class="recognition">
				<h3>A simple recognition sign</h3>
				<p>
					RapidClean Illawarra may install a neat promotional sign in each washroom to recognise the
					sponsorship and identify RapidClean Illawarra as the washroom hygiene supplier.
				</p>
				<div class="support-card">
					<span class="support-label">Washroom Hygiene Solutions Supplied By</span>
					<img class="support-logo" src={images.support_logo} alt="RapidClean Illawarra" />
				</div>
			</div>

			<h3>Program requirements</h3>
			<ul class="check-list">
				<li>Available to eligible local sporting clubs following a RapidClean Illawarra site review.</li>
				<li>
					Fit-out quantity and dispenser selection are confirmed after assessing washroom layout and
					traffic.
				</li>
				<li>
					First fill of consumables is included on rollout; ongoing consumables are supplied by
					RapidClean Illawarra under the agreed supply arrangement.
				</li>
				<li>Promotional signage approval is required as part of the sponsorship offer.</li>
			</ul>

			<div class="cta-banner">
				To discuss a free club washroom fit-out: call <strong>(02) 4227 2833</strong> or email
				<strong>orders@rapidcleanillawarra.com.au</strong>
			</div>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>03</strong> / 03</span>
		</div>
	</section>

	<!-- ========== BACK COVER ========== -->
	<section class="page back-cover-page" aria-label="Back cover">
		<div
			class="back-cover-hero"
			role="img"
			aria-label="Modern facility interior"
			style="background-image: url('{images.back_cover_hero}');"
		></div>

		<div class="back-cover-inner">
			<div class="back-cover-top">
				<img class="logo" src={images.logo} alt="RapidClean Illawarra" />
				<span class="ribbon">Service · Supply · Support</span>
			</div>

			<blockquote class="back-cover-statement">
				Cleaner washrooms, happier members &mdash; proudly supporting local sporting clubs.
				<cite>&mdash; RapidClean Illawarra</cite>
			</blockquote>

			<div class="back-cover-contact-grid">
				<div class="contact-card">
					<h4>Visit</h4>
					<p>112a Industrial Road<br />Oak Flats NSW 2529</p>
				</div>
				<div class="contact-card">
					<h4>Call</h4>
					<p>(02) 4227 2833</p>
				</div>
				<div class="contact-card">
					<h4>Email</h4>
					<p>orders@rapidcleanillawarra.com.au</p>
				</div>
				<div class="contact-card">
					<h4>Website</h4>
					<p>rapidsupplies.com.au</p>
				</div>
			</div>

			<div class="back-cover-footer">
				<span>&copy; 2026 RapidClean Illawarra. All rights reserved.</span>
				<span><strong>RapidClean</strong> &mdash; your local cleaning equipment partner</span>
			</div>
		</div>
	</section>
</div>

<div class="brochure-toolbar">
	<button type="button" class="tool-btn" onclick={downloadPdf} disabled={exporting}>
		{exporting ? 'Generating…' : 'Download PDF'}
	</button>
	<button type="button" class="tool-btn primary" onclick={() => (editorOpen = true)}>Edit images</button>
</div>

<BrochureImageEditor slug={SLUG} slots={imageSlots} bind:images bind:open={editorOpen} />

<style>
	/* ---------- Floating toolbar (screen only) ---------- */
	.brochure-toolbar {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 900;
		display: flex;
		gap: 8px;
	}

	.tool-btn {
		background: #ffffff;
		color: #2f6f2f;
		border: 1px solid #c7d8b9;
		border-radius: 999px;
		padding: 10px 18px;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 6px 18px rgba(31, 41, 51, 0.18);
	}

	.tool-btn.primary {
		background: linear-gradient(135deg, #2f6f2f 0%, #78be20 100%);
		color: #fff;
		border-color: transparent;
	}

	.tool-btn:hover {
		filter: brightness(1.04);
	}

	.tool-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media print {
		.brochure-toolbar {
			display: none !important;
		}
	}

	/* =====================================================
   RapidClean Illawarra · Free Washroom Fit-Out Brochure
   ===================================================== */

	/* ---------- Design Tokens ---------- */
	.brochure {
		--rapid-green: #78be20;
		--rapid-green-dark: #5ea015;
		--deep-green: #2f6f2f;
		--deep-green-soft: #3d8a3d;
		--dark: #1f2933;
		--ink: #11181f;
		--muted: #5f6b76;
		--light: #f4f8f1;
		--cream: #fbfcf8;
		--white: #ffffff;
		--border: #dfe8d8;
		--border-strong: #c7d8b9;

		/* Page geometry */
		--page-w: 210mm;
		--page-h: 297mm;
		--gutter: 18mm;

		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		color: var(--ink);
		background: #d8dcd5;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		padding: 1px 0;
		min-height: 100%;
	}

	.brochure * {
		box-sizing: border-box;
	}

	.brochure img {
		max-width: 100%;
	}

	/* ---------- Page Frame ---------- */
	.page {
		width: var(--page-w);
		height: var(--page-h);
		margin: 18px auto;
		background: var(--white);
		position: relative;
		overflow: hidden;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
		page-break-after: always;
	}

	.page-inner {
		padding: 32mm var(--gutter) 22mm;
		position: relative;
		z-index: 2;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	/* ---------- Brand Bar ---------- */
	.brand-bar {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 24mm;
		padding: 4mm var(--gutter);
		background: linear-gradient(180deg, #111 0%, #1a1a1a 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
		z-index: 3;
	}

	.brand-bar::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1.2mm;
		background: linear-gradient(90deg, var(--rapid-green) 0%, var(--deep-green) 100%);
	}

	.site-logo {
		max-height: 16mm;
		width: auto;
		object-fit: contain;
		display: block;
	}

	.brand-tag {
		color: rgba(255, 255, 255, 0.72);
		font-size: 8.5pt;
		letter-spacing: 0.4pt;
		font-weight: 600;
	}

	/* ---------- Footer Bar ---------- */
	.footer-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 14mm;
		padding: 0 var(--gutter);
		background: var(--ink);
		color: var(--white);
		font-size: 9pt;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		z-index: 3;
	}

	.footer-bar::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 0.8mm;
		background: linear-gradient(90deg, var(--deep-green) 0%, var(--rapid-green) 100%);
	}

	.footer-bar .footer-meta {
		display: inline-flex;
		align-items: center;
		gap: 2mm;
		color: rgba(255, 255, 255, 0.55);
		font-size: 8.5pt;
		letter-spacing: 0.3pt;
		white-space: nowrap;
	}

	.footer-bar .footer-meta strong {
		color: var(--rapid-green);
		font-weight: 700;
	}

	/* ---------- Typography ---------- */
	.brochure h1 {
		font-size: 36pt;
		line-height: 1.02;
		letter-spacing: -0.5pt;
		margin: 0 0 5mm;
		color: var(--deep-green);
		font-weight: 800;
	}

	.brochure h2 {
		font-size: 24pt;
		line-height: 1.1;
		letter-spacing: -0.3pt;
		margin: 0 0 5mm;
		color: var(--deep-green);
		font-weight: 800;
	}

	.brochure h3 {
		font-size: 13pt;
		margin: 6mm 0 2mm;
		color: var(--deep-green);
		font-weight: 700;
		letter-spacing: 0.1pt;
	}

	.brochure p {
		font-size: 10.5pt;
		margin: 0 0 4mm;
		color: var(--dark);
	}

	.brochure ul {
		margin: 2mm 0 5mm 0;
		padding-left: 5mm;
		list-style: none;
	}

	.brochure li {
		font-size: 10.3pt;
		margin-bottom: 2.2mm;
		padding-left: 5mm;
		position: relative;
		color: var(--dark);
	}

	.brochure li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 2.4mm;
		width: 2.2mm;
		height: 2.2mm;
		border-radius: 50%;
		background: var(--rapid-green);
	}

	/* ---------- Check List ---------- */
	.check-list {
		padding-left: 0;
	}

	.check-list li {
		padding-left: 8mm;
		margin-bottom: 2.6mm;
	}

	.check-list li::before {
		content: '\2713';
		left: 0;
		top: 0.2mm;
		width: auto;
		height: auto;
		border-radius: 0;
		background: none;
		color: var(--rapid-green-dark);
		font-size: 12pt;
		font-weight: 900;
		line-height: 1;
	}

	.subtitle {
		font-size: 14pt;
		line-height: 1.4;
		color: var(--muted);
		max-width: 155mm;
		margin: 0 0 8mm;
		font-weight: 400;
	}

	/* ---------- Callout ---------- */
	.callout {
		background: linear-gradient(135deg, #f7fbf3 0%, #eef5e6 100%);
		border-left: 5px solid var(--rapid-green);
		padding: 6mm 7mm;
		border-radius: 12px;
		margin: 3mm 0;
		box-shadow: 0 2px 8px rgba(47, 111, 47, 0.05);
	}

	.callout h3 {
		margin: 0 0 2mm;
		font-size: 12.5pt;
	}

	.callout p {
		margin: 0;
		font-size: 10.2pt;
	}

	/* ---------- Installed Systems + Benefits ---------- */
	.systems-layout {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 7mm;
		margin-top: 4mm;
	}

	.system-list {
		display: flex;
		flex-direction: column;
		gap: 4mm;
	}

	.system-item {
		display: grid;
		grid-template-columns: 28mm 1fr;
		gap: 4mm;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 4mm;
		background: var(--white);
		box-shadow: 0 1px 4px rgba(31, 41, 51, 0.04);
	}

	.system-item .thumb {
		position: relative;
		height: 28mm;
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--deep-green);
		background:
			radial-gradient(circle at 80% 20%, rgba(120, 190, 32, 0.18), transparent 60%),
			linear-gradient(135deg, #f3faec 0%, #e2efd4 100%);
	}

	.system-item .thumb .thumb-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.system-item .badge {
		position: absolute;
		top: 2mm;
		right: 2mm;
		background: linear-gradient(135deg, var(--rapid-green) 0%, var(--deep-green) 100%);
		color: white;
		font-size: 6pt;
		font-weight: 800;
		letter-spacing: 0.8pt;
		text-transform: uppercase;
		padding: 1mm 2mm;
		border-radius: 999px;
		box-shadow: 0 2px 5px rgba(47, 111, 47, 0.25);
	}

	.system-item strong {
		display: block;
		color: var(--deep-green);
		font-size: 11pt;
		font-weight: 700;
		margin-bottom: 1.5mm;
	}

	.system-item p {
		font-size: 9pt;
		line-height: 1.4;
		color: var(--muted);
		margin: 0;
	}

	.benefits-panel {
		background: var(--cream);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 6mm;
	}

	.benefits-panel h3 {
		margin: 0 0 4mm;
		font-size: 13pt;
	}

	.benefits {
		display: flex;
		flex-direction: column;
		gap: 4mm;
	}

	.benefit h4 {
		margin: 0 0 1mm;
		color: var(--rapid-green-dark);
		font-size: 10.5pt;
		font-weight: 700;
	}

	.benefit p {
		margin: 0;
		font-size: 9pt;
		line-height: 1.4;
		color: var(--dark);
	}

	/* ---------- Recognition Panel ---------- */
	.recognition {
		background:
			radial-gradient(circle at 88% 12%, rgba(120, 190, 32, 0.18), transparent 55%),
			linear-gradient(135deg, #14331f 0%, #1d4a2c 100%);
		color: white;
		border-radius: 16px;
		padding: 7mm 8mm;
		margin-top: 4mm;
		box-shadow: 0 6px 18px rgba(20, 51, 31, 0.22);
	}

	.recognition h3 {
		color: white;
		margin: 0 0 2mm;
		font-size: 14pt;
	}

	.recognition p {
		color: rgba(255, 255, 255, 0.82);
		font-size: 10pt;
		margin: 0;
	}

	.support-card {
		background: white;
		border-radius: 10px;
		padding: 5mm;
		text-align: center;
		margin-top: 5mm;
	}

	.support-label {
		display: block;
		font-size: 8pt;
		letter-spacing: 1.5pt;
		text-transform: uppercase;
		color: var(--muted);
		font-weight: 700;
		margin-bottom: 2.5mm;
	}

	.support-logo {
		display: block;
		margin: 0 auto;
		max-width: 60mm;
		max-height: 16mm;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	/* ---------- CTA Banner ---------- */
	.cta-banner {
		position: relative;
		margin-top: auto;
		background:
			radial-gradient(circle at 92% 0%, rgba(255, 255, 255, 0.14), transparent 55%),
			linear-gradient(135deg, var(--deep-green) 0%, var(--rapid-green) 100%);
		color: white;
		border-radius: 12px;
		padding: 6mm 8mm;
		font-size: 11pt;
		font-weight: 600;
		line-height: 1.4;
		text-align: center;
		box-shadow: 0 6px 18px rgba(47, 111, 47, 0.22);
	}

	.cta-banner strong {
		font-weight: 800;
	}

	/* ---------- Section Header ---------- */
	.section-num {
		display: inline-flex;
		align-items: center;
		gap: 3mm;
		color: var(--rapid-green-dark);
		font-size: 9pt;
		letter-spacing: 2.5pt;
		text-transform: uppercase;
		font-weight: 700;
		margin-bottom: 4mm;
	}

	.section-num span {
		display: inline-flex;
		width: 9mm;
		height: 9mm;
		border: 1.4pt solid var(--rapid-green);
		border-radius: 50%;
		align-items: center;
		justify-content: center;
		font-size: 9.5pt;
		color: var(--rapid-green-dark);
	}

	/* Watermark accent in page corners */
	.corner-accent {
		position: absolute;
		bottom: 22mm;
		right: 0;
		width: 12mm;
		height: 60mm;
		background: linear-gradient(180deg, transparent, var(--rapid-green) 50%, transparent);
		opacity: 0.08;
		z-index: 1;
		pointer-events: none;
	}

	/* =====================================================
   FRONT COVER
   ===================================================== */
	.cover-page {
		background: #0e1614;
		color: white;
	}

	.cover-hero {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		z-index: 0;
	}

	.cover-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				180deg,
				rgba(8, 18, 12, 0.55) 0%,
				rgba(8, 18, 12, 0.45) 35%,
				rgba(8, 22, 14, 0.96) 100%
			),
			linear-gradient(90deg, rgba(47, 111, 47, 0.35) 0%, rgba(0, 0, 0, 0) 60%);
	}

	.cover-content {
		position: relative;
		z-index: 2;
		height: 100%;
		padding: 22mm 22mm 22mm;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		color: white;
	}

	.cover-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8mm;
	}

	.cover-top .logo {
		max-height: 18mm;
		width: auto;
		object-fit: contain;
	}

	.cover-top .tag {
		text-align: right;
		font-size: 8.5pt;
		letter-spacing: 1.5pt;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.75);
		font-weight: 600;
		line-height: 1.5;
	}

	.cover-body {
		margin-top: auto;
		margin-bottom: 14mm;
		max-width: 170mm;
	}

	.cover-body .eyebrow-light {
		display: inline-flex;
		align-items: center;
		gap: 4mm;
		color: var(--rapid-green);
		letter-spacing: 3pt;
		font-size: 9.5pt;
		text-transform: uppercase;
		font-weight: 700;
		margin-bottom: 8mm;
	}

	.cover-body .eyebrow-light::before {
		content: '';
		display: inline-block;
		width: 14mm;
		height: 1.4mm;
		background: var(--rapid-green);
		border-radius: 1mm;
	}

	.cover-body h1 {
		color: white;
		font-size: 52pt;
		line-height: 0.98;
		margin: 0 0 8mm;
		letter-spacing: -1pt;
		font-weight: 800;
	}

	.cover-body .lead {
		color: rgba(255, 255, 255, 0.88);
		font-size: 13pt;
		line-height: 1.5;
		max-width: 155mm;
		margin: 0;
		font-weight: 400;
	}

	.cover-meta {
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 8mm;
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 12mm;
	}

	.cover-meta .item .label {
		display: block;
		font-size: 8pt;
		letter-spacing: 1.8pt;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.6);
		font-weight: 600;
		margin-bottom: 2mm;
	}

	.cover-meta .item .value {
		display: block;
		font-size: 11.5pt;
		font-weight: 700;
		color: white;
		line-height: 1.3;
	}

	/* =====================================================
   BACK COVER
   ===================================================== */
	.back-cover-page {
		background: linear-gradient(180deg, #0c1a13 0%, #112a1b 50%, #0a1410 100%);
		color: white;
	}

	.back-cover-hero {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 110mm;
		background-size: cover;
		background-position: center;
		opacity: 0.28;
		z-index: 0;
	}

	.back-cover-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(12, 26, 19, 0.35) 0%, rgba(12, 26, 19, 1) 92%);
	}

	.back-cover-inner {
		position: relative;
		z-index: 2;
		height: 100%;
		padding: 26mm 22mm 22mm;
		display: flex;
		flex-direction: column;
	}

	.back-cover-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8mm;
	}

	.back-cover-top .logo {
		max-height: 16mm;
		width: auto;
		object-fit: contain;
	}

	.back-cover-top .ribbon {
		text-align: right;
		font-size: 8.5pt;
		letter-spacing: 2pt;
		text-transform: uppercase;
		color: var(--rapid-green);
		font-weight: 700;
	}

	.back-cover-statement {
		font-size: 24pt;
		line-height: 1.2;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.96);
		max-width: 155mm;
		margin: 28mm 0 0;
		letter-spacing: -0.3pt;
		position: relative;
	}

	.back-cover-statement::before {
		content: '\201C';
		display: block;
		color: var(--rapid-green);
		font-size: 60pt;
		line-height: 0;
		margin-bottom: 14mm;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.back-cover-statement cite {
		display: block;
		margin-top: 6mm;
		font-size: 10pt;
		letter-spacing: 2pt;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.6);
		font-style: normal;
		font-weight: 600;
	}

	.back-cover-contact-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 9mm 14mm;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		padding: 10mm 0;
		margin-top: auto;
	}

	.contact-card h4 {
		font-size: 8.5pt;
		letter-spacing: 2.2pt;
		text-transform: uppercase;
		color: var(--rapid-green);
		margin: 0 0 3mm;
		font-weight: 700;
	}

	.contact-card p {
		color: white;
		font-size: 12pt;
		line-height: 1.4;
		font-weight: 600;
		margin: 0;
	}

	.back-cover-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 6mm;
		margin-top: 6mm;
		font-size: 8.5pt;
		color: rgba(255, 255, 255, 0.55);
		letter-spacing: 0.5pt;
	}

	.back-cover-footer strong {
		color: var(--rapid-green);
		font-weight: 700;
	}

	/* =====================================================
   PRINT
   ===================================================== */
	@page {
		size: A4;
		margin: 0;
	}

	@media print {
		.brochure {
			background: white;
			padding: 0;
			/* Print every colour, gradient and image exactly as shown on screen */
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.brochure * {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.page {
			margin: 0;
			box-shadow: none;
			width: var(--page-w);
			height: var(--page-h);
		}
	}
</style>
