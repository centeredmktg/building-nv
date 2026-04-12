# Floor Plan Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scan-to-digital floor plan tool that uses Claude Vision to extract walls, rooms, and dimensions from scanned hand-drawn sketches, renders them on an interactive canvas for correction, and exports clean PDF/PNG artifacts.

**Architecture:** Upload scanned image → Claude Haiku Vision extracts structured JSON → react-konva canvas renders extraction as interactive objects → user corrects errors → save to DB → export PDF/PNG. Follows existing patterns: API route mirrors `/api/compliance/chat`, Claude integration extends `src/lib/claude.ts`, file upload uses existing `/api/upload`.

**Tech Stack:** react-konva, konva, jsPDF, @anthropic-ai/sdk (existing), @vercel/blob (existing), Prisma, Next.js App Router

---

### File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add `FloorPlan` model |
| Create | `src/lib/floor-plan-types.ts` | TypeScript types for CanvasData, FloorPlanExtraction, etc. |
| Create | `src/lib/floor-plan-extract.ts` | Claude Vision extraction logic — prompt + response parsing |
| Create | `src/lib/floor-plan-export.ts` | PDF/PNG export utilities |
| Create | `src/app/api/floor-plans/extract/route.ts` | API route — upload image → Claude Vision → JSON |
| Create | `src/app/api/floor-plans/[id]/route.ts` | API route — save/update floor plan canvasData |
| Create | `src/app/internal/floor-plans/page.tsx` | Listing page — grid of saved floor plans |
| Create | `src/app/internal/floor-plans/new/page.tsx` | Upload + extract flow |
| Create | `src/app/internal/floor-plans/new/NewFloorPlanForm.tsx` | Client component — upload, name, project select, extract button |
| Create | `src/app/internal/floor-plans/[id]/edit/page.tsx` | Editor page — server wrapper |
| Create | `src/app/internal/floor-plans/[id]/edit/FloorPlanEditor.tsx` | Client component — react-konva canvas editor |
| Create | `src/app/internal/floor-plans/[id]/edit/Toolbar.tsx` | Client component — tool buttons, undo/redo, background toggle |
| Create | `src/app/internal/floor-plans/[id]/edit/SidePanel.tsx` | Client component — name, project, export buttons, save |
| Modify | `src/components/internal/InternalNav.tsx` | Add "Floor Plans" nav link |
| Create | `src/__tests__/floor-plan-types.test.ts` | Tests for type validation helpers |
| Create | `src/__tests__/floor-plan-extract.test.ts` | Tests for extraction response parsing |
| Create | `src/__tests__/floor-plan-export.test.ts` | Tests for export utilities |

---

### Task 1: Install dependencies and add FloorPlan model

**Files:**
- Modify: `package.json` (add dependencies)
- Modify: `prisma/schema.prisma` (add FloorPlan model, add relation to Project)

- [ ] **Step 1: Install npm dependencies**

Run: `npm install konva react-konva jspdf`

Expected: Packages added to package.json and node_modules.

- [ ] **Step 2: Add FloorPlan model to schema.prisma**

Append to the end of `prisma/schema.prisma`:

```prisma
// ─── Floor Plan Designer ─────────────────────────────────────────────────────

model FloorPlan {
  id             String   @id @default(cuid())
  name           String
  projectId      String?
  project        Project? @relation(fields: [projectId], references: [id])
  sourceImageUrl String?
  canvasData     Json
  thumbnailUrl   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

- [ ] **Step 3: Add the relation to the Project model**

In the `Project` model, add after the `bidRequests` field:

```prisma
  floorPlans       FloorPlan[]
```

- [ ] **Step 4: Run the migration**

Run: `npx prisma migrate dev --name add-floor-plan`

Expected: Migration created and applied. Prisma Client regenerated.

- [ ] **Step 5: Stage and commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/ package.json package-lock.json
git commit -m "feat(schema): add FloorPlan model and install konva/jspdf dependencies"
```

---

### Task 2: Create shared types

**Files:**
- Create: `src/lib/floor-plan-types.ts`
- Create: `src/__tests__/floor-plan-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/floor-plan-types.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/floor-plan-types.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/floor-plan-types.ts`:

