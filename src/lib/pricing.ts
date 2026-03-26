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

export interface PaymentMilestone {
  name: string;
  weekNumber: number;
  paymentPct: number | null;
  paymentLabel: string | null;
}

export interface PaymentScheduleRow {
  name: string;
  weekNumber: number;
  paymentLabel: string | null;
  paymentPct: number;
  amount: number;
  balance: number;
}

export function calculatePaymentSchedule(
  milestones: PaymentMilestone[],
  total: number
): PaymentScheduleRow[] {
  const paying = milestones.filter((m) => m.paymentPct != null && m.paymentPct > 0);
  let remaining = round2(total);
  return paying.map((m, i) => {
    const amount = round2((m.paymentPct! / 100) * total);
    remaining = round2(remaining - amount);
    if (i === paying.length - 1) remaining = 0;
    return {
      name: m.name,
      weekNumber: m.weekNumber,
      paymentLabel: m.paymentLabel,
      paymentPct: m.paymentPct!,
      amount,
      balance: remaining,
    };
  });
}
