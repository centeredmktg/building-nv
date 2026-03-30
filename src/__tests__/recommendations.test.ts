import { getTradeRecommendations } from "@/lib/recommendations";
import type { TradeRecommendation } from "@/lib/trades";

// Mock capabilities: can do painting and carpentry, cannot do electrical
const mockCapabilities = [
  { id: "1", trade: "painting", canPerform: true, capacityCheckAvailable: false },
  { id: "2", trade: "carpentry", canPerform: true, capacityCheckAvailable: false },
  { id: "3", trade: "electrical", canPerform: false, capacityCheckAvailable: false },
];

interface MockLineItem {
  id: string;
  trade: string | null;
  description: string;
}

interface MockSection {
  id: string;
  title: string;
  trade: string | null;
  items: MockLineItem[];
}

describe("getTradeRecommendations", () => {
  it("recommends sub_out for trades we cannot perform", () => {
    const sections: MockSection[] = [
      {
        id: "s1",
        title: "Electrical",
        trade: "electrical",
        items: [{ id: "i1", trade: null, description: "Panel upgrade" }],
      },
    ];

    const result = getTradeRecommendations(sections, mockCapabilities);
    expect(result).toEqual([
      { trade: "electrical", recommendation: "sub_out", reason: "No in-house license" },
    ]);
  });

  it("recommends in_house for trades we can perform", () => {
    const sections: MockSection[] = [
      {
        id: "s1",
        title: "Painting",
        trade: "painting",
        items: [{ id: "i1", trade: null, description: "Interior paint" }],
      },
    ];

    const result = getTradeRecommendations(sections, mockCapabilities);
    expect(result).toEqual([
      { trade: "painting", recommendation: "in_house", reason: "Licensed, capacity check unavailable" },
    ]);
  });

  it("uses line item trade over section trade", () => {
    const sections: MockSection[] = [
      {
        id: "s1",
        title: "General",
        trade: "carpentry",
        items: [
          { id: "i1", trade: "electrical", description: "Wire outlets" },
          { id: "i2", trade: null, description: "Trim work" },
        ],
      },
    ];

    const result = getTradeRecommendations(sections, mockCapabilities);
    expect(result).toContainEqual({
      trade: "electrical",
      recommendation: "sub_out",
      reason: "No in-house license",
    });
    expect(result).toContainEqual({
      trade: "carpentry",
      recommendation: "in_house",
      reason: "Licensed, capacity check unavailable",
    });
  });

  it("skips items with no trade at any level", () => {
    const sections: MockSection[] = [
      {
        id: "s1",
        title: "Misc",
        trade: null,
        items: [{ id: "i1", trade: null, description: "Cleanup" }],
      },
    ];

    const result = getTradeRecommendations(sections, mockCapabilities);
    expect(result).toEqual([]);
  });

  it("recommends sub_out for trades not in capabilities at all", () => {
    const sections: MockSection[] = [
      {
        id: "s1",
        title: "Plumbing",
        trade: "plumbing",
        items: [{ id: "i1", trade: null, description: "Rough-in" }],
      },
    ];

    const result = getTradeRecommendations(sections, mockCapabilities);
    expect(result).toEqual([
      { trade: "plumbing", recommendation: "sub_out", reason: "No in-house license" },
    ]);
  });

  it("deduplicates trades across sections", () => {
    const sections: MockSection[] = [
      {
        id: "s1",
        title: "Phase 1 Electric",
        trade: "electrical",
        items: [{ id: "i1", trade: null, description: "Rough-in" }],
      },
      {
        id: "s2",
        title: "Phase 2 Electric",
        trade: "electrical",
        items: [{ id: "i2", trade: null, description: "Finish" }],
      },
    ];

    const result = getTradeRecommendations(sections, mockCapabilities);
    expect(result).toHaveLength(1);
    expect(result[0].trade).toBe("electrical");
  });
});
