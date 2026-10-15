import { normalizeSkuKey } from '../stores';
import type { ImportTargetField, ImportPreviewItem, ImportRowStatus } from '../types';

/**
 * Detect delimiter by counting frequencies in the first non-empty rows.
 */
export function detectDelimiter(text: string): '\t' | ',' | ';' | '|' {
  const sample = text.split(/\r\n|\n/).slice(0, 5).join('\n');
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  const pipes = (sample.match(/\|/g) || []).length;

  if (tabs >= commas && tabs >= semicolons && tabs > 0) return '\t';
  if (commas >= semicolons && commas > 0) return ',';
  if (semicolons > 0) return ';';
  if (pipes > 0) return '|';
  return '\t'; // Default to tab for Excel copy-paste
}

/**
 * Splits clipboard text into a 2D string grid.
 */
export function parseClipboardToGrid(text: string, customDelimiter?: string): string[][] {
  if (!text || !text.trim()) return [];
  const delimiter = customDelimiter || detectDelimiter(text);
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');

  const grid: string[][] = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;

    // Split with basic CSV quote escape handling
    let cells: string[];
    if (delimiter === '\t') {
      cells = line.split('\t').map(c => c.trim());
    } else {
      // Regex handling quoted CSV values
      const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`, 'g');
      cells = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        cells.push((val ?? '').trim());
      }
    }
    if (cells.some(c => c !== '')) {
      grid.push(cells);
    }
  }
  return grid;
}

/**
 * Sanitize number inputs: removes currency symbols, commas, percent, whitespace.
 */
export function cleanNumericValue(val: unknown): number | null {
  if (val == null) return null;
  const str = String(val).replace(/[\$,\s%]/g, '').trim();
  if (!str) return null;
  const num = parseFloat(str);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Auto-detect column mappings from header names.
 */
export function guessColumnMapping(firstRow: string[]): ImportTargetField[] {
  return firstRow.map(rawHeader => {
    const h = rawHeader.toLowerCase().trim();
    if (/sku|item(\s*|_)?code|product(\s*|_)?code|part(\s*|_)?number/i.test(h)) return 'sku';
    if (/purchase|cost|buy|wholesale|supplier(\s*|_)?price|^price$/i.test(h)) return 'purchase_price';
    if (/rrp|list(\s*|_)?price|retail|sell|sale(\s*|_)?price/i.test(h)) return 'rrp';
    if (/gpp|gross(\s*|_)?profit/i.test(h)) return 'gpp';
    if (/markup|mup|margin/i.test(h)) return 'markup';
    return 'ignore';
  });
}

/**
 * Match parsed grid rows against loaded products list.
 */
export function matchImportRowsWithProducts(
  grid: string[][],
  columnMappings: ImportTargetField[],
  hasHeaderRow: boolean,
  productsList: any[]
): ImportPreviewItem[] {
  // Create quick lookup map by normalized SKU
  const productMap = new Map<string, any>();
  for (const p of productsList) {
    if (p?.sku) {
      productMap.set(normalizeSkuKey(p.sku), p);
    }
  }

  const skuColIdx = columnMappings.indexOf('sku');
  const purchaseColIdx = columnMappings.indexOf('purchase_price');
  const rrpColIdx = columnMappings.indexOf('rrp');
  const gppColIdx = columnMappings.indexOf('gpp');
  const markupColIdx = columnMappings.indexOf('markup');

  const startIndex = hasHeaderRow ? 1 : 0;
  const results: ImportPreviewItem[] = [];
  const seenSkus = new Set<string>();

  for (let i = startIndex; i < grid.length; i++) {
    const row = grid[i];
    const rawSku = (skuColIdx >= 0 ? row[skuColIdx] : row[0])?.trim() || '';
    if (!rawSku) continue;

    const normalized = normalizeSkuKey(rawSku);
    const existingProduct = productMap.get(normalized);

    const rawPurchase = purchaseColIdx >= 0 ? cleanNumericValue(row[purchaseColIdx]) : null;
    const rawRrp = rrpColIdx >= 0 ? cleanNumericValue(row[rrpColIdx]) : null;
    const rawGpp = gppColIdx >= 0 ? cleanNumericValue(row[gppColIdx]) : null;
    const rawMarkup = markupColIdx >= 0 ? cleanNumericValue(row[markupColIdx]) : null;

    let status: ImportRowStatus = 'ready';
    let statusMessage = '';

    if (!existingProduct) {
      status = 'unmatched_sku';
      statusMessage = 'SKU not found in current inventory list';
    } else if (seenSkus.has(normalized)) {
      status = 'duplicate_sku';
      statusMessage = 'Duplicate SKU in import list (prior row takes precedence)';
    } else if (rawPurchase == null && rawRrp == null && rawMarkup == null && rawGpp == null) {
      status = 'invalid_number';
      statusMessage = 'No valid price or markup provided in this row';
    }

    seenSkus.add(normalized);

    // Determine primary source for pricing recalculation
    let primarySource: 'purchase_price' | 'rrp' | 'markup' | 'gpp' = 'purchase_price';
    if (rawPurchase != null && (rawRrp != null || rawGpp != null)) {
      // If purchase price is provided alongside list or gpp, prioritize the pricing target
      primarySource = rawRrp != null ? 'rrp' : rawGpp != null ? 'gpp' : 'purchase_price';
    } else if (rawPurchase != null) {
      primarySource = 'purchase_price';
    } else if (rawRrp != null) {
      primarySource = 'rrp';
    } else if (rawGpp != null) {
      primarySource = 'gpp';
    } else if (rawMarkup != null) {
      primarySource = 'markup';
    }

    results.push({
      id: `row-${i}-${rawSku}`,
      rawSku,
      matchedSku: existingProduct?.sku,
      productName: existingProduct?.product_name || existingProduct?.Model || '',
      brand: existingProduct?.brand || existingProduct?.Brand || '',
      currentPurchasePrice: existingProduct?.purchase_price,
      currentRrp: existingProduct?.rrp,
      currentMarkup: existingProduct?.markup,
      newPurchasePrice: rawPurchase ?? undefined,
      newRrp: rawRrp ?? undefined,
      newMarkup: rawMarkup ?? undefined,
      newGpp: rawGpp ?? undefined,
      primarySource,
      status,
      statusMessage,
      selected: status === 'ready'
    });
  }

  return results;
}