```typescript
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
  "rgba(192, 132, 72, 0.12)",   // warm amber
  "rgba(100, 149, 237, 0.12)",  // cornflower
  "rgba(144, 190, 109, 0.12)",  // sage
  "rgba(205, 133, 163, 0.12)",  // rose
  "rgba(160, 160, 210, 0.12)",  // lavender
  "rgba(210, 180, 140, 0.12)",  // tan
  "rgba(135, 206, 170, 0.12)",  // mint
  "rgba(218, 165, 105, 0.12)",  // sandy
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `fp_${Date.now()}_${idCounter}`;
}

/** Reset ID counter — for testing only */
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

  // Convert walls — assign IDs
  canvas.walls = extraction.walls.map((w) => ({
    id: generateId(),
    x1: w.x1,
    y1: w.y1,
    x2: w.x2,
    y2: w.y2,
    thickness: 6,
  }));

  // Convert rooms — assign IDs and cycle colors
  canvas.rooms = extraction.rooms.map((r, i) => ({
    id: generateId(),
    label: r.label,
    points: r.points,
    fillColor: ROOM_COLORS[i % ROOM_COLORS.length],
  }));

  // Convert dimensions — map wallIndex to wallId, skip invalid indices
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

  // Convert openings — map wallIndex to wallId, skip invalid indices
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/floor-plan-types.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/floor-plan-types.ts src/__tests__/floor-plan-types.test.ts
git commit -m "feat: add floor plan types and extraction-to-canvas converter with tests"
```

---

### Task 3: Create Claude Vision extraction logic

**Files:**
- Create: `src/lib/floor-plan-extract.ts`
- Create: `src/__tests__/floor-plan-extract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/floor-plan-extract.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/floor-plan-extract.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/floor-plan-extract.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { FloorPlanExtraction } from "./floor-plan-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_PROMPT = `You are analyzing a scanned floor plan image. Extract the floor plan structure as JSON.

Rules:
1. Identify all walls as line segments. Use a normalized coordinate grid from 0 to 1000 for both x and y axes, where (0,0) is the top-left corner of the drawing.
2. Identify rooms as closed polygons. Include any handwritten room labels you can read (e.g., "Kitchen", "BR1", "Bath").
3. Extract dimensions — numbers written near walls indicating measurements in feet or inches.
4. Identify doors (breaks in walls, often with arc indicators) and windows (breaks in walls, often with parallel lines or cross-hatching).
5. If you cannot confidently identify something, add a description to the "notes" array rather than guessing.

The image may be a hand-drawn sketch on graph paper (primary use case) or a printed architect floor plan. Prioritize accuracy over completeness — it's better to miss a wall than to hallucinate one.

Return ONLY valid JSON with this structure:
{
  "walls": [{"x1": 0, "y1": 0, "x2": 500, "y2": 0}],
  "rooms": [{"label": "Kitchen", "points": [{"x": 0, "y": 0}, {"x": 500, "y": 0}, {"x": 500, "y": 300}, {"x": 0, "y": 300}]}],
  "dimensions": [{"wallIndex": 0, "length": 15, "unit": "ft"}],
  "openings": [{"wallIndex": 0, "position": 0.5, "type": "door", "width": 3}],
  "notes": ["Any observations about unclear areas"]
}

wallIndex references the 0-based index in the walls array.
position is a 0-1 value indicating where along the wall the opening is (0 = start, 1 = end).
width is in the same unit as the dimensions.`;

export async function extractFloorPlan(imageUrl: string): Promise<FloorPlanExtraction> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: imageUrl },
          },
          {
            type: "text",
            text: "Extract the floor plan structure from this scanned image.",
          },
        ],
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return parseExtractionResponse(text);
}

export function parseExtractionResponse(text: string): FloorPlanExtraction {
  const empty: FloorPlanExtraction = {
    walls: [],
    rooms: [],
    dimensions: [],
    openings: [],
    notes: [],
  };

  // Try to extract JSON from the response — it may be wrapped in markdown code blocks
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...empty, notes: [`Failed to parse extraction response: no JSON found in response`] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      walls: Array.isArray(parsed.walls) ? parsed.walls : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions : [],
      openings: Array.isArray(parsed.openings) ? parsed.openings : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { ...empty, notes: [`Failed to parse extraction response: invalid JSON`] };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/floor-plan-extract.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/floor-plan-extract.ts src/__tests__/floor-plan-extract.test.ts
git commit -m "feat: add Claude Vision floor plan extraction logic with tests"
```

---

### Task 4: Create extraction API route

**Files:**
- Create: `src/app/api/floor-plans/extract/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/floor-plans/extract/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractFloorPlan } from "@/lib/floor-plan-extract";
import { extractionToCanvasData } from "@/lib/floor-plan-types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { imageUrl } = body;

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  try {
    const extraction = await extractFloorPlan(imageUrl);
    const canvasData = extractionToCanvasData(extraction);
    return NextResponse.json({ extraction, canvasData });
  } catch (err) {
    console.error("Floor plan extraction error:", err);
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/floor-plans/extract/route.ts
git commit -m "feat: add floor plan extraction API route"
```

