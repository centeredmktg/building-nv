import {
  DETAIL_TYPES,
  CSI_DIVISIONS,
  DetailTypeId,
  getDetailTypeLabel,
  getCsiTitle,
} from "@/lib/detail-library";

describe("DETAIL_TYPES", () => {
  it("contains expected types", () => {
    const ids = DETAIL_TYPES.map((t) => t.id);
    expect(ids).toContain("installation");
    expect(ids).toContain("assembly");
    expect(ids).toContain("connection");
    expect(ids).toContain("flashing");
    expect(ids).toContain("waterproofing");
    expect(ids).toContain("structural");
    expect(ids).toContain("general");
  });

  it("has unique ids", () => {
    const ids = DETAIL_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("CSI_DIVISIONS", () => {
  it("contains Division 07 (Thermal and Moisture Protection)", () => {
    const div = CSI_DIVISIONS.find((d) => d.code === "07");
    expect(div).toBeDefined();
    expect(div!.title).toBe("Thermal and Moisture Protection");
  });

  it("has unique codes", () => {
    const codes = CSI_DIVISIONS.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("getDetailTypeLabel", () => {
  it("returns label for known type", () => {
    expect(getDetailTypeLabel("flashing")).toBe("Flashing");
  });

  it("returns id for unknown type", () => {
    expect(getDetailTypeLabel("nonexistent" as DetailTypeId)).toBe("nonexistent");
  });
});

describe("getCsiTitle", () => {
  it("returns title for known division", () => {
    expect(getCsiTitle("07")).toBe("Thermal and Moisture Protection");
  });

  it("returns null for unknown division", () => {
    expect(getCsiTitle("99")).toBeNull();
  });
});
