import {
  createEmptyCanvasData,
  extractionToCanvasData,
  type CanvasData,
  type FloorPlanExtraction,
} from "@/lib/floor-plan-types";

describe("createEmptyCanvasData", () => {
  it("returns a valid empty canvas", () => {
    const canvas = createEmptyCanvasData();
    expect(canvas.walls).toEqual([]);
    expect(canvas.rooms).toEqual([]);
    expect(canvas.dimensions).toEqual([]);
    expect(canvas.openings).toEqual([]);
    expect(canvas.labels).toEqual([]);
    expect(canvas.scale).toBe(10);
    expect(canvas.gridSize).toBe(20);
  });
});

describe("extractionToCanvasData", () => {
  it("converts extraction walls to canvas walls with IDs", () => {
    const extraction: FloorPlanExtraction = {
      walls: [{ x1: 0, y1: 0, x2: 500, y2: 0 }],
      rooms: [],
      dimensions: [],
      openings: [],
      notes: [],
    };
    const canvas = extractionToCanvasData(extraction);
    expect(canvas.walls).toHaveLength(1);
    expect(canvas.walls[0].id).toBeDefined();
    expect(canvas.walls[0].x1).toBe(0);
    expect(canvas.walls[0].y1).toBe(0);
    expect(canvas.walls[0].x2).toBe(500);
    expect(canvas.walls[0].y2).toBe(0);
    expect(canvas.walls[0].thickness).toBe(6);
  });

  it("converts extraction rooms to canvas rooms with IDs and colors", () => {
    const extraction: FloorPlanExtraction = {
      walls: [],
      rooms: [{ label: "Kitchen", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] }],
      dimensions: [],
      openings: [],
      notes: [],
    };
    const canvas = extractionToCanvasData(extraction);
    expect(canvas.rooms).toHaveLength(1);
    expect(canvas.rooms[0].id).toBeDefined();
    expect(canvas.rooms[0].label).toBe("Kitchen");
    expect(canvas.rooms[0].fillColor).toBeDefined();
  });

  it("converts extraction dimensions with wall ID references", () => {
    const extraction: FloorPlanExtraction = {
      walls: [{ x1: 0, y1: 0, x2: 500, y2: 0 }],
      rooms: [],
      dimensions: [{ wallIndex: 0, length: 12, unit: "ft" }],
      openings: [],
      notes: [],
    };
    const canvas = extractionToCanvasData(extraction);
    expect(canvas.dimensions).toHaveLength(1);
    expect(canvas.dimensions[0].wallId).toBe(canvas.walls[0].id);
    expect(canvas.dimensions[0].length).toBe(12);
    expect(canvas.dimensions[0].unit).toBe("ft");
  });

  it("converts extraction openings with wall ID references", () => {
    const extraction: FloorPlanExtraction = {
      walls: [{ x1: 0, y1: 0, x2: 500, y2: 0 }],
      rooms: [],
      dimensions: [],
      openings: [{ wallIndex: 0, position: 0.5, type: "door", width: 3 }],
      notes: [],
    };
    const canvas = extractionToCanvasData(extraction);
    expect(canvas.openings).toHaveLength(1);
    expect(canvas.openings[0].wallId).toBe(canvas.walls[0].id);
    expect(canvas.openings[0].type).toBe("door");
  });

  it("skips dimensions and openings with invalid wallIndex", () => {
    const extraction: FloorPlanExtraction = {
      walls: [{ x1: 0, y1: 0, x2: 500, y2: 0 }],
      rooms: [],
      dimensions: [{ wallIndex: 5, length: 12, unit: "ft" }],
      openings: [{ wallIndex: 99, position: 0.5, type: "door", width: 3 }],
      notes: [],
    };
    const canvas = extractionToCanvasData(extraction);
    expect(canvas.dimensions).toHaveLength(0);
    expect(canvas.openings).toHaveLength(0);
  });
});
