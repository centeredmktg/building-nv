interface ScopeLineItem {
  description: string;
  quantity: number;
  unit: string;
}

/**
 * Extracts city and state from an address string.
 * Looks for "City, ST" or "City, ST ZIP" pattern.
 */
export function extractGeneralLocation(address: string): string {
  if (!address) return "";

  // Match "City, ST" or "City, ST ZIP" — the last occurrence in the string
  const match = address.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*\d{0,5}\s*$/);
  if (match) {
    return `${match[1].trim()}, ${match[2]}`;
  }

  return address;
}

/**
 * Generates a scope of work text from line items.
 * Includes descriptions and quantities only — no pricing.
 */
export function generateScopeText(items: ScopeLineItem[]): string {
  if (items.length === 0) return "";

  return items
    .map((item) => `- ${item.description} (qty: ${item.quantity} ${item.unit})`)
    .join("\n");
}
