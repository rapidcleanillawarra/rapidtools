feat(gross-profit-calculator): Add SKU links and improve styling

This commit enhances the user interface of the Gross Profit Calculator by making SKU values clickable links that direct users to the product page. Additionally, it improves the styling of these links for better user experience.

### Files Modified:

#### 1. `src/routes/gross-profit-calculator/+page.svelte`
   - ADDED: Anchor tags around SKU values to link to product pages.
   - ADDED: CSS styles for SKU links to ensure they are visually distinct and indicate they open in a new tab.
   - DIFF:
   ```diff
   - <td>{line.sku}</td>
   + <td>
   +   <a 
   +     href={`https://www.rapidsupplies.com.au/_cpanel/products/view?sku=${line.sku}`} 
   +     target="_blank"
   +     rel="noopener noreferrer"
   +     class="sku-link"
   +   >
   +     {line.sku}
   +   </a>
   + </td>
   ```

#### 2. `src/routes/gross-profit-calculator/services/gpp.service.ts`
   - NO CHANGES: This file remains unchanged as the previous modifications were already in place.

### Technical Improvements:
- BEFORE: SKU values were plain text, making it difficult for users to access product details.
- AFTER: SKU values are now clickable links, enhancing user navigation and experience.

### Testing Instructions:
- Verify that clicking on a SKU link opens the correct product page in a new tab.
- Ensure that the styling of the links is consistent with the overall design of the application.
