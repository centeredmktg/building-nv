export interface PricingItem {
  unitPrice: number;
  quantity: number;
  isMaterial: boolean;
}

export interface QuoteTotals {
  subtotal: number;
  materialsSubtotal: number;
  materialsMarkupAmount: number;
  overheadAmount: number;
  profitAmount: number;
  total: number;
}

export function calculateQuoteTotals(
  items: PricingItem[],
  materialMarkupPct: number,
  overheadPct: number,
  profitPct: number
): QuoteTotals {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const materialsSubtotal = items
    .filter((i) => i.isMaterial)
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const materialsMarkupAmount = round2(materialsSubtotal * (materialMarkupPct / 100));
  const overheadAmount = round2(subtotal * (overheadPct / 100));
  const profitAmount = round2(subtotal * (profitPct / 100));
  const total = round2(subtotal + materialsMarkupAmount + overheadAmount + profitAmount);

  return {
    subtotal: round2(subtotal),
    materialsSubtotal: round2(materialsSubtotal),
    materialsMarkupAmount,
    overheadAmount,
    profitAmount,
    total,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
