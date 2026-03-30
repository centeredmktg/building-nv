import { generateScopeText, extractGeneralLocation } from "@/lib/bidRequest";

describe("extractGeneralLocation", () => {
  it("extracts city and state from full address", () => {
    expect(extractGeneralLocation("5401 Longley Lane Ste C81, Reno, NV 89511")).toBe("Reno, NV");
  });

  it("returns address as-is if no city/state pattern found", () => {
    expect(extractGeneralLocation("Reno")).toBe("Reno");
  });

  it("handles city, state zip format", () => {
    expect(extractGeneralLocation("123 Main St, Sparks, NV 89431")).toBe("Sparks, NV");
  });

  it("handles empty string", () => {
    expect(extractGeneralLocation("")).toBe("");
  });
});

describe("generateScopeText", () => {
  it("generates scope from line items without pricing", () => {
    const items = [
      { description: "200A panel upgrade", quantity: 1, unit: "ea" },
      { description: "20A circuit rough-in", quantity: 12, unit: "ea" },
      { description: "Recessed lighting installation", quantity: 24, unit: "ea" },
    ];

    const result = generateScopeText(items);

    expect(result).toContain("200A panel upgrade");
    expect(result).toContain("qty: 1 ea");
    expect(result).toContain("20A circuit rough-in");
    expect(result).toContain("qty: 12 ea");
    expect(result).toContain("Recessed lighting installation");
    expect(result).toContain("qty: 24 ea");
    // Must NOT contain dollar amounts
    expect(result).not.toMatch(/\$/);
  });

  it("handles empty items array", () => {
    expect(generateScopeText([])).toBe("");
  });
});
