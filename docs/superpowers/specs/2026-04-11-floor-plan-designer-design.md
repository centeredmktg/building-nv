# Floor Plan Designer — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Approach:** Claude Vision extraction → react-konva canvas editor → static export

## Problem

CPP's team sketches floor plans on graph paper and scans them with a document scanner. These scans are usable but unprofessional — they can't be attached to quotes/proposals or used in permit submittals without cleanup. The team needs a way to convert scanned sketches into clean, dimensioned digital floor plans that can be exported as PDF/PNG.

## Data Flow

```
Scanned image (JPEG/PNG from document scanner)
  → Upload to Vercel Blob (existing /api/upload pattern)
  → Send image to Claude Vision API (Haiku)
  → Claude returns structured JSON: walls, rooms, dimensions, openings
  → Render on react-konva canvas
  → User adjusts/corrects extraction errors
  → Save canvas state to DB
  → Export clean PDF/PNG
```

## Data Model

```prisma
model FloorPlan {
  id             String   @id @default(cuid())
  name           String                          // "Kalter Residence - Main Floor"
  projectId      String?
  project        Project? @relation(fields: [projectId], references: [id])
  sourceImageUrl String?                         // Vercel Blob URL of the uploaded scan
  canvasData     Json                            // Full canvas state: walls, rooms, dimensions, labels, openings
  thumbnailUrl   String?                         // Auto-generated PNG preview for listings
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### Design Decisions

- **`canvasData` as Json** — stores the full canvas state as a single JSON blob. This is a document, not relational data. No need to normalize walls/rooms into separate tables.
- **Optional `projectId`** — can link to a project for quotes/proposals, or standalone for quick sketches. Requires adding `floorPlans FloorPlan[]` to the `Project` model.
- **`sourceImageUrl`** — keeps the original scan so the user can toggle the background trace layer and re-extract if needed.
- **`thumbnailUrl`** — auto-generated on save so the listing page shows previews without loading the full canvas.

### Canvas Data Schema

The `canvasData` JSON field stores this structure:

```typescript
interface CanvasData {
  walls: Wall[];
  rooms: Room[];
  dimensions: Dimension[];
  openings: Opening[];
  labels: Label[];
  scale: number;          // pixels per foot — derived from canvas size
  gridSize: number;       // snap grid spacing in pixels
}

interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;      // pixels — default 6
}

interface Room {
  id: string;
  label: string;          // "Kitchen", "Bedroom 1", etc.
  points: { x: number; y: number }[];
  fillColor: string;      // semi-transparent fill
}

interface Dimension {
  id: string;
  wallId: string;
  length: number;
  unit: "ft" | "in";
  offsetX: number;        // label position offset from wall midpoint
  offsetY: number;
}

interface Opening {
  id: string;
  wallId: string;
  position: number;       // 0-1, position along the wall
  type: "door" | "window";
  width: number;          // in same unit as dimensions
}

