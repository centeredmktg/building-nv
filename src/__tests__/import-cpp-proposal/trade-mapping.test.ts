import { sectionTitleForTrade, deriveSlug } from "../../../scripts/import-cpp-proposal/trade-mapping";

describe("sectionTitleForTrade", () => {
  it("maps demolition to 'Demo & Disposal'", () => {
    expect(sectionTitleForTrade("demolition")).toBe("Demo & Disposal");
  });

  it("maps carpentry to 'Framing & Carpentry'", () => {
    expect(sectionTitleForTrade("carpentry")).toBe("Framing & Carpentry");
  });

  it("maps general_labor to 'Equipment & Inspections'", () => {
    expect(sectionTitleForTrade("general_labor")).toBe("Equipment & Inspections");
  });

  it("falls back to trade label for unmapped trades", () => {
    expect(sectionTitleForTrade("plumbing")).toBe("Plumbing");
  });
});

describe("deriveSlug", () => {
  it("kebab-cases street address", () => {
    expect(deriveSlug("2187 Market St")).toBe("2187-market-st");
  });

  it("appends -ti for tenant improvement project type", () => {
    expect(deriveSlug("2187 Market St", "T.I.")).toBe("2187-market-st-ti");
    expect(deriveSlug("2187 Market St", "Tenant Improvement")).toBe("2187-market-st-ti");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(deriveSlug("5401 Longley Ln, Ste #7")).toBe("5401-longley-ln-ste-7");
  });

  it("preserves numbers and lowercases", () => {
    expect(deriveSlug("123 Main St")).toBe("123-main-st");
  });
});
