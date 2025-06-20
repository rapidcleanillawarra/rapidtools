fix(ui): Improve order status display with separate colors and clean modal values

This commit enhances the Xero-Maropost History page by fixing modal display issues
and implementing separate color coding for order status transitions.

### Files Modified:

#### 1. `src/routes/(protected)/xero-maropost-history/+page.svelte`
   - FIXED: Modal display showing unnecessary comparison text (e.g., "N/A > $356.44")
   - ADDED: Separate color coding for order status transitions (e.g., "Pick > Dispatched")
   - IMPROVED: User experience with cleaner modal presentation
   
   **Modal Value Display Changes:**
   ```diff
   - <p class="mt-1 text-sm text-gray-900">{displayComparison(modalEntry.maropost_total, modalEntry.xero_total, formatCurrency)}</p>
   + <p class="mt-1 text-sm text-gray-900">{formatCurrency(modalEntry.maropost_total)}</p>
   
   - <p class="mt-1 text-sm text-gray-900">{displayComparison(modalEntry.xero_total, modalEntry.maropost_total, formatCurrency)}</p>
   + <p class="mt-1 text-sm text-gray-900">{formatCurrency(modalEntry.xero_total)}</p>
   ```
   
   **Order Status Color Separation:**
   ```diff
   + // Helper function to render order status with separate colors for comparison
   + function renderOrderStatus(currentStatus: string, previousStatus?: string): { html: string, hasComparison: boolean } {
   +   const current = formatText(currentStatus);
   +   
   +   if (!previousStatus || currentStatus === previousStatus) {
   +     return {
   +       html: current,
   +       hasComparison: false
   +     };
   +   }
   +   
   +   const previous = formatText(previousStatus);
   +   return {
   +     html: `${previous} > ${current}`,
   +     hasComparison: true
   +   };
   + }
   ```
   
   **Order Status Display Implementation:**
   ```diff
   - <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(current.order_status)}">
   -   {displayComparison(formatText(current.order_status), previous?.order_status ? formatText(previous.order_status) : null)}
   - </span>
   + {#if renderOrderStatus(current.order_status, previous?.order_status).hasComparison}
   +   {@const parts = renderOrderStatus(current.order_status, previous?.order_status).html.split(' > ')}
   +   <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(parts[0])}">
   +     {parts[0]}
   +   </span>
   +   <span class="mx-1">></span>
   +   <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(parts[1])}">
   +     {parts[1]}
   +   </span>
   + {:else}
   +   <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(current.order_status)}">
   +     {renderOrderStatus(current.order_status, previous?.order_status).html}
   +   </span>
   + {/if}
   ```

### Technical Improvements:
- **BEFORE**: Modal showed confusing comparison text like "N/A > $356.44" for monetary values
- **AFTER**: Modal displays clean, formatted values without unnecessary comparisons
- **BEFORE**: Order status transitions displayed as single-colored text "Pick > Dispatched"
- **AFTER**: Each status in transition has its own appropriate color (orange for Pick, green for Dispatched)

### Impact:
- **User Experience**: Cleaner modal display eliminates confusion from comparison text
- **Visual Clarity**: Status transitions now clearly show progression with appropriate colors
- **Data Presentation**: Monetary values in modals are now properly formatted without artifacts
- **Maintainability**: Added dedicated function for order status rendering

### Testing:
1. Open Xero-Maropost History page
2. Filter for records with status changes (e.g., Pick to Dispatched)
3. Verify order status shows separate colors for each part of transition
4. Click "View Previous" button on any record
5. Confirm modal shows clean monetary values without comparison text
6. Test with various order status combinations (Pick, Dispatched, etc.)

### Browser Compatibility:
- All changes use standard Svelte syntax compatible with current build system
- No new dependencies or external libraries required
- Responsive design maintained for mobile and desktop views 