interface Label {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
}
```

## Claude Vision Extraction

### API Route

`POST /api/floor-plans/extract` — accepts an image URL, sends to Claude Vision, returns structured extraction.

### Model

Claude Haiku with vision. The task is structured extraction — identifying geometric shapes and text from a scanned drawing. Does not require Sonnet-level reasoning. Cost: ~$0.01 per image.

### Prompt Strategy

The prompt instructs Claude to:
1. Identify all walls as line segments with start/end coordinates on a normalized 0-1000 grid
2. Detect rooms as closed polygons with labels (if handwritten labels are visible)
3. Extract any written dimensions (numbers near walls)
4. Note doors (breaks in walls with arc indicators) and windows (breaks in walls with parallel lines)
5. Flag anything it couldn't parse in a `notes` array

### Extraction Output

```typescript
interface FloorPlanExtraction {
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  rooms: { label: string; points: { x: number; y: number }[] }[];
  dimensions: { wallIndex: number; length: number; unit: "ft" | "in" }[];
  openings: { wallIndex: number; position: number; type: "door" | "window"; width: number }[];
  notes: string[];
}
```

Coordinates are normalized to a 0-1000 grid, then scaled to the canvas dimensions on the client.

### Input Types

- **Hand-drawn sketches (primary):** Scanned via document scanner. High contrast, consistent orientation. Expected extraction accuracy: 75-85%.
- **Architect PDFs (secondary):** Clean printed plans. Expected extraction accuracy: 85-95%.

In both cases, the user corrects extraction errors on the canvas. The tool is "AI-assisted," not "AI-autonomous."

## Canvas Editor (react-konva)

### Route

`/internal/floor-plans/[id]/edit`

### Architecture

Client component using `react-konva` (React bindings for Konva.js). The canvas renders extraction results as interactive objects across multiple layers.

### Layers (bottom to top)

1. **Grid layer** — snap-to-grid background
2. **Background layer** — original scanned image at 30% opacity, toggleable
3. **Rooms layer** — filled polygons with labels centered inside
4. **Walls layer** — thick line segments, selectable, draggable with endpoint handles
5. **Openings layer** — door arcs and window markers placed on walls
6. **Dimensions layer** — dimension lines with measurement text, editable on click
7. **Labels layer** — free-placed text labels

### Editing Tools (V1)

| Tool | Behavior |
|---|---|
| Select/Move | Click to select, drag to move walls, labels, openings |
| Adjust Endpoints | Drag wall endpoints to correct positions |
| Edit Dimension | Click a dimension to type a corrected value |
| Add Label | Click a room to add/edit its label |
| Delete | Select an element and delete it |
| Undo/Redo | Ctrl+Z / Ctrl+Shift+Z, history stack |

**Not in V1:** Manual wall drawing, room creation, door/window placement. The scan-to-digital flow is the entry point. If Claude misses elements, the user re-scans or we add manual tools in V2.

### Rationale for No Manual Drawing

The CPP team is more accurate with a pencil and graph paper than a mouse or trackpad. The tool's value is converting their hand-drawn work to digital, not replacing it.

## App Surface

### Routes

| Route | Component | Purpose |
|---|---|---|
| `/internal/floor-plans` | Server page | Listing — grid of saved floor plans with thumbnails |
| `/internal/floor-plans/new` | Client page | Upload + extract flow |
| `/internal/floor-plans/[id]/edit` | Client page | Canvas editor |

### Navigation

Add "Floor Plans" link to `InternalNav` between "Details" and "Subs".

### Listing Page (`/internal/floor-plans`)

- Grid of saved floor plans showing thumbnail, name, linked project (if any), last updated
- "New Floor Plan" button
- Empty state with prompt to create first floor plan

### New Floor Plan Flow (`/internal/floor-plans/new`)

1. Name the floor plan (text input)
2. Optionally link to a project (dropdown of existing projects)
3. Upload scanned image (drag-and-drop or file picker, accepts JPEG/PNG, max 10MB)
4. Hit "Extract" — loading state while Claude processes (~3-5 seconds)
5. Creates the FloorPlan record with extraction results as initial `canvasData`
6. Redirects to `/internal/floor-plans/[id]/edit`

### Editor Layout (`/internal/floor-plans/[id]/edit`)

- **Top toolbar:** Tool buttons (Select, Edit Dimension, Add Label, Delete), Undo/Redo, background toggle (show/hide scan overlay)
- **Main area:** react-konva canvas, takes most of the viewport
- **Right panel:** Floor plan name (editable), linked project, export buttons (PNG, PDF), save button

### Export

- **PNG:** `stage.toDataURL()` — renders the canvas as-is (without the background scan layer)
- **PDF:** jsPDF with the canvas rendered as an image, plus a title block header containing:
  - Floor plan name
  - Project name (if linked)
  - Date
  - "CPP Painting & Construction LLC" text

## Dependencies

### New npm packages

- `react-konva` + `konva` — canvas rendering and interaction
- `jspdf` — PDF export

### Existing infrastructure used

- `@anthropic-ai/sdk` — already installed, Claude Vision API
- `@vercel/blob` — already used for file uploads
- Prisma — schema addition
- Next.js App Router — new routes

## Future Considerations (Not In Scope)

- Manual wall/room/opening drawing tools
- Multi-floor support
- Furniture/fixture placement from catalog
- DXF/DWG export for architect handoff
- Area calculations and material quantity takeoffs
- Link floor plan rooms to quote line item sections
- Re-extraction (send image again with different prompt tuning)
- Collaborative editing
