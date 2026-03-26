import { calculateQuoteTotals, calculatePaymentSchedule } from "@/lib/pricing";

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

describe("calculatePaymentSchedule", () => {
  it("calculates amounts and running balance from milestones", () => {
    const milestones = [
      { name: "Contract Signed", weekNumber: 0, paymentPct: 10, paymentLabel: "Signing" },
      { name: "Demolition", weekNumber: 1, paymentPct: 25, paymentLabel: "Materials" },
      { name: "Flooring", weekNumber: 2, paymentPct: 60, paymentLabel: "Phase 2" },
      { name: "Punch List", weekNumber: 3, paymentPct: 5, paymentLabel: "Completion" },
    ];
    const total = 10000;

    const schedule = calculatePaymentSchedule(milestones, total);

    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toEqual({ name: "Contract Signed", weekNumber: 0, paymentLabel: "Signing", paymentPct: 10, amount: 1000, balance: 9000 });
    expect(schedule[1]).toEqual({ name: "Demolition", weekNumber: 1, paymentLabel: "Materials", paymentPct: 25, amount: 2500, balance: 6500 });
    expect(schedule[2]).toEqual({ name: "Flooring", weekNumber: 2, paymentLabel: "Phase 2", paymentPct: 60, amount: 6000, balance: 500 });
    expect(schedule[3]).toEqual({ name: "Punch List", weekNumber: 3, paymentLabel: "Completion", paymentPct: 5, amount: 500, balance: 0 });
  });

  it("skips milestones with no paymentPct", () => {
    const milestones = [
      { name: "Signing", weekNumber: 0, paymentPct: 100, paymentLabel: "Full" },
      { name: "Work", weekNumber: 1, paymentPct: null, paymentLabel: null },
    ];

    const schedule = calculatePaymentSchedule(milestones, 5000);

    expect(schedule).toHaveLength(1);
    expect(schedule[0].amount).toBe(5000);
    expect(schedule[0].balance).toBe(0);
  });
});
