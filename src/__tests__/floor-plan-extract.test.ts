import { parseExtractionResponse } from "@/lib/floor-plan-extract";
import type { FloorPlanExtraction } from "@/lib/floor-plan-types";

describe("parseExtractionResponse", () => {
  it("parses valid JSON extraction from Claude response text", () => {
    const text = JSON.stringify({
      walls: [{ x1: 0, y1: 0, x2: 500, y2: 0 }],
      rooms: [{ label: "Kitchen", points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 300 }, { x: 0, y: 300 }] }],
      dimensions: [{ wallIndex: 0, length: 15, unit: "ft" }],
      openings: [{ wallIndex: 0, position: 0.5, type: "door", width: 3 }],
      notes: [],
    });
    const result = parseExtractionResponse(text);
    expect(result.walls).toHaveLength(1);
    expect(result.rooms).toHaveLength(1);
    expect(result.dimensions).toHaveLength(1);
    expect(result.openings).toHaveLength(1);
  });

  it("extracts JSON from text with surrounding markdown", () => {
    const text = `Here is the extraction:\n\`\`\`json\n${JSON.stringify({
      walls: [{ x1: 0, y1: 0, x2: 100, y2: 0 }],
      rooms: [],
      dimensions: [],
      openings: [],
      notes: ["Could not read dimension on north wall"],
    })}\n\`\`\`\nLet me know if you need changes.`;
    const result = parseExtractionResponse(text);
    expect(result.walls).toHaveLength(1);
    expect(result.notes).toHaveLength(1);
  });

  it("returns empty extraction with error note when JSON is invalid", () => {
    const result = parseExtractionResponse("This is not JSON at all");
    expect(result.walls).toEqual([]);
    expect(result.rooms).toEqual([]);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toContain("Failed to parse");
  });

  it("fills in missing arrays with defaults", () => {
    const text = JSON.stringify({ walls: [{ x1: 0, y1: 0, x2: 100, y2: 0 }] });
    const result = parseExtractionResponse(text);
    expect(result.walls).toHaveLength(1);
    expect(result.rooms).toEqual([]);
    expect(result.dimensions).toEqual([]);
    expect(result.openings).toEqual([]);
    expect(result.notes).toEqual([]);
  });
});
