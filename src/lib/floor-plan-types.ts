// ─── Extraction types (Claude Vision output) ─────────────────────────────────

export interface FloorPlanExtraction {
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  rooms: { label: string; points: { x: number; y: number }[] }[];
  dimensions: { wallIndex: number; length: number; unit: "ft" | "in" }[];
  openings: { wallIndex: number; position: number; type: "door" | "window"; width: number }[];
  notes: string[];
}

// ─── Canvas types (stored in DB as canvasData JSON) ──────────────────────────

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

export interface Room {
  id: string;
  label: string;
  points: { x: number; y: number }[];
  fillColor: string;
}

export interface Dimension {
  id: string;
  wallId: string;
  length: number;
  unit: "ft" | "in";
  offsetX: number;
  offsetY: number;
}

export interface Opening {
  id: string;
  wallId: string;
  position: number;
  type: "door" | "window";
  width: number;
}

export interface Label {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface CanvasData {
  walls: Wall[];
  rooms: Room[];
  dimensions: Dimension[];
  openings: Opening[];
  labels: Label[];
  scale: number;
  gridSize: number;
}

// ─── Room colors (cycled for visual distinction) ─────────────────────────────

const ROOM_COLORS = [
  "rgba(192, 132, 72, 0.12)",
  "rgba(100, 149, 237, 0.12)",
  "rgba(144, 190, 109, 0.12)",
  "rgba(205, 133, 163, 0.12)",
  "rgba(160, 160, 210, 0.12)",
  "rgba(210, 180, 140, 0.12)",
  "rgba(135, 206, 170, 0.12)",
  "rgba(218, 165, 105, 0.12)",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `fp_${Date.now()}_${idCounter}`;
}

export function _resetIdCounter(): void {
  idCounter = 0;
}

export function createEmptyCanvasData(): CanvasData {
  return {
    walls: [],
    rooms: [],
    dimensions: [],
    openings: [],
    labels: [],
    scale: 10,
    gridSize: 20,
  };
}

export function extractionToCanvasData(extraction: FloorPlanExtraction): CanvasData {
  const canvas = createEmptyCanvasData();

  canvas.walls = extraction.walls.map((w) => ({
    id: generateId(),
    x1: w.x1,
    y1: w.y1,
    x2: w.x2,
    y2: w.y2,
    thickness: 6,
  }));

  canvas.rooms = extraction.rooms.map((r, i) => ({
    id: generateId(),
    label: r.label,
    points: r.points,
    fillColor: ROOM_COLORS[i % ROOM_COLORS.length],
  }));

  canvas.dimensions = extraction.dimensions
    .filter((d) => d.wallIndex >= 0 && d.wallIndex < canvas.walls.length)
    .map((d) => ({
      id: generateId(),
      wallId: canvas.walls[d.wallIndex].id,
      length: d.length,
      unit: d.unit,
      offsetX: 0,
      offsetY: -15,
    }));

  canvas.openings = extraction.openings
    .filter((o) => o.wallIndex >= 0 && o.wallIndex < canvas.walls.length)
    .map((o) => ({
      id: generateId(),
      wallId: canvas.walls[o.wallIndex].id,
      position: o.position,
      type: o.type,
      width: o.width,
    }));

  return canvas;
}