---

### Task 5: Create floor plan save/update API route

**Files:**
- Create: `src/app/api/floor-plans/[id]/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/floor-plans/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, canvasData, thumbnailUrl } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (canvasData !== undefined) updateData.canvasData = canvasData;
  if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;

  try {
    const floorPlan = await prisma.floorPlan.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(floorPlan);
  } catch {
    return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });

  if (!floorPlan) {
    return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
  }

  return NextResponse.json(floorPlan);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/floor-plans/[id]/route.ts
git commit -m "feat: add floor plan save/update and get API routes"
```

---

### Task 6: Create PDF/PNG export utilities

**Files:**
- Create: `src/lib/floor-plan-export.ts`
- Create: `src/__tests__/floor-plan-export.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/floor-plan-export.test.ts`:

```typescript
import { buildTitleBlock } from "@/lib/floor-plan-export";

describe("buildTitleBlock", () => {
  it("returns title block lines with floor plan name", () => {
    const lines = buildTitleBlock("Main Floor", null, new Date("2026-04-11"));
    expect(lines).toContain("Main Floor");
    expect(lines).toContain("CPP Painting & Construction LLC");
    expect(lines).toContain("April 11, 2026");
  });

  it("includes project name when provided", () => {
    const lines = buildTitleBlock("Main Floor", "Kalter Residence", new Date("2026-04-11"));
    expect(lines).toContain("Kalter Residence");
  });

  it("omits project name when null", () => {
    const lines = buildTitleBlock("Main Floor", null, new Date("2026-04-11"));
    expect(lines).not.toContain(null);
    expect(lines).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/floor-plan-export.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/floor-plan-export.ts`:

```typescript
import jsPDF from "jspdf";

/**
 * Build title block text lines for PDF export header.
 */
export function buildTitleBlock(
  floorPlanName: string,
  projectName: string | null,
  date: Date
): string[] {
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const lines: string[] = [floorPlanName];
  if (projectName) lines.push(projectName);
  lines.push("CPP Painting & Construction LLC");
  lines.push(formatted);
  return lines;
}

/**
 * Export a canvas data URL to PDF with a title block header.
 * canvasDataUrl: PNG data URL from stage.toDataURL()
 * canvasWidth/canvasHeight: dimensions of the canvas in pixels
 */
export function exportToPdf(
  canvasDataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  floorPlanName: string,
  projectName: string | null
): jsPDF {
  // Landscape orientation for floor plans
  const pdf = new jsPDF({
    orientation: canvasWidth > canvasHeight ? "landscape" : "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const titleBlockHeight = 60;

  // Title block
  const lines = buildTitleBlock(floorPlanName, projectName, new Date());
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(lines[0], margin, margin + 14);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  for (let i = 1; i < lines.length; i++) {
    pdf.text(lines[i], margin, margin + 14 + i * 14);
  }

  // Horizontal rule below title block
  const ruleY = margin + titleBlockHeight;
  pdf.setDrawColor(180);
  pdf.setLineWidth(0.5);
  pdf.line(margin, ruleY, pageWidth - margin, ruleY);

  // Canvas image — scale to fit remaining space
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - ruleY - margin - 10;
  const scale = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight);
  const imgWidth = canvasWidth * scale;
  const imgHeight = canvasHeight * scale;
  const imgX = margin + (availableWidth - imgWidth) / 2;
  const imgY = ruleY + 10;

  pdf.addImage(canvasDataUrl, "PNG", imgX, imgY, imgWidth, imgHeight);

  return pdf;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/floor-plan-export.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/floor-plan-export.ts src/__tests__/floor-plan-export.test.ts
git commit -m "feat: add floor plan PDF/PNG export utilities with tests"
```

---

### Task 7: Create the listing page

**Files:**
- Create: `src/app/internal/floor-plans/page.tsx`

- [ ] **Step 1: Create the listing page**

