import {
  TRADES,
  getTradeLabel,
  TradeId,
  ONBOARDING_STATUSES,
  RECOMMENDATION_TYPES,
} from "@/lib/trades";

describe("TRADES", () => {
  it("contains expected trades", () => {
    const ids = TRADES.map((t) => t.id);
    expect(ids).toContain("electrical");
    expect(ids).toContain("plumbing");
    expect(ids).toContain("general_labor");
    expect(ids).toContain("carpentry");
    expect(ids).toContain("other");
  });

  it("has unique ids", () => {
    const ids = TRADES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getTradeLabel", () => {
  it("returns label for known trade", () => {
    expect(getTradeLabel("electrical")).toBe("Electrical");
  });

  it("returns id for unknown trade", () => {
    expect(getTradeLabel("nonexistent" as TradeId)).toBe("nonexistent");
  });
});

describe("ONBOARDING_STATUSES", () => {
  it("contains expected statuses", () => {
    const ids = ONBOARDING_STATUSES.map((s) => s.id);
    expect(ids).toEqual([
      "pending",
      "documents_requested",
      "under_review",
      "approved",
      "suspended",
    ]);
  });
});

describe("RECOMMENDATION_TYPES", () => {
  it("contains three recommendation types", () => {
    const ids = RECOMMENDATION_TYPES.map((r) => r.id);
    expect(ids).toEqual(["in_house", "sub_out", "consider_sub"]);
  });
});
