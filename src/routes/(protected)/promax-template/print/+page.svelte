<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { base } from '$app/paths';

  export let data: PageData;
  const defaultTemplateData = {
    topLeft: {
      title: "R.F.S. Concentrate",
      code: "K11",
      logo: `${base}/images/bottle.svg`,
      description: "Hard Surface Cleaner",
      color: "#fee000"
    },
    topRight: {
      title: "Floor Cleaner Pro",
      code: "K12",
      logo: `${base}/images/scrubber.svg`,
      description: "Floor Cleaner",
      color: "#00a2ff"
    },
    bottomLeft: {
      title: "Crystal Clean",
      code: "K14",
      logo: `${base}/images/sink_fill.svg`,
      description: "Glass Cleaner",
      color: "#a855f7"
    },
    bottomRight: {
      title: "Multi-Clean Plus",
      code: "K13",
      logo: `${base}/images/bucket.svg`,
      description: "Multi-Purpose Cleaner",
      color: "#22c55e"
    },
    instruction: "Mix with water according to label instructions"
  };
  const templateData = { ...defaultTemplateData, ...data.templateData };

  // Remove auto-print for now so we can see the template
  // onMount(() => {
  //   window.print();
  // });
</script>

<div class="print-page">
  <div class="template-box">
    <!-- Branding Background -->
    <div class="branding-background">
      <!-- Company Logo -->
      <div class="company-logo">
        <div class="company-logo-box">
          <img 
            src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png" 
            alt="Rapid Supplies Logo"
          />
        </div>
      </div>
      <!-- Company Details -->
      <div class="company-details">
              <div class="company-details-box">
        <div>📞 4227 2833</div>
        <div>🌐 rapidsupplies.com.au</div>
      </div>
      </div>
    </div>
    <!-- Instruction -->
    <div class="instruction">
      <div>{templateData.instruction}</div>
    </div>
    <!-- Green Arc Overlay (Top) -->
    <div class="green-arc-top">
      <img 
        src="{base}/images/green_arc.png" 
        alt="Green Arc Top"
      />
    </div>
    <!-- Product Dial Container -->
      <div class="product-dial">
    <div class="center-circle"></div>
    <div class="product-dial-grid">
      <div class="product-section top-left" style="background-color: {templateData.topLeft.color};">
        <div class="product-content">
          <div class="product-title">{templateData.topLeft.title}</div>
          <div class="product-code-logo">
            <div class="product-code">{templateData.topLeft.code}</div>
            <div class="product-logo-placeholder">
              <img src={templateData.topLeft.logo} alt="Product Icon" />
            </div>
          </div>
        </div>
        <div class="product-description">{templateData.topLeft.description}</div>
      </div>
        <div class="product-section top-right" style="background-color: {templateData.topRight.color};">
          <div class="product-content">
            <div class="product-title">{templateData.topRight.title}</div>
            <div class="product-code-logo">
              <div class="product-code">{templateData.topRight.code}</div>
              <div class="product-logo-placeholder">
                <img src={templateData.topRight.logo} alt="Product Icon" />
              </div>
            </div>
          </div>
          <div class="product-description">{templateData.topRight.description}</div>
        </div>
        <div class="product-section bottom-left" style="background-color: {templateData.bottomLeft.color};">
          <div class="product-content">
            <div class="product-description">{templateData.bottomLeft.description}</div>
            <div class="product-code-logo">
              <div class="product-code">{templateData.bottomLeft.code}</div>
              <div class="product-logo-placeholder">
                <img src={templateData.bottomLeft.logo} alt="Product Icon" />
              </div>
            </div>
            <div class="product-title">{templateData.bottomLeft.title}</div>
          </div>
        </div>
        <div class="product-section bottom-right" style="background-color: {templateData.bottomRight.color};">
          <div class="product-content">
            <div class="product-description">{templateData.bottomRight.description}</div>
            <div class="product-code-logo">
              <div class="product-code">{templateData.bottomRight.code}</div>
              <div class="product-logo-placeholder">
                <img src={templateData.bottomRight.logo} alt="Product Icon" />
              </div>
            </div>
            <div class="product-title">{templateData.bottomRight.title}</div>
          </div>
        </div>
      </div>
    </div>
    <!-- Green Arc Overlay (Bottom) -->
    <div class="green-arc-bottom">
      <img 
        src="{base}/images/green_arc.png" 
        alt="Green Arc Bottom"
      />
    </div>
  </div>