Create `src/app/internal/floor-plans/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FloorPlansPage() {
  const floorPlans = await prisma.floorPlan.findMany({
    include: { project: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Floor Plans</h1>
          <p className="text-text-muted text-sm mt-1">
            Scan hand-drawn sketches and convert to clean digital floor plans.
          </p>
        </div>
        <Link
          href="/internal/floor-plans/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          New Floor Plan
        </Link>
      </div>

      {floorPlans.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No floor plans yet.</p>
          <Link href="/internal/floor-plans/new" className="text-accent text-sm hover:underline">
            Upload your first scan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {floorPlans.map((fp) => (
            <Link
              key={fp.id}
              href={`/internal/floor-plans/${fp.id}/edit`}
              className="border border-border rounded-sm overflow-hidden hover:border-accent/50 transition-colors group"
            >
              <div className="aspect-[4/3] bg-surface flex items-center justify-center">
                {fp.thumbnailUrl ? (
                  <img
                    src={fp.thumbnailUrl}
                    alt={fp.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-text-muted text-sm">No preview</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-text-primary font-medium text-sm group-hover:text-accent transition-colors">
                  {fp.name}
                </h3>
                {fp.project && (
                  <p className="text-text-muted text-xs mt-1">{fp.project.name}</p>
                )}
                <p className="text-text-muted text-xs mt-1">
                  {fp.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/internal/floor-plans/page.tsx
git commit -m "feat: add floor plans listing page"
```

---

### Task 8: Create the new floor plan upload flow

**Files:**
- Create: `src/app/internal/floor-plans/new/page.tsx`
- Create: `src/app/internal/floor-plans/new/NewFloorPlanForm.tsx`

- [ ] **Step 1: Create the server page**

Create `src/app/internal/floor-plans/new/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import NewFloorPlanForm from "./NewFloorPlanForm";

export const dynamic = "force-dynamic";

export default async function NewFloorPlanPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">New Floor Plan</h1>
      <NewFloorPlanForm projects={projects} />
    </div>
  );
}
```

- [ ] **Step 2: Create the client form component**

