<script lang="ts">
	import { onMount } from 'svelte';
	import { loadBrochureImages, type BrochureImageSlot } from '$lib/brochures/brochureImages';
	import { exportBrochurePdf } from '$lib/brochures/exportBrochurePdf';
	import BrochureImageEditor from '$lib/brochures/BrochureImageEditor.svelte';
	import { toastError } from '$lib/utils/toast';

	const brandTag = 'orders@rapidcleanillawarra.com.au · (02) 4227 2833';
	const address = '112a Industrial Road, Oak Flats NSW 2529';

	const SLUG = 'preventative_maintenance';
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
				'https://www.rapidsupplies.com.au/assets/images/industries_industrial_and_warehousing.png'
		},
		{
			key: 'intro_image',
			label: 'Page 1 · Introduction image',
			defaultUrl: 'https://www.rapidsupplies.com.au/assets/images/preventative_maintenance_1.png'
		},
		{
			key: 'challenge_image',
			label: 'Page 2 · Challenge image',
			defaultUrl: 'https://www.rapidsupplies.com.au/assets/images/second_brochure.png'
		},
		{
			key: 'approach_image',
			label: 'Page 3 · Approach image',
			defaultUrl: 'https://www.rapidsupplies.com.au/assets/images/third_brochure.png'
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
			await exportBrochurePdf(brochureEl, 'rapidclean-preventative-maintenance.pdf');
		} catch (error) {
			toastError(`Could not generate PDF: ${error instanceof Error ? error.message : 'unknown error'}`);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head>
	<title>RapidClean Illawarra · Preventative Maintenance Brochure</title>
	<meta
		name="description"
		content="RapidClean Illawarra Preventative Maintenance Program brochure — structured servicing, asset management, test & tag, and fleet planning for commercial cleaning equipment."
	/>
</svelte:head>

<div class="brochure" bind:this={brochureEl}>
	<!-- ========== FRONT COVER ========== -->
	<section class="page cover-page" aria-label="Front cover">
		<div
			class="cover-hero"
			role="img"
			aria-label="Commercial cleaning operations"
			style="background-image: url('{images.cover_hero}');"
		></div>

		<div class="cover-content">
			<div class="cover-top">
				<img class="logo" src={images.logo} alt="RapidClean Illawarra" />
				<span class="tag">Service · Supply · Support<br />Illawarra · NSW</span>
			</div>

			<div class="cover-body">
				<span class="eyebrow-light">2026 Service Program Guide</span>
				<h1>Preventative<br />Maintenance for<br />Cleaning Equipment</h1>
				<p class="lead">
					A practical servicing, test &amp; tag and replacement program that keeps facilities safer,
					cleaner, compliant and operational.
				</p>
			</div>

			<div class="cover-meta">
				<div class="item">
					<span class="label">Prepared by</span>
					<span class="value">RapidClean Illawarra</span>
				</div>
				<div class="item">
					<span class="label">Edition</span>
					<span class="value">2026 / Vol. 01</span>
				</div>
				<div class="item">
					<span class="label">Contact</span>
					<span class="value">(02) 4227 2833</span>
				</div>
			</div>
		</div>
	</section>

	<!-- ========== PAGE 1 · INTRODUCTION ========== -->
	<section class="page page-intro" aria-label="Page 1: Introduction">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>01</span> Introduction</div>
			<h1>Designed to keep your facility running</h1>
			<p class="subtitle">
				Structured servicing, asset management, test &amp; tag, equipment transport and fleet
				planning &mdash; delivered locally by the RapidClean Illawarra team.
			</p>

			<div class="callout">
				<h3>For facilities where hygiene, safety and uptime matter</h3>
				<p>
					RapidClean Illawarra supports aged care, healthcare, industrial, education, government and
					commercial facilities with practical maintenance programs for cleaning equipment fleets.
				</p>
			</div>
			<ul>
				<li>Reduce reactive breakdown repairs</li>
				<li>Improve equipment safety and compliance visibility</li>
				<li>Support cleaning team productivity and retention</li>
				<li>Plan replacement cycles before machines fail</li>
			</ul>
		</div>

		<figure class="page-full-image">
			<img
				src={images.intro_image}
				alt="Sales, service coordination and equipment support from RapidClean Illawarra"
			/>
		</figure>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>01</strong> / 05</span>
		</div>
	</section>

	<!-- ========== PAGE 2 · THE CHALLENGE ========== -->
	<section class="page" aria-label="Page 2: The challenge">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>02</span> The Challenge</div>
			<h2>The problem with reactive maintenance</h2>
			<p>
				Many facilities have purchased machines over many years from different suppliers, brands and
				budgets. Over time, this can create a mixed fleet with no clear asset register, no service
				schedule and no replacement plan.
			</p>

			<div class="grid-2">
				<div>
					<h3>Common issues we find on site</h3>
					<ul>
						<li>Machines used beyond economical repair life</li>
						<li>Equipment repaired only after breakdown</li>
						<li>HEPA filters, batteries, brushes and wear parts overlooked</li>
						<li>Electrical test and tag gaps</li>
						<li>Cleaning teams working harder than necessary</li>
						<li>Limited visibility over future costs</li>
					</ul>
				</div>
				<div class="image-card">
					<img
						src={images.challenge_image}
						alt="Service coordination for scheduled maintenance, repairs and compliance follow-up"
					/>
					<div class="caption">
						Service coordination for scheduled maintenance, repairs and compliance follow-up
					</div>
				</div>
			</div>

			<div class="callout">
				<h3>Health, safety and staff retention</h3>
				<p>
					Poorly maintained cleaning equipment can increase the risk of injury, reduce cleaning
					standards and create frustration for cleaning teams. Reliable equipment helps teams work
					more safely, consistently and efficiently.
				</p>
			</div>

			<h3>Electrical test and tag gap</h3>
			<p>
				Cleaning equipment is often exposed to movement, impact, water, chemicals and frequent
				handling. Many sites assume a 12-month test and tag cycle applies to all equipment, however
				corded cleaning equipment used in higher-risk environments may require more frequent review.
				RapidClean Illawarra can coordinate test and tag as part of the preventative maintenance
				schedule.
			</p>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>02</strong> / 05</span>
		</div>
	</section>

	<!-- ========== PAGE 3 · OUR APPROACH ========== -->
	<section class="page" aria-label="Page 3: Our approach">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>03</span> Our Approach</div>
			<h2>Our preventative maintenance model</h2>
			<p>
				We start by building a clear picture of your site, your equipment and your operational risk.
				From there, we create a practical servicing and replacement plan.
			</p>

			<div class="image-card team-hero wide cover">
				<img
					src={images.approach_image}
					alt="Our preventative maintenance model for cleaning equipment"
				/>
				<div class="caption">
					From site assessment and asset registers through scheduled servicing and replacement
					planning
				</div>
			</div>

			<div class="process process-grid">
				<div class="step">
					<div>
						<h3>Site assessment</h3>
						<p>
							We inspect the facility, understand workflows and identify high-use areas, safety
							risks and equipment pressure points.
						</p>
					</div>
				</div>
				<div class="step">
					<div>
						<h3>Asset register</h3>
						<p>
							We create a practical asset list covering vacuums, scrubbers, sweepers, polishers,
							carpet extractors and other powered cleaning equipment.
						</p>
					</div>
				</div>
				<div class="step">
					<div>
						<h3>Asset condition assessment</h3>
						<p>
							Each machine is reviewed for condition, age, serviceability, safety, parts
							availability and repair viability.
						</p>
					</div>
				</div>
				<div class="step">
					<div>
						<h3>Scheduled servicing</h3>
						<p>
							We create a planned service schedule that can include routine servicing, test and
							tag, HEPA filter changes, basic repairs and wear-part checks.
						</p>
					</div>
				</div>
				<div class="step">
					<div>
						<h3>Fixed service fee model</h3>
						<p>
							Our fixed service fee structure helps facilities forecast maintenance costs and
							reduce reliance on emergency breakdown repairs.
						</p>
					</div>
				</div>
				<div class="step">
					<div>
						<h3>Replacement planning</h3>
						<p>
							By year two, most facilities have a clearer understanding of which machines should be
							retained, repaired, replaced or decommissioned.
						</p>
					</div>
				</div>
			</div>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>03</strong> / 05</span>
		</div>
	</section>

	<!-- ========== PAGE 4 · PARTNERSHIP ========== -->
	<section class="page" aria-label="Page 4: Partnership">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner">
			<div class="section-num"><span>04</span> Partnership</div>
			<h2>Why RapidClean Illawarra?</h2>
			<p>
				RapidClean Illawarra is not just a product supplier. We provide a full support model for
				facilities that need reliable cleaning outcomes and practical equipment lifecycle
				management.
			</p>

			<div class="grid-3">
				<div class="tile">
					<strong>OEM brand support</strong>Sales, repairs, servicing and parts support across many
					major commercial cleaning equipment brands.
				</div>
				<div class="tile">
					<strong>Dedicated service team</strong>Experienced service technicians supported by sales,
					training and administration staff.
				</div>
				<div class="tile">
					<strong>Mixed fleet servicing</strong>Support for sites with multiple brands and machines
					purchased over many years.
				</div>
				<div class="tile">
					<strong>Equipment transport</strong>Transport support for machines going to and from site
					for workshop repair, assessment or replacement.
				</div>
				<div class="tile">
					<strong>Training &amp; demonstrations</strong>Support for greenfield facilities, new machine
					rollouts and cleaning team training.
				</div>
				<div class="tile">
					<strong>Fleet planning</strong>Repair cost ceilings, age limits, replacement models and
					agreed pricing for better budget forecasting.
				</div>
			</div>

			<h3>Brands we sell, service and support</h3>
			<p style="font-size:10pt;">
				RapidClean Illawarra supports a broad range of commercial cleaning equipment brands, allowing
				facilities to manage mixed fleets through one local service partner.
			</p>
			<div class="logo-grid">
				<div class="logo-tile">
					<img src="https://www.rapidsupplies.com.au/assets/images/rapidclean.jpg" alt="RapidClean logo" />
					<span>RapidClean / MZL</span>
				</div>
				<div class="logo-tile">
					<img src="https://rapidclean.com.au/wp-content/uploads/PoliVac.png" alt="IPC logo" />
					<span>RapidClean IPC</span>
				</div>
				<div class="logo-tile">
					<img
						src="https://rapidclean.com.au/wp-content/uploads/Nilfisk_wordmark_CMYK_Dark.png"
						alt="Nilfisk logo"
					/>
					<span>Nilfisk</span>
				</div>
				<div class="logo-tile">
					<img
						src="https://s1.kaercher-media.com/versions/2026.3.0/static/img/kaercher_logo.svg"
						alt="Kärcher logo"
					/>
					<span>Kärcher</span>
				</div>
				<div class="logo-tile">
					<img src="https://rapidclean.com.au/wp-content/uploads/Pacvac.png" alt="Pacvac logo" />
					<span>Pacvac</span>
				</div>
				<div class="logo-tile">
					<img src="https://rapidclean.com.au/wp-content/uploads/Numatic.png" alt="Numatic logo" />
					<span>Numatic</span>
				</div>
				<div class="logo-tile">
					<img
						src="https://madeblue.org/wp-content/uploads/2021/09/Logo.i-team.Blue_.Pantone312C.print_.svg"
						alt="i-team logo"
					/>
					<span>i-team / i-mop</span>
				</div>
				<div class="logo-tile">
					<img
						src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Hako-Logo.svg/500px-Hako-Logo.svg.png?_=20120116174703"
						alt="Hako logo"
					/>
					<span>Hako</span>
				</div>
				<div class="logo-tile">
					<img src="https://www.kranzle.co.uk/files/Logo.svg" alt="Kranzle logo" />
					<span>Kranzle</span>
				</div>
				<div class="logo-tile">
					<img
						src="https://www.ramcarbatteries.com/wp-content/uploads/2023/04/Ramcar-logo.png"
						alt="Ramcar Batteries logo"
					/>
					<span>Ramcar Batteries</span>
				</div>
				<div class="logo-tile">
					<img
						src="https://www.ritarpower.com/uploads/image/20251212/ritar-power-logo.webp"
						alt="Ritar Batteries logo"
					/>
					<span>Ritar Batteries</span>
				</div>
				<div class="logo-tile">
					<img src="https://rapidclean.com.au/wp-content/uploads/PoliVac.png" alt="Polivac logo" />
					<span>Polivac</span>
				</div>
			</div>

			<h3>Ideal for</h3>
			<ul class="bullet-grid-2">
				<li>Aged care and healthcare facilities</li>
				<li>Schools and education sites</li>
				<li>Industrial and commercial sites</li>
				<li>Government and council facilities</li>
				<li>Accommodation and hospitality sites</li>
			</ul>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>04</strong> / 05</span>
		</div>
	</section>

	<!-- ========== PAGE 5 · NEXT STEPS ========== -->
	<section class="page" aria-label="Page 5: Next steps">
		<div class="brand-bar">
			<img class="site-logo" src={images.logo} alt="RapidClean Illawarra" />
			<span class="brand-tag">{brandTag}</span>
		</div>
		<div class="corner-accent"></div>

		<div class="page-inner" style="justify-content: center;">
			<div class="section-num"><span>05</span> Next Steps</div>
			<div class="cta" style="margin-top: 0;">
				<h2>Book a site assessment</h2>
				<p>
					Let RapidClean Illawarra review your cleaning equipment fleet and build a practical
					preventative maintenance plan for your facility.
				</p>
				<div class="cta-contact">
					<div class="item">
						<span class="label">Phone</span>
						<span class="value">02 4227 2833</span>
					</div>
					<div class="item">
						<span class="label">Email</span>
						<span class="value">orders@rapidcleanillawarra.com.au</span>
					</div>
					<div class="item">
						<span class="label">Web</span>
						<span class="value">rapidsupplies.com.au</span>
					</div>
				</div>
			</div>
		</div>

		<div class="footer-bar">
			<span>{address}</span>
			<span class="footer-meta">rapidsupplies.com.au &nbsp;&middot;&nbsp; <strong>05</strong> / 05</span>
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
				Keeping facilities safer, cleaner and operational &mdash; one machine at a time.
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
   RapidClean Illawarra · Preventative Maintenance Brochure
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

	.bullet-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: repeat(3, auto);
		gap: 2.2mm 8mm;
		padding-left: 0;
	}

	.bullet-grid-2 li {
		margin-bottom: 0;
	}

	.subtitle {
		font-size: 14pt;
		line-height: 1.4;
		color: var(--muted);
		max-width: 155mm;
		margin: 0 0 8mm;
		font-weight: 400;
	}

	/* ---------- Image Card ---------- */
	.image-card {
		position: relative;
		min-height: 100mm;
		background:
			radial-gradient(circle at 80% 20%, rgba(120, 190, 32, 0.18), transparent 60%),
			linear-gradient(135deg, #f3faec 0%, #e2efd4 100%);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 14px rgba(47, 111, 47, 0.08);
	}

	.image-card > img {
		position: relative;
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 6mm 4mm;
		background: #fff;
		box-sizing: border-box;
		display: block;
		z-index: 1;
	}

	.image-card.cover > img {
		object-fit: fill;
		padding: 0 0;
	}

	.image-card.wide {
		min-height: 52mm;
		margin-top: 2mm;
	}

	.image-card .caption {
		display: none;
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 3;
		background: linear-gradient(180deg, rgba(17, 24, 31, 0) 0%, rgba(17, 24, 31, 0.92) 70%);
		color: white;
		font-size: 8.8pt;
		line-height: 1.35;
		padding: 14mm 5mm 4mm;
		font-weight: 600;
		letter-spacing: 0.2pt;
	}

	.team-hero {
		background:
			radial-gradient(circle at 20% 80%, rgba(120, 190, 32, 0.22), transparent 55%),
			linear-gradient(135deg, #f8fff4 0%, #e0efd2 100%);
	}

	/* ---------- Page 1 · Full-width bottom image ---------- */
	.page-intro .page-inner {
		padding-bottom: 100mm;
	}

	.page-full-image {
		position: absolute;
		left: 0;
		bottom: 14mm;
		width: 100%;
		margin: 0;
		z-index: 2;
	}

	.page-full-image img {
		width: 100%;
		height: auto;
		max-height: 85mm;
		object-fit: cover;
		display: block;
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

	/* ---------- Grids ---------- */
	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8mm;
	}

	.grid-3 {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4mm;
	}

	/* ---------- Tile ---------- */
	.tile {
		background: var(--cream);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 5mm;
		min-height: 36mm;
		position: relative;
		font-size: 9.8pt;
		line-height: 1.45;
		color: var(--dark);
	}

	.tile::before {
		content: '';
		position: absolute;
		top: 0;
		left: 5mm;
		width: 10mm;
		height: 1mm;
		background: var(--rapid-green);
		border-radius: 0 0 1mm 1mm;
	}

	.tile strong {
		color: var(--deep-green);
		display: block;
		margin-bottom: 2mm;
		font-size: 10.8pt;
		font-weight: 700;
	}

	/* ---------- Logo Grid ---------- */
	.logo-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 2mm 3mm;
		margin: 2mm 0 3mm;
	}

	.logo-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1mm;
		text-align: center;
	}

	.logo-tile img {
		max-width: 28mm;
		max-height: 10mm;
		object-fit: contain;
		filter: saturate(0.95);
	}

	.logo-tile span {
		font-size: 6.8pt;
		color: var(--muted);
		font-weight: 700;
		letter-spacing: 0.1pt;
		line-height: 1.2;
	}

	/* ---------- Process / Steps ---------- */
	.process {
		counter-reset: step;
		display: grid;
		gap: 3mm;
	}

	.process-grid {
		counter-reset: step;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3mm;
		margin-top: 4mm;
	}

	.process-grid .step {
		grid-template-columns: 1fr;
		gap: 2mm;
		padding: 3.5mm;
	}

	.process-grid .step::before {
		width: 9mm;
		height: 9mm;
		font-size: 8.5pt;
	}

	.process-grid .step h3 {
		font-size: 10pt;
	}

	.process-grid .step p {
		font-size: 8.8pt;
		line-height: 1.35;
	}

	.step {
		display: grid;
		grid-template-columns: 11mm 1fr;
		gap: 4mm;
		align-items: start;
		padding: 4mm 4mm 4mm 3mm;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--white);
		box-shadow: 0 1px 3px rgba(31, 41, 51, 0.04);
	}

	.step::before {
		counter-increment: step;
		content: counter(step, decimal-leading-zero);
		width: 11mm;
		height: 11mm;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--rapid-green) 0%, var(--deep-green) 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 10pt;
		letter-spacing: 0.3pt;
		box-shadow: 0 2px 6px rgba(47, 111, 47, 0.25);
	}

	.step h3 {
		margin: 0 0 1mm;
		font-size: 11.5pt;
	}

	.step p {
		margin: 0;
		font-size: 9.6pt;
		color: var(--dark);
		line-height: 1.4;
	}

	/* ---------- CTA ---------- */
	.cta {
		position: relative;
		background:
			radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.15), transparent 50%),
			linear-gradient(135deg, var(--deep-green) 0%, var(--rapid-green) 100%);
		color: white;
		padding: 9mm 10mm;
		border-radius: 16px;
		margin-top: 7mm;
		overflow: hidden;
		box-shadow: 0 6px 20px rgba(47, 111, 47, 0.25);
	}

	.cta::before {
		content: '';
		position: absolute;
		top: -20mm;
		right: -20mm;
		width: 60mm;
		height: 60mm;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.06);
	}

	.cta::after {
		content: '';
		position: absolute;
		bottom: -25mm;
		left: -10mm;
		width: 50mm;
		height: 50mm;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.05);
	}

	.cta h2,
	.cta p {
		color: white;
		position: relative;
		z-index: 1;
	}

	.cta h2 {
		margin: 0 0 3mm;
		font-size: 22pt;
	}

	.cta p {
		font-size: 10.5pt;
		margin-bottom: 3mm;
		max-width: 145mm;
	}

	.cta-contact {
		display: flex;
		gap: 8mm;
		flex-wrap: wrap;
		margin-top: 4mm;
		font-size: 10pt;
		position: relative;
		z-index: 1;
	}

	.cta-contact .item {
		display: flex;
		flex-direction: column;
		gap: 1mm;
	}

	.cta-contact .label {
		font-size: 8pt;
		letter-spacing: 1.5pt;
		text-transform: uppercase;
		opacity: 0.8;
		font-weight: 600;
	}

	.cta-contact .value {
		font-size: 11pt;
		font-weight: 700;
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
