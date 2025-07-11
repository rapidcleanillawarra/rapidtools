<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  const defaultTemplateData = {
    topLeft: "R.F.S. Concentrate",
    topRight: "",
    bottomLeft: "",
    bottomRight: "",
    instruction: ""
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
          <div>☎ 4227 2833</div>
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
        src="/images/green_arc.png" 
        alt="Green Arc Top"
      />
    </div>
    <!-- Product Dial Container -->
      <div class="product-dial">
    <div class="center-circle"></div>
    <div class="product-dial-grid">
      <div class="product-section">
        <div class="product-content">
          <div class="product-title">{templateData.topLeft}</div>
          <div class="product-code-logo">
            <div class="product-code">K11</div>
            <div class="product-logo-placeholder">Image</div>
          </div>
        </div>
      </div>
        <div class="product-section">
          <div>{templateData.topRight}</div>
        </div>
        <div class="product-section">
          <div>{templateData.bottomLeft}</div>
        </div>
        <div class="product-section">
          <div>{templateData.bottomRight}</div>
        </div>
      </div>
    </div>
    <!-- Green Arc Overlay (Bottom) -->
    <div class="green-arc-bottom">
      <img 
        src="/images/green_arc.png" 
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
    height: 610pt;
    position: relative;
    margin: 0 auto; /* Center the template within the page */
    /* border: 1px solid #e0e0e0; Add subtle border for visibility */
  }

  .branding-background {
    width: 255pt;
    height: 180pt;
    position: relative;
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
    top: 50pt;
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
    top: 110pt;
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
    top: 230pt;
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
    top: 34pt;
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
    top: 212pt;
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
    top: 350pt;
    left: 0;
    width: 255pt;
    height: 260pt;
    background-color: #ffffff !important;
    border: 1px solid #000000;
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

  .product-section:nth-child(1) {
    padding: 0;
  }

  .product-section:nth-child(1),
  .product-section:nth-child(3) {
    border-right: 1px solid #000000;
  }

  .product-section:nth-child(1),
  .product-section:nth-child(2) {
    border-bottom: 1px solid #000000;
  }

  .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .product-title {
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

  .product-code-logo {
    display: flex;
    background-color: rgb(30, 30, 30) !important;
    margin-top: 5pt;
    width: 117pt;
    font-size: 15pt;
    height: 25pt;
    border-radius: 5%;
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-code {
    flex: 1;
    color: #ffffff !important;
    padding: 4pt 8pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
  }

  .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 20pt;
    display: flex;
    align-items: center;
    justify-content: center;
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
      border: 1px solid #000000 !important;
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