Create `src/app/internal/floor-plans/new/NewFloorPlanForm.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  projects: { id: string; name: string }[];
}

export default function NewFloorPlanForm({ projects }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (!file) { setError("Please upload a scanned floor plan image"); return; }

    try {
      // Step 1: Upload image to Vercel Blob
      setStatus("uploading");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "floor-plans");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url: imageUrl } = await uploadRes.json();

      // Step 2: Extract floor plan via Claude Vision
      setStatus("extracting");
      const extractRes = await fetch("/api/floor-plans/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!extractRes.ok) {
        const err = await extractRes.json();
        throw new Error(err.error || "Extraction failed");
      }
      const { canvasData } = await extractRes.json();

      // Step 3: Create floor plan record
      const createRes = await fetch("/api/floor-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectId: projectId || null,
          sourceImageUrl: imageUrl,
          canvasData,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create floor plan");
      const floorPlan = await createRes.json();

      // Step 4: Redirect to editor
      router.push(`/internal/floor-plans/${floorPlan.id}/edit`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const isProcessing = status === "uploading" || status === "extracting";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {/* Name */}
      <div>
        <label className="block text-text-primary text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Kalter Residence - Main Floor"
          className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Project (optional) */}
      <div>
        <label className="block text-text-primary text-sm font-medium mb-1">
          Link to Project <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-text-primary text-sm font-medium mb-1">Scanned Floor Plan</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-sm p-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-64 mx-auto" />
          ) : (
            <div>
              <p className="text-text-muted text-sm">Click to upload or drag and drop</p>
              <p className="text-text-muted text-xs mt-1">JPEG or PNG, max 10MB</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isProcessing}
        className="bg-accent text-bg font-semibold px-6 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "uploading" ? "Uploading..." : status === "extracting" ? "Extracting floor plan..." : "Extract & Create"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create the floor plan create API route**

We need a POST endpoint. Create `src/app/api/floor-plans/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, projectId, sourceImageUrl, canvasData } = body;

  if (!name || !canvasData) {
    return NextResponse.json({ error: "name and canvasData are required" }, { status: 400 });
  }

  const floorPlan = await prisma.floorPlan.create({
    data: {
      name,
      projectId: projectId || null,
      sourceImageUrl: sourceImageUrl || null,
      canvasData,
    },
  });

  return NextResponse.json(floorPlan);
}
```

- [ ] **Step 4: Update the upload route to accept floor plan images**

The existing `/api/upload/route.ts` only accepts `image/*` types and has a 10MB limit — this already works for floor plan scans. No changes needed.

- [ ] **Step 5: Commit**

```bash
git add src/app/internal/floor-plans/new/ src/app/api/floor-plans/route.ts
git commit -m "feat: add new floor plan upload and extraction flow"
```

---

### Task 9: Create the canvas editor

**Files:**
- Create: `src/app/internal/floor-plans/[id]/edit/page.tsx`
- Create: `src/app/internal/floor-plans/[id]/edit/FloorPlanEditor.tsx`
- Create: `src/app/internal/floor-plans/[id]/edit/Toolbar.tsx`
- Create: `src/app/internal/floor-plans/[id]/edit/SidePanel.tsx`

This is the largest task. The canvas editor renders floor plan data on a react-konva Stage with interactive editing.

- [ ] **Step 1: Create the Toolbar component**

Create `src/app/internal/floor-plans/[id]/edit/Toolbar.tsx`:

```tsx
"use client";

export type Tool = "select" | "editDimension" | "addLabel" | "delete";

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showBackground: boolean;
  onToggleBackground: () => void;
}

const TOOLS: { id: Tool; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "editDimension", label: "Edit Dimension", shortcut: "D" },
  { id: "addLabel", label: "Add Label", shortcut: "L" },
  { id: "delete", label: "Delete", shortcut: "⌫" },
];

export default function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showBackground,
  onToggleBackground,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
              activeTool === tool.id
                ? "bg-accent text-bg"
                : "text-text-muted hover:text-text-primary hover:bg-surface"
            }`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-2" />

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="px-2 py-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="px-2 py-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Shift+Z)"
      >
        Redo
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-2" />

      {/* Background toggle */}
      <button
        onClick={onToggleBackground}
        className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
          showBackground
            ? "bg-accent/20 text-accent border border-accent/30"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        {showBackground ? "Hide Scan" : "Show Scan"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the SidePanel component**

Create `src/app/internal/floor-plans/[id]/edit/SidePanel.tsx`:

```tsx
"use client";

interface Props {
  name: string;
  projectName: string | null;
  onSave: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  isSaving: boolean;
  extractionNotes: string[];
}

export default function SidePanel({
  name,
  projectName,
  onSave,
  onExportPng,
  onExportPdf,
  isSaving,
  extractionNotes,
}: Props) {
  return (
    <div className="w-64 border-l border-border bg-surface p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Floor plan info */}
      <div>
        <h2 className="text-text-primary font-semibold text-sm">{name}</h2>
        {projectName && (
          <p className="text-text-muted text-xs mt-1">{projectName}</p>
        )}
      </div>

      {/* Extraction notes */}
      {extractionNotes.length > 0 && (
        <div className="border border-orange-500/20 bg-orange-500/5 rounded-sm p-3">
          <p className="text-orange-400 text-xs font-medium mb-1">Extraction Notes</p>
          <ul className="text-text-muted text-xs space-y-1">
            {extractionNotes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="bg-accent text-bg font-semibold px-4 py-2 rounded-sm text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onExportPng}
          className="border border-border text-text-primary font-medium px-4 py-2 rounded-sm text-sm hover:bg-surface transition-colors"
        >
          Export PNG
        </button>
        <button
          onClick={onExportPdf}
          className="border border-border text-text-primary font-medium px-4 py-2 rounded-sm text-sm hover:bg-surface transition-colors"
        >
          Export PDF
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the main FloorPlanEditor component**

Create `src/app/internal/floor-plans/[id]/edit/FloorPlanEditor.tsx`:

```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Rect, Text, Circle, Image as KonvaImage, Group } from "react-konva";
import Toolbar, { type Tool } from "./Toolbar";
import SidePanel from "./SidePanel";
import { exportToPdf } from "@/lib/floor-plan-export";
import type { CanvasData, Wall, Room, Dimension, Opening } from "@/lib/floor-plan-types";

interface Props {
  floorPlanId: string;
  initialName: string;
  projectName: string | null;
  initialCanvasData: CanvasData;
  sourceImageUrl: string | null;
  extractionNotes: string[];
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

export default function FloorPlanEditor({
  floorPlanId,
  initialName,
  projectName,
  initialCanvasData,
  sourceImageUrl,
  extractionNotes,
}: Props) {
  const stageRef = useRef<any>(null);
  const [canvasData, setCanvasData] = useState<CanvasData>(initialCanvasData);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBackground, setShowBackground] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