</div>

<style>
  /* Full page printing setup */
  :global(body) {
    margin: 0;
    padding: 0;
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: A4;
    margin: 0;
  }

  .print-page {
    width: 210mm;  /* A4 width */
    height: 297mm; /* A4 height */
    background: white;
    position: relative;
    margin: 0 auto;
    padding: 20mm; /* Add padding for spacing */
    box-sizing: border-box;
  }

  .template-box {
    width: 255pt;
    height: 596pt; /* Increased from 582pt to add 14pt (0.5cm) at top */
    position: relative;
    margin: 0 auto; /* Center the template within the page */
    overflow: hidden; /* Hide content that goes outside the box */
    /* border: 1px solid #e0e0e0; Add subtle border for visibility */
  }

  .branding-background {
    width: 255pt;
    height: 153pt;
    position: relative;
    top: 14pt; /* Moved down by 14pt to add space at top */
    background-color: #000000 !important;
    border-top-left-radius: 7%;
    border-top-right-radius: 7%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .company-logo {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 20pt; /* Increased from 22pt (22 + 14) */
    z-index: 10;
  }

  .company-logo-box {
    width: 150pt;
    height: 50pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .company-logo-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .company-details {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 80pt; /* Increased from 82pt (82 + 14) */
    font-weight: 600;
    color: #ffffff !important;
    z-index: 10;
  }

  .company-details-box {
    width: 160pt;
    height: 30pt;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .instruction {
    position: absolute;
    top: 216pt; /* Increased from 202pt (202 + 14) */
    left: 50%;
    height: 20pt;
    transform: translateX(-50%);
    width: 255pt;
    font-size: 12pt;
    font-weight: 500;
    text-align: center;
    z-index: 2;
    color: #000000;
  }

  .green-arc-top {
    position: absolute;
    top: 20pt; /* Increased from 6pt (6 + 14) */
    left: 0;
    width: 255pt;
    height: 180pt;
    z-index: 1;
  }

  .green-arc-top img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
  }

  .green-arc-bottom {
    position: absolute;
    top: 198pt; /* Increased from 184pt (184 + 14) */
    left: 0;
    width: 255pt;
    height: auto;
    z-index: 0;
  }

  .green-arc-bottom img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .product-dial {
    position: absolute;
    top: 336pt; /* Increased from 322pt (322 + 14) */
    left: 0;
    width: 255pt;
    height: 260pt;
    background-color: #ffffff !important;
    border-bottom-left-radius: 7%;
    border-bottom-right-radius: 7%;
    padding: 0;
    z-index: 2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .center-circle {
    position: absolute;
    width: 139.9pt;
    height: 141.3pt;
    border: 1px solid #000000;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 3;
    background-color: #ffffff !important;
  }

  .product-dial-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    width: 100%;
    height: 100%;
  }

  .product-section {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 0.75rem;
    font-size: 12pt;
    color: #000000 !important;
    font-weight: 500;
    position: relative;
  }

  .product-section:nth-child(3) {
    border-right: 1px solid #000000;
  }

  .product-section:nth-child(2) {
    border-bottom: 1px solid #000000;
  }

  /* Top-left section styling - all contained here for easier maintenance */
  .product-section.top-left {
    padding: 0;
  }

  .product-section.top-left .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .product-section.top-left .product-title {
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    margin-top: 5pt;
    width: 117pt;
    font-size: 10pt;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.top-left .product-description {
    position: absolute;
    bottom: 5pt;
    left: 5pt;
    width: 50pt;
    height: 50pt;
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    font-size: 8pt;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.top-left .product-code-logo {
    display: flex;
    background-color: rgb(30, 30, 30) !important;
    margin-top: 5pt;
    width: 117pt;
    font-size: 20pt;
    height: 25pt;
    border-radius: 10pt;
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.top-left .product-code {
    flex: 1;
    color: #ffffff !important;
    padding: 4pt 8pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.top-left .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 20pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.top-left .product-logo-placeholder img {
    width: 25pt;
    height: 22pt;
  }

  /* Top-right section styling - all contained here for easier maintenance */
  .product-section.top-right {
    padding: 0;
    border: none !important;
  }

  .product-section.top-right .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .product-section.top-right .product-title {
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    margin-top: 5pt;
    width: 117pt;
    font-size: 10pt;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.top-right .product-description {
    position: absolute;
    bottom: 5pt;
    right: 5pt;
    width: 50pt;
    height: 50pt;
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    font-size: 8pt;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.top-right .product-code-logo {
    display: flex;
    background-color: rgb(30, 30, 30) !important;
    margin-top: 5pt;
    width: 117pt;
    font-size: 20pt;
    height: 25pt;
    border-radius: 10pt;
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.top-right .product-code {
    flex: 1;
    color: #ffffff !important;
    padding: 4pt 8pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.top-right .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 20pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.top-right .product-logo-placeholder img {
    width: 25pt;
    height: 22pt;
  }

  /* Bottom-right section styling - all contained here for easier maintenance */
  .product-section.bottom-right {
    padding: 0;
    border-bottom-right-radius: 7%;
    border: none !important;
  }

  .product-section.bottom-right .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    justify-content: space-between;
    height: 100%;
  }

  .product-section.bottom-right .product-description {
    position: absolute;
    top: 5pt;
    right: 5pt;
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    width: 50pt;
    height: 50pt;
    font-size: 8pt;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.bottom-right .product-title {
    position: absolute;
    bottom: 5pt;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    width: 117pt;
    font-size: 10pt;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.bottom-right .product-code-logo {
    position: absolute;
    bottom: 35pt;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    background-color: rgb(30, 30, 30) !important;
    width: 117pt;
    font-size: 20pt;
    height: 25pt;
    border-radius: 10pt;
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.bottom-right .product-code {
    flex: 1;
    color: #ffffff !important;
    padding: 4pt 8pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.bottom-right .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 20pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.bottom-right .product-logo-placeholder img {
    width: 25pt;
    height: 22pt;
  }

  /* Bottom-left section styling - all contained here for easier maintenance */
  .product-section.bottom-left {
    padding: 0;
    border-bottom-left-radius: 7%;
    border: none !important;
  }

  .product-section.bottom-left .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    justify-content: space-between;
    height: 100%;
  }

  .product-section.bottom-left .product-description {
    position: absolute;
    top: 5pt;
    left: 5pt;
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    width: 50pt;
    height: 50pt;
    font-size: 8pt;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.bottom-left .product-code-logo {
    position: absolute;
    bottom: 35pt;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    background-color: rgb(30, 30, 30) !important;
    width: 117pt;
    font-size: 20pt;
    height: 25pt;
    border-radius: 10pt;
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-section.bottom-left .product-code {
    flex: 1;
    color: #ffffff !important;
    padding: 4pt 8pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.bottom-left .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 20pt;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.bottom-left .product-logo-placeholder img {
    width: 25pt;
    height: 22pt;
  }

  .product-section.bottom-left .product-title {
    position: absolute;
    bottom: 5pt;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgb(30, 30, 30) !important;
    color: #ffffff !important;
    padding: 4pt 8pt;
    border-radius: 4pt;
    width: 117pt;
    font-size: 10pt;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Print styles */
  @media print {
    :global(body) {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .print-page {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 20mm;
    }

    .branding-background {
      background-color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .product-dial {
      background-color: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .company-details {
      color: #ffffff !important;
    }

    .product-section {
      color: #000000 !important;
    }
  }

  /* Screen display styles */
  @media screen {
    .print-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
  }
</style> 