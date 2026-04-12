import { buildTitleBlock } from "@/lib/floor-plan-export";

describe("buildTitleBlock", () => {
  it("returns title block lines with floor plan name", () => {
    const date = new Date(2026, 3, 11); // April 11, 2026 (month is 0-indexed)
    const lines = buildTitleBlock("Main Floor", null, date);
    expect(lines).toContain("Main Floor");
    expect(lines).toContain("CPP Painting & Construction LLC");
    expect(lines).toContain("April 11, 2026");
  });

  it("includes project name when provided", () => {
    const date = new Date(2026, 3, 11);
    const lines = buildTitleBlock("Main Floor", "Kalter Residence", date);
    expect(lines).toContain("Kalter Residence");
  });

  it("omits project name when null", () => {
    const date = new Date(2026, 3, 11);
    const lines = buildTitleBlock("Main Floor", null, date);
    expect(lines).not.toContain(null);
    expect(lines).toHaveLength(3);
  });
});