  // Undo/redo history
  const [history, setHistory] = useState<CanvasData[]>([initialCanvasData]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Load background image
  useEffect(() => {
    if (!sourceImageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = sourceImageUrl;
    img.onload = () => setBackgroundImage(img);
  }, [sourceImageUrl]);

  // Push state to history
  const pushHistory = useCallback((newData: CanvasData) => {
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newData]);
    setHistoryIndex((prev) => prev + 1);
    setCanvasData(newData);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setCanvasData(history[newIndex]);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setCanvasData(history[newIndex]);
  }, [history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); return; }
      if (e.key === "v") setActiveTool("select");
      if (e.key === "d") setActiveTool("editDimension");
      if (e.key === "l") setActiveTool("addLabel");
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedId) handleDelete(selectedId);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, selectedId]);

  // Delete selected element
  function handleDelete(id: string) {
    const newData = {
      ...canvasData,
      walls: canvasData.walls.filter((w) => w.id !== id),
      rooms: canvasData.rooms.filter((r) => r.id !== id),
      dimensions: canvasData.dimensions.filter((d) => d.id !== id),
      openings: canvasData.openings.filter((o) => o.id !== id),
      labels: canvasData.labels.filter((l) => l.id !== id),
    };
    pushHistory(newData);
    setSelectedId(null);
  }

  // Wall drag handler
  function handleWallDragEnd(wallId: string, dx: number, dy: number) {
    const newData = {
      ...canvasData,
      walls: canvasData.walls.map((w) =>
        w.id === wallId ? { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy } : w
      ),
    };
    pushHistory(newData);
  }

  // Wall endpoint drag handler
  function handleWallEndpointDrag(wallId: string, endpoint: "start" | "end", x: number, y: number) {
    const grid = canvasData.gridSize;
    const snappedX = Math.round(x / grid) * grid;
    const snappedY = Math.round(y / grid) * grid;
    const newData = {
      ...canvasData,
      walls: canvasData.walls.map((w) => {
        if (w.id !== wallId) return w;
        return endpoint === "start"
          ? { ...w, x1: snappedX, y1: snappedY }
          : { ...w, x2: snappedX, y2: snappedY };
      }),
    };
    pushHistory(newData);
  }

  // Dimension edit handler
  function handleDimensionClick(dimId: string) {
    if (activeTool !== "editDimension") return;
    const dim = canvasData.dimensions.find((d) => d.id === dimId);
    if (!dim) return;
    const newValue = prompt(`Enter new measurement (${dim.unit}):`, String(dim.length));
    if (newValue === null) return;
    const parsed = parseFloat(newValue);
    if (isNaN(parsed) || parsed <= 0) return;
    const newData = {
      ...canvasData,
      dimensions: canvasData.dimensions.map((d) =>
        d.id === dimId ? { ...d, length: parsed } : d
      ),
    };
    pushHistory(newData);
  }

  // Label add handler
  function handleStageClick(e: any) {
    if (activeTool !== "addLabel") return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    const text = prompt("Enter label text:");
    if (!text) return;
    const newData = {
      ...canvasData,
      labels: [...canvasData.labels, {
        id: `label_${Date.now()}`,
        text,
        x: pos.x,
        y: pos.y,
        fontSize: 14,
      }],
    };
    pushHistory(newData);
  }

  // Save
  async function handleSave() {
    setIsSaving(true);
    try {
      // Generate thumbnail
      const stage = stageRef.current;
      const thumbnailUrl = stage?.toDataURL({ pixelRatio: 0.3 }) ?? null;

      await fetch(`/api/floor-plans/${floorPlanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasData, thumbnailUrl }),
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Export PNG
  function handleExportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const wasVisible = showBackground;
    if (wasVisible) setShowBackground(false);
    // Use setTimeout to let React re-render before capturing
    setTimeout(() => {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${initialName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      if (wasVisible) setShowBackground(true);
    }, 100);
  }

  // Export PDF
  function handleExportPdf() {
    const stage = stageRef.current;
    if (!stage) return;
    const wasVisible = showBackground;
    if (wasVisible) setShowBackground(false);
    setTimeout(() => {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const pdf = exportToPdf(dataUrl, CANVAS_WIDTH, CANVAS_HEIGHT, initialName, projectName);
      pdf.save(`${initialName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      if (wasVisible) setShowBackground(true);
    }, 100);
  }

  // Helper: get wall midpoint for dimension label placement
  function wallMidpoint(wall: Wall) {
    return { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        showBackground={showBackground}
        onToggleBackground={() => setShowBackground(!showBackground)}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-bg p-4 overflow-auto">
          <Stage
            ref={stageRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleStageClick}
            style={{ border: "1px solid var(--color-border)", background: "#1a1a1a" }}
          >
            {/* Grid layer */}
            <Layer>
              {Array.from({ length: Math.floor(CANVAS_WIDTH / canvasData.gridSize) + 1 }).map((_, i) => (
                <Line
                  key={`gv-${i}`}
                  points={[i * canvasData.gridSize, 0, i * canvasData.gridSize, CANVAS_HEIGHT]}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.floor(CANVAS_HEIGHT / canvasData.gridSize) + 1 }).map((_, i) => (
                <Line
                  key={`gh-${i}`}
                  points={[0, i * canvasData.gridSize, CANVAS_WIDTH, i * canvasData.gridSize]}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}
            </Layer>

            {/* Background image layer */}
            {showBackground && backgroundImage && (
              <Layer opacity={0.3}>
                <KonvaImage
                  image={backgroundImage}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                />
              </Layer>
            )}

            {/* Rooms layer */}
            <Layer>
              {canvasData.rooms.map((room) => (
                <Group key={room.id}>
                  <Line
                    points={room.points.flatMap((p) => [p.x, p.y])}
                    closed
                    fill={room.fillColor}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1}
                    onClick={() => activeTool === "select" && setSelectedId(room.id)}
                  />
                  {/* Room label centered */}
                  {room.label && (() => {
                    const cx = room.points.reduce((s, p) => s + p.x, 0) / room.points.length;
                    const cy = room.points.reduce((s, p) => s + p.y, 0) / room.points.length;
                    return (
                      <Text
                        x={cx - 30}
                        y={cy - 6}
                        text={room.label}
                        fontSize={12}
                        fill="rgba(255,255,255,0.6)"
                        align="center"
                        width={60}
                      />
                    );
                  })()}
                </Group>
              ))}
            </Layer>

            {/* Walls layer */}
            <Layer>
              {canvasData.walls.map((wall) => (
                <Group key={wall.id}>
                  <Line
                    points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                    stroke={selectedId === wall.id ? "#C17F3A" : "#F5F2ED"}
                    strokeWidth={wall.thickness}
                    hitStrokeWidth={20}
                    draggable={activeTool === "select"}
                    onClick={() => activeTool === "select" && setSelectedId(wall.id)}
                    onDragEnd={(e) => {
                      const node = e.target;
                      handleWallDragEnd(wall.id, node.x(), node.y());
                      node.position({ x: 0, y: 0 });
                    }}
                  />
                  {/* Endpoint handles when selected */}
                  {selectedId === wall.id && activeTool === "select" && (
                    <>
                      <Circle
                        x={wall.x1}
                        y={wall.y1}
                        radius={5}
                        fill="#C17F3A"
                        draggable
                        onDragEnd={(e) => handleWallEndpointDrag(wall.id, "start", e.target.x(), e.target.y())}
                      />
                      <Circle
                        x={wall.x2}
                        y={wall.y2}
                        radius={5}
                        fill="#C17F3A"
                        draggable
                        onDragEnd={(e) => handleWallEndpointDrag(wall.id, "end", e.target.x(), e.target.y())}
                      />
                    </>
                  )}
                </Group>
              ))}
            </Layer>

            {/* Openings layer */}
            <Layer>
              {canvasData.openings.map((opening) => {
                const wall = canvasData.walls.find((w) => w.id === opening.wallId);
                if (!wall) return null;
                const ox = wall.x1 + (wall.x2 - wall.x1) * opening.position;
                const oy = wall.y1 + (wall.y2 - wall.y1) * opening.position;
                return (
                  <Group key={opening.id}>
                    <Rect
                      x={ox - 8}
                      y={oy - 8}
                      width={16}
                      height={16}
                      fill={opening.type === "door" ? "rgba(192, 132, 72, 0.5)" : "rgba(100, 149, 237, 0.5)"}
                      stroke={selectedId === opening.id ? "#C17F3A" : "rgba(255,255,255,0.3)"}
                      strokeWidth={1}
                      onClick={() => activeTool === "select" && setSelectedId(opening.id)}
                    />
                    <Text
                      x={ox - 4}
                      y={oy - 4}
                      text={opening.type === "door" ? "D" : "W"}
                      fontSize={8}
                      fill="#F5F2ED"
                    />
                  </Group>
                );
              })}
            </Layer>

            {/* Dimensions layer */}
            <Layer>
              {canvasData.dimensions.map((dim) => {
                const wall = canvasData.walls.find((w) => w.id === dim.wallId);
                if (!wall) return null;
                const mid = wallMidpoint(wall);
                return (
                  <Text
                    key={dim.id}
                    x={mid.x + dim.offsetX - 20}
                    y={mid.y + dim.offsetY}
                    text={`${dim.length} ${dim.unit}`}
                    fontSize={11}
                    fill={selectedId === dim.id ? "#C17F3A" : "rgba(255,255,255,0.8)"}
                    padding={2}
                    onClick={() => {
                      if (activeTool === "select") setSelectedId(dim.id);
                      handleDimensionClick(dim.id);
                    }}
                    width={40}
                    align="center"
                  />
                );
              })}
            </Layer>

            {/* Labels layer */}
            <Layer>
              {canvasData.labels.map((label) => (
                <Text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  text={label.text}
                  fontSize={label.fontSize}
                  fill={selectedId === label.id ? "#C17F3A" : "#F5F2ED"}
                  draggable={activeTool === "select"}
                  onClick={() => activeTool === "select" && setSelectedId(label.id)}
                  onDragEnd={(e) => {
                    const newData = {
                      ...canvasData,
                      labels: canvasData.labels.map((l) =>
                        l.id === label.id ? { ...l, x: e.target.x(), y: e.target.y() } : l
                      ),
                    };
                    pushHistory(newData);
                  }}
                />
              ))}
            </Layer>
          </Stage>
        </div>

        <SidePanel
          name={initialName}
          projectName={projectName}
          onSave={handleSave}
          onExportPng={handleExportPng}
          onExportPdf={handleExportPdf}
          isSaving={isSaving}
          extractionNotes={extractionNotes}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the server page wrapper**

Create `src/app/internal/floor-plans/[id]/edit/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import FloorPlanEditor from "./FloorPlanEditor";
import type { CanvasData } from "@/lib/floor-plan-types";

export const dynamic = "force-dynamic";

export default async function FloorPlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });

  if (!floorPlan) notFound();

  // Extract notes from canvasData if present in the extraction
  const canvasData = floorPlan.canvasData as CanvasData;

  return (
    <div className="-mx-6 -mt-10">
      <FloorPlanEditor
        floorPlanId={floorPlan.id}
        initialName={floorPlan.name}
        projectName={floorPlan.project?.name ?? null}
        initialCanvasData={canvasData}
        sourceImageUrl={floorPlan.sourceImageUrl}
        extractionNotes={[]}
      />
    </div>
  );
}
```

Note: The negative margins (`-mx-6 -mt-10`) cancel the padding from the internal layout so the editor can use the full viewport.

- [ ] **Step 5: Commit**

```bash
git add src/app/internal/floor-plans/[id]/edit/
git commit -m "feat: add floor plan canvas editor with react-konva"
```

---

### Task 10: Add Floor Plans nav link

**Files:**
- Modify: `src/components/internal/InternalNav.tsx`

- [ ] **Step 1: Add the nav link**

In `src/components/internal/InternalNav.tsx`, add the "Floor Plans" link after "Details":

```tsx
        {navLink("/internal/details", "Details")}
        {navLink("/internal/floor-plans", "Floor Plans")}
        {navLink("/internal/subcontractors", "Subs")}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/internal/InternalNav.tsx
git commit -m "feat: add Floor Plans link to internal navigation"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx jest`

Expected: All new tests pass (floor-plan-types, floor-plan-extract, floor-plan-export). Pre-existing failures in quote-template.test.ts are unrelated.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: Build succeeds. New routes appear:
- `/internal/floor-plans`
- `/internal/floor-plans/new`
- `/internal/floor-plans/[id]/edit`

- [ ] **Step 3: End-to-end smoke test**

Run: `npm run dev`

Verify the full flow:
1. Navigate to `/internal/floor-plans` — empty state shows
2. Click "New Floor Plan" — upload form renders
3. Enter a name, optionally select a project
4. Upload a scanned floor plan image
5. Click "Extract & Create" — loading states show (Uploading... → Extracting floor plan...)
6. Redirected to editor — canvas shows extracted walls, rooms, dimensions
7. Background scan overlay visible at 30% opacity
8. Toggle "Show Scan" / "Hide Scan" — background toggles
9. Click a wall — shows endpoint handles, highlights in accent color
10. Drag a wall — wall moves, history updates
11. Drag an endpoint — snaps to grid
12. Switch to "Edit Dimension" tool, click a dimension — prompt appears to edit value
13. Switch to "Add Label" tool, click canvas — prompt for label text, label appears
14. Select an element, press Delete — element removed
15. Ctrl+Z undoes, Ctrl+Shift+Z redoes
16. Click "Save" — saves to DB
17. Click "Export PNG" — downloads PNG file
18. Click "Export PDF" — downloads PDF with title block
19. Navigate back to `/internal/floor-plans` — floor plan appears in grid with thumbnail
