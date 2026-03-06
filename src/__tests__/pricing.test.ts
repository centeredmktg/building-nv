import { calculateQuoteTotals } from "@/lib/pricing";

describe("calculateQuoteTotals", () => {
  const baseItems = [
    { unitPrice: 100, quantity: 2, isMaterial: false }, // labor: $200
    { unitPrice: 50, quantity: 4, isMaterial: true },   // materials: $200
  ];

  it("calculates subtotal correctly", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.subtotal).toBe(400);
  });

  it("applies materials markup only to material items", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.materialsMarkupAmount).toBe(20); // 10% of $200
  });

  it("applies overhead to subtotal", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.overheadAmount).toBe(40); // 10% of $400
  });

  it("applies profit to subtotal", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.profitAmount).toBe(40); // 10% of $400
  });

  it("calculates total correctly", () => {
    const result = calculateQuoteTotals(baseItems, 10, 10, 10);
    expect(result.total).toBe(500); // 400 + 20 + 40 + 40
  });

  it("handles zero percentages", () => {
    const result = calculateQuoteTotals(baseItems, 0, 0, 0);
    expect(result.total).toBe(400);
  });

  it("handles empty line items", () => {
    const result = calculateQuoteTotals([], 10, 10, 10);
    expect(result.total).toBe(0);
  });
});
