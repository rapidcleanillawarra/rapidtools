feat(promax-template): Add template layout with print functionality

Creates a new Promax Template page with precise layout and print capabilities.

### Files Modified:

#### 1. `src/routes/(protected)/promax-template/+page.svelte`
- ADDED: Template layout with exact dimensions (255pt × 610pt)
- ADDED: Branding section with company logo and details
- ADDED: Product dial with 4-section grid layout
- ADDED: Print functionality with pixel-perfect output
- DIFF:
  ```diff
  + <div class="branding-background">
  +   <!-- Company Logo -->
  +   <div class="company-logo">
  +     <div class="company-logo-box">
  +       <img src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png" />
  +     </div>
  +   </div>
  + </div>

  + <div class="product-dial">
  +   <div class="product-dial-grid">
  +     <div class="product-section border-r border-b border-white/20">
  +       <div class="text-white">Top Left</div>
  +     </div>
  +     <!-- Additional sections... -->
  +   </div>
  + </div>
  ```

### Key Features:
1. **Layout Components**:
   - Branding background (255pt × 230pt) with 12% border radius
   - Company logo (150pt × 50pt) positioned 50pt from top
   - Company details section 15pt below logo
   - Green arc overlays for visual design
   - Product dial with 4-section grid layout

2. **Print Functionality**:
   - Hidden iframe approach for clean printing
   - Exact dimensions preserved (255pt × 610pt)
   - Zero margins for precise output
   - Scale transformation for perfect rendering

### Technical Improvements:

#### Layout Precision:
- BEFORE: N/A (new feature)
- AFTER: Pixel-perfect layout using point-to-pixel conversion (1pt = 1.333333px)

#### Print Implementation:
- BEFORE: N/A (new feature)
- AFTER: Clean iframe-based printing with exact dimensions and styling

### Testing Instructions:
1. Navigate to the Promax Template page
2. Verify layout dimensions:
   - Overall: 255pt × 610pt
   - Branding: 255pt × 230pt
   - Logo: 150pt × 50pt
3. Test print functionality:
   - Click print button
   - Confirm print preview shows correct dimensions
   - Verify all elements are positioned correctly

### Additional Context:
- No breaking changes
- No external dependencies added
- Requires image assets:
  - Company logo
  - Green arc overlays
