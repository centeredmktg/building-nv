# Architectural Detail Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A searchable reference catalog of architectural construction details, seeded with ~70 entries from top manufacturers/libraries, accessible at `/internal/details`.

**Architecture:** Single Prisma model `DetailLibraryItem`, a TypeScript seed script to populate it, and a server-rendered Next.js page with client-side filtering. Follows existing patterns: seed script mirrors `prisma/seed-capabilities.ts`, page mirrors `src/app/internal/components/page.tsx`.

**Tech Stack:** Prisma 7, Next.js (App Router), TypeScript, Jest

---

### File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add `DetailLibraryItem` model |
| Create | `src/lib/detail-library.ts` | Detail type and CSI division constants, type exports |
| Create | `prisma/seed-detail-library.ts` | Seed script — upserts ~70 detail entries |
| Create | `src/app/internal/details/page.tsx` | Server component — fetches all details, renders page |
| Create | `src/app/internal/details/DetailFilters.tsx` | Client component — trade/search/type filter bar |
| Modify | `src/components/internal/InternalNav.tsx` | Add "Details" nav link |
| Create | `src/__tests__/detail-library.test.ts` | Unit tests for constants and helpers |

---

### Task 1: Add DetailLibraryItem model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (append after `ComplianceChatMessage` model)

- [ ] **Step 1: Add the model to schema.prisma**

Append to the end of `prisma/schema.prisma`:

```prisma
// ─── Architectural Detail Library ────────────────────────────────────────────

model DetailLibraryItem {
  id           String   @id @default(cuid())
  name         String
  description  String?
  manufacturer String
  trade        String
  csiDivision  String?
  csiTitle     String?
  detailType   String
  format       String
  sourceUrl    String   @unique
  tags         String[]
  isFree       Boolean  @default(true)
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Note: `sourceUrl` has a `@unique` constraint — the seed script upserts on this field to prevent duplicates.

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add-detail-library`

Expected: Migration created and applied. Prisma Client regenerated.

- [ ] **Step 3: Stage generated files and commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat(schema): add DetailLibraryItem model for architectural detail catalog"
```

---

### Task 2: Create detail library constants

**Files:**
- Create: `src/lib/detail-library.ts`
- Create: `src/__tests__/detail-library.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/detail-library.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/detail-library.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/detail-library.ts`:

```typescript
export const DETAIL_TYPES = [
  { id: "installation", label: "Installation" },
  { id: "assembly", label: "Assembly" },
  { id: "connection", label: "Connection" },
  { id: "flashing", label: "Flashing" },
  { id: "waterproofing", label: "Waterproofing" },
  { id: "structural", label: "Structural" },
  { id: "general", label: "General" },
] as const;

export type DetailTypeId = (typeof DETAIL_TYPES)[number]["id"];

export function getDetailTypeLabel(id: DetailTypeId): string {
  return DETAIL_TYPES.find((t) => t.id === id)?.label ?? id;
}

export const CSI_DIVISIONS = [
  { code: "03", title: "Concrete" },
  { code: "04", title: "Masonry" },
  { code: "05", title: "Metals" },
  { code: "06", title: "Wood, Plastics, and Composites" },
  { code: "07", title: "Thermal and Moisture Protection" },
  { code: "08", title: "Openings" },
  { code: "09", title: "Finishes" },
  { code: "22", title: "Plumbing" },
  { code: "23", title: "HVAC" },
  { code: "26", title: "Electrical" },
  { code: "31", title: "Earthwork" },
] as const;

export type CsiDivisionCode = (typeof CSI_DIVISIONS)[number]["code"];

export function getCsiTitle(code: string): string | null {
  return CSI_DIVISIONS.find((d) => d.code === code)?.title ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/detail-library.test.ts`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/detail-library.ts src/__tests__/detail-library.test.ts
git commit -m "feat: add detail library constants and helpers with tests"
```

---

### Task 3: Create the seed script

**Files:**
- Create: `prisma/seed-detail-library.ts`

- [ ] **Step 1: Create the seed script**

Create `prisma/seed-detail-library.ts`. This follows the exact pattern of `prisma/seed-capabilities.ts`:

```typescript
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const details = [
  // ── Simpson Strong-Tie ─────────────────────────────────────────────────────
  {
    name: "Joist Hanger Selection Guide",
    description: "Selection and installation details for LUS, HUS, and HU series joist hangers",
    manufacturer: "Simpson Strong-Tie",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "connection",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/wood-construction-connectors-702702",
    tags: ["structural", "connection", "residential", "commercial", "joist-hanger"],
    isFree: true,
    notes: null,
  },
  {
    name: "Holdown and Anchor Bolt Details",
    description: "HDU/HDQ holdown installation and anchor bolt embedment details",
    manufacturer: "Simpson Strong-Tie",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "structural",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/holdowns-706706",
    tags: ["structural", "holdown", "anchor", "residential", "seismic"],
    isFree: true,
    notes: null,
  },
  {
    name: "Post Base and Cap Connection Details",
    description: "ABU/ABA post base and AC/BC post cap installation details",
    manufacturer: "Simpson Strong-Tie",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "connection",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/post-frame-hardware-711711",
    tags: ["structural", "connection", "post-base", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Hurricane Tie and Strap Details",
    description: "H-series hurricane ties and MSTA/LSTA strap installation for roof-to-wall connections",
    manufacturer: "Simpson Strong-Tie",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "connection",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/hurricane-ties-710710",
    tags: ["structural", "hurricane-tie", "roof-to-wall", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Deck Connector and Fastener Guide",
    description: "DTT and DJT deck tension ties, ledger connections, and post-to-beam connectors",
    manufacturer: "Simpson Strong-Tie",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "connection",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/deck-connectors-721721",
    tags: ["structural", "deck", "connection", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Concrete Anchor Systems",
    description: "Titen HD, Wedge-All, and SET-3G adhesive anchor installation details",
    manufacturer: "Simpson Strong-Tie",
    trade: "concrete",
    csiDivision: "03",
    csiTitle: "Concrete",
    detailType: "structural",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/anchoring-systems-707707",
    tags: ["structural", "anchor", "concrete", "commercial"],
    isFree: true,
    notes: null,
  },
  {
    name: "Masonry Connector Details",
    description: "Masonry veneer ties, embedded straps, and brick-to-stud connection details",
    manufacturer: "Simpson Strong-Tie",
    trade: "masonry",
    csiDivision: "04",
    csiTitle: "Masonry",
    detailType: "connection",
    format: "PDF",
    sourceUrl: "https://www.strongtie.com/resources/literature/masonry-connectors-703703",
    tags: ["structural", "masonry", "veneer-tie", "commercial"],
    isFree: true,
    notes: null,
  },
  // ── GAF Roofing ────────────────────────────────────────────────────────────
  {
    name: "Eave and Drip Edge Flashing Detail",
    description: "Starter strip, drip edge, and ice/water shield installation at eaves",
    manufacturer: "GAF",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.gaf.com/en-us/for-professionals/resources/detail-drawings",
    tags: ["roofing", "flashing", "eave", "drip-edge", "residential"],
    isFree: true,
    notes: "Navigate to eave details section",
  },
  {
    name: "Valley Flashing Detail",
    description: "Open and closed valley flashing methods with underlayment specifications",
    manufacturer: "GAF",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.gaf.com/en-us/for-professionals/resources/detail-drawings#valley",
    tags: ["roofing", "flashing", "valley", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Ridge Vent Installation Detail",
    description: "Cobra ridge vent installation with shingle cap details",
    manufacturer: "GAF",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.gaf.com/en-us/for-professionals/resources/detail-drawings#ridge",
    tags: ["roofing", "ventilation", "ridge-vent", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Roof Penetration Flashing Detail",
    description: "Pipe boot, vent stack, and mechanical penetration flashing details",
    manufacturer: "GAF",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.gaf.com/en-us/for-professionals/resources/detail-drawings#penetrations",
    tags: ["roofing", "flashing", "penetration", "pipe-boot", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Wall-to-Roof Termination Detail",
    description: "Step flashing and counter-flashing at wall-to-roof transitions",
    manufacturer: "GAF",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.gaf.com/en-us/for-professionals/resources/detail-drawings#wall",
    tags: ["roofing", "flashing", "step-flashing", "wall-transition", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Starter Strip Application Detail",
    description: "Pro-Start or shingle starter strip application at eaves and rakes",
    manufacturer: "GAF",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.gaf.com/en-us/for-professionals/resources/detail-drawings#starter",
    tags: ["roofing", "starter-strip", "residential"],
    isFree: true,
    notes: null,
  },
  // ── ZIP System / Huber ─────────────────────────────────────────────────────
  {
    name: "ZIP System Wall Sheathing Assembly",
    description: "ZIP sheathing panel installation with taped seam details for air/water barrier",
    manufacturer: "Huber Engineered Woods",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://www.huberwood.com/zip-system/resources/installation-details#wall",
    tags: ["sheathing", "air-barrier", "water-barrier", "residential", "wall"],
    isFree: true,
    notes: null,
  },
  {
    name: "ZIP System Roof Sheathing Assembly",
    description: "ZIP roof sheathing with taped seams as roof underlayment",
    manufacturer: "Huber Engineered Woods",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://www.huberwood.com/zip-system/resources/installation-details#roof",
    tags: ["sheathing", "roof", "underlayment", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "ZIP System Stretch Tape Window Flashing",
    description: "Window rough opening flashing with ZIP System stretch tape",
    manufacturer: "Huber Engineered Woods",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.huberwood.com/zip-system/resources/installation-details#window",
    tags: ["flashing", "window", "rough-opening", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "ZIP System Liquid Flash Detail",
    description: "Liquid-applied flashing for penetrations, seams, and transitions",
    manufacturer: "Huber Engineered Woods",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.huberwood.com/zip-system/resources/installation-details#liquid-flash",
    tags: ["flashing", "liquid-flash", "penetration", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "ZIP R-Sheathing Insulated Panel Assembly",
    description: "ZIP R-sheathing continuous insulation wall assembly detail",
    manufacturer: "Huber Engineered Woods",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://www.huberwood.com/zip-system/resources/installation-details#zip-r",
    tags: ["insulation", "continuous-insulation", "wall", "residential", "energy-code"],
    isFree: true,
    notes: null,
  },
  // ── James Hardie ───────────────────────────────────────────────────────────
  {
    name: "HardiePlank Lap Siding Installation",
    description: "HardiePlank lap siding fastening, gapping, and joint details",
    manufacturer: "James Hardie",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.jameshardie.com/technical-information/installation-guides",
    tags: ["siding", "fiber-cement", "lap-siding", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "HardieTrim and Fascia Details",
    description: "Trim board, corner, and fascia installation with flashing integration",
    manufacturer: "James Hardie",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.jameshardie.com/technical-information/installation-guides#trim",
    tags: ["siding", "trim", "fascia", "fiber-cement", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Hardie Siding Window and Door Flashing",
    description: "Flashing integration at window and door openings with fiber cement siding",
    manufacturer: "James Hardie",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.jameshardie.com/technical-information/installation-guides#flashing",
    tags: ["siding", "flashing", "window", "door", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "HardiePanel Vertical Siding Installation",
    description: "Vertical panel siding installation with batten and joint details",
    manufacturer: "James Hardie",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.jameshardie.com/technical-information/installation-guides#panel",
    tags: ["siding", "fiber-cement", "vertical", "panel", "residential"],
    isFree: true,
    notes: null,
  },
  // ── ARCAT (General Library) ────────────────────────────────────────────────
  {
    name: "Foundation Waterproofing Details",
    description: "Below-grade waterproofing membrane, drainage board, and footing drain details",
    manufacturer: "ARCAT",
    trade: "concrete",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "waterproofing",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33702.html",
    tags: ["waterproofing", "foundation", "below-grade", "residential", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Exterior Wall Assembly Sections",
    description: "Typical wood-frame and steel-stud wall assembly cross-sections",
    manufacturer: "ARCAT",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33061.html",
    tags: ["wall", "assembly", "cross-section", "residential", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Concrete Slab-on-Grade Details",
    description: "Slab edge, vapor barrier, reinforcement, and control joint details",
    manufacturer: "ARCAT",
    trade: "concrete",
    csiDivision: "03",
    csiTitle: "Concrete",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33031.html",
    tags: ["concrete", "slab", "foundation", "vapor-barrier", "residential"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Interior Partition Wall Details",
    description: "Steel stud and wood stud interior partition framing and finish details",
    manufacturer: "ARCAT",
    trade: "drywall",
    csiDivision: "09",
    csiTitle: "Finishes",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33092.html",
    tags: ["partition", "drywall", "framing", "interior", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Suspended Ceiling Grid Details",
    description: "ACT ceiling grid, hanger wire, and perimeter trim details",
    manufacturer: "ARCAT",
    trade: "drywall",
    csiDivision: "09",
    csiTitle: "Finishes",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33095.html",
    tags: ["ceiling", "ACT", "suspended", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Door Frame and Hardware Details",
    description: "Hollow metal and wood door frame installation and hardware prep details",
    manufacturer: "ARCAT",
    trade: "carpentry",
    csiDivision: "08",
    csiTitle: "Openings",
    detailType: "installation",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33081.html",
    tags: ["door", "frame", "hardware", "commercial", "residential"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Storefront Glazing System Details",
    description: "Aluminum storefront framing, sill, head, and jamb section details",
    manufacturer: "ARCAT",
    trade: "glazing",
    csiDivision: "08",
    csiTitle: "Openings",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33084.html",
    tags: ["glazing", "storefront", "aluminum", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Tile Floor and Wall Installation Details",
    description: "Thin-set, mortar bed, waterproofing, and transition details for ceramic/porcelain tile",
    manufacturer: "ARCAT",
    trade: "flooring",
    csiDivision: "09",
    csiTitle: "Finishes",
    detailType: "installation",
    format: "DWG",
    sourceUrl: "https://www.arcat.com/arcatcos/cos33/arc33093.html",
    tags: ["tile", "flooring", "waterproofing", "residential", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  // ── CADdetails.com ─────────────────────────────────────────────────────────
  {
    name: "Metal Roof Panel Details",
    description: "Standing seam and exposed fastener metal roof panel installation details",
    manufacturer: "CADdetails",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "DWG",
    sourceUrl: "https://www.caddetails.com/categories/metal-roofing",
    tags: ["roofing", "metal", "standing-seam", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "EIFS/Stucco Wall System Details",
    description: "Exterior insulation and finish system (EIFS) and traditional stucco assembly details",
    manufacturer: "CADdetails",
    trade: "painting",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.caddetails.com/categories/eifs",
    tags: ["EIFS", "stucco", "exterior", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Waterproofing Membrane Details",
    description: "Above and below-grade waterproofing membrane application details",
    manufacturer: "CADdetails",
    trade: "concrete",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "waterproofing",
    format: "DWG",
    sourceUrl: "https://www.caddetails.com/categories/waterproofing",
    tags: ["waterproofing", "membrane", "below-grade", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Fire-Rated Penetration Seal Details",
    description: "Firestop sealant and device details for MEP penetrations through fire-rated assemblies",
    manufacturer: "CADdetails",
    trade: "fire_protection",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "DWG",
    sourceUrl: "https://www.caddetails.com/categories/firestopping",
    tags: ["firestop", "fire-rated", "penetration", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Expansion Joint and Sealant Details",
    description: "Building expansion joint covers, sealant profiles, and backer rod details",
    manufacturer: "CADdetails",
    trade: "general_labor",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "DWG",
    sourceUrl: "https://www.caddetails.com/categories/expansion-joints",
    tags: ["expansion-joint", "sealant", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  {
    name: "Insulated Metal Panel Wall Details",
    description: "Insulated metal panel wall system installation with base, head, and jamb details",
    manufacturer: "CADdetails",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "DWG",
    sourceUrl: "https://www.caddetails.com/categories/insulated-metal-panels",
    tags: ["insulated-panel", "metal", "wall", "commercial"],
    isFree: true,
    notes: "Free registration required",
  },
  // ── Building America Solution Center ───────────────────────────────────────
  {
    name: "Climate Zone 3B Wall Assembly (Dry)",
    description: "Recommended wall assembly for hot-dry climate (Nevada) with continuous insulation options",
    manufacturer: "Building America Solution Center",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://basc.pnnl.gov/resource-guides/wall-insulation",
    tags: ["wall", "insulation", "climate-zone-3B", "energy-code", "residential", "nevada"],
    isFree: true,
    notes: "US DOE resource — select climate zone 3B for Nevada",
  },
  {
    name: "Attic Insulation and Air Sealing Guide",
    description: "Attic air sealing details and insulation installation for energy code compliance",
    manufacturer: "Building America Solution Center",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://basc.pnnl.gov/resource-guides/attic-insulation",
    tags: ["insulation", "attic", "air-sealing", "energy-code", "residential"],
    isFree: true,
    notes: "US DOE resource",
  },
  {
    name: "Foundation Insulation Details",
    description: "Slab edge, crawlspace, and basement insulation details by climate zone",
    manufacturer: "Building America Solution Center",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://basc.pnnl.gov/resource-guides/foundation-insulation",
    tags: ["insulation", "foundation", "slab-edge", "crawlspace", "energy-code", "residential"],
    isFree: true,
    notes: "US DOE resource",
  },
  {
    name: "Window and Door Installation Best Practices",
    description: "Flashing, air sealing, and installation sequence for windows and exterior doors",
    manufacturer: "Building America Solution Center",
    trade: "carpentry",
    csiDivision: "08",
    csiTitle: "Openings",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://basc.pnnl.gov/resource-guides/window-installation",
    tags: ["window", "door", "flashing", "air-sealing", "residential"],
    isFree: true,
    notes: "US DOE resource",
  },
  {
    name: "Duct Sealing and Insulation Details",
    description: "HVAC duct sealing, insulation, and routing details for energy efficiency",
    manufacturer: "Building America Solution Center",
    trade: "hvac",
    csiDivision: "23",
    csiTitle: "HVAC",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://basc.pnnl.gov/resource-guides/ducts",
    tags: ["hvac", "duct", "sealing", "insulation", "energy-code", "residential"],
    isFree: true,
    notes: "US DOE resource",
  },
  // ── Owens Corning ──────────────────────────────────────────────────────────
  {
    name: "Duration Shingle Installation Guide",
    description: "Owens Corning Duration series shingle installation, nailing pattern, and exposure details",
    manufacturer: "Owens Corning",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.owenscorning.com/en-us/roofing/shingles/duration",
    tags: ["roofing", "shingle", "installation", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Batt Insulation Installation Details",
    description: "Fiberglass batt insulation installation in walls, floors, and ceilings",
    manufacturer: "Owens Corning",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.owenscorning.com/en-us/insulation/residential",
    tags: ["insulation", "batt", "fiberglass", "wall", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Blown-In Insulation Application Details",
    description: "AttiCat and ProCat blown-in fiberglass insulation coverage and depth specifications",
    manufacturer: "Owens Corning",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.owenscorning.com/en-us/insulation/residential/blown-in",
    tags: ["insulation", "blown-in", "attic", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "Rigid Foam Board Insulation Details",
    description: "FOAMULAR XPS rigid board insulation for below-grade and continuous insulation applications",
    manufacturer: "Owens Corning",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.owenscorning.com/en-us/insulation/commercial/rigid-foam",
    tags: ["insulation", "rigid-foam", "XPS", "continuous-insulation", "below-grade"],
    isFree: true,
    notes: null,
  },
  // ── LP Building Solutions ──────────────────────────────────────────────────
  {
    name: "LP SmartSide Lap Siding Installation",
    description: "LP SmartSide engineered wood lap siding fastening, flashing, and clearance details",
    manufacturer: "LP Building Solutions",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://lpcorp.com/resources/installation-guides/smartside-lap-siding",
    tags: ["siding", "engineered-wood", "lap-siding", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "LP SmartSide Trim Installation",
    description: "LP SmartSide trim and fascia installation with flashing integration",
    manufacturer: "LP Building Solutions",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://lpcorp.com/resources/installation-guides/smartside-trim",
    tags: ["siding", "trim", "fascia", "engineered-wood", "residential"],
    isFree: true,
    notes: null,
  },
  {
    name: "LP TechShield Radiant Barrier Sheathing",
    description: "Radiant barrier roof sheathing installation for attic heat reduction",
    manufacturer: "LP Building Solutions",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://lpcorp.com/resources/installation-guides/techshield",
    tags: ["sheathing", "radiant-barrier", "roof", "energy-code", "residential"],
    isFree: true,
    notes: "Relevant for Nevada's hot climate",
  },
  // ── Government / Code Body Resources ───────────────────────────────────────
  {
    name: "WBDG Wall Section Details",
    description: "Standard wall section details for various construction types from the Whole Building Design Guide",
    manufacturer: "WBDG / NIBS",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://www.wbdg.org/guides-specifications/building-envelope-design-guide/wall-systems",
    tags: ["wall", "assembly", "government", "commercial", "residential"],
    isFree: true,
    notes: "US government resource — National Institute of Building Sciences",
  },
  {
    name: "WBDG Roofing Systems Guide",
    description: "Low-slope and steep-slope roofing system details and best practices",
    manufacturer: "WBDG / NIBS",
    trade: "roofing",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://www.wbdg.org/guides-specifications/building-envelope-design-guide/roofing-systems",
    tags: ["roofing", "low-slope", "steep-slope", "government", "commercial"],
    isFree: true,
    notes: "US government resource — National Institute of Building Sciences",
  },
  {
    name: "WBDG Below-Grade Waterproofing Guide",
    description: "Foundation and below-grade waterproofing systems and details",
    manufacturer: "WBDG / NIBS",
    trade: "concrete",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "waterproofing",
    format: "PDF",
    sourceUrl: "https://www.wbdg.org/guides-specifications/building-envelope-design-guide/below-grade-waterproofing",
    tags: ["waterproofing", "foundation", "below-grade", "government", "commercial"],
    isFree: true,
    notes: "US government resource — National Institute of Building Sciences",
  },
  {
    name: "FEMA Coastal Construction Wind-Resistant Details",
    description: "Wind-resistant construction details for high-wind zones from FEMA P-499",
    manufacturer: "FEMA",
    trade: "carpentry",
    csiDivision: "06",
    csiTitle: "Wood, Plastics, and Composites",
    detailType: "structural",
    format: "PDF",
    sourceUrl: "https://www.fema.gov/emergency-managers/risk-management/building-science/publications",
    tags: ["structural", "wind-resistant", "high-wind", "government", "residential"],
    isFree: true,
    notes: "Search for FEMA P-499",
  },
  {
    name: "ENERGY STAR Air Sealing Guide",
    description: "Thermal bypass checklist and air sealing detail illustrations for energy-efficient construction",
    manufacturer: "ENERGY STAR / EPA",
    trade: "insulation",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "assembly",
    format: "PDF",
    sourceUrl: "https://www.energystar.gov/partner_resources/residential_new/homes_prog_reqs/thermal_bypass",
    tags: ["air-sealing", "thermal-bypass", "energy-code", "residential", "government"],
    isFree: true,
    notes: "EPA/ENERGY STAR resource",
  },
  // ── CertainTeed / Saint-Gobain ─────────────────────────────────────────────
  {
    name: "CertainTeed Gypsum Board Installation",
    description: "Gypsum board installation, fastening, finishing, and fire-rated assembly details",
    manufacturer: "CertainTeed",
    trade: "drywall",
    csiDivision: "09",
    csiTitle: "Finishes",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.certainteed.com/resources/gypsum-installation",
    tags: ["drywall", "gypsum", "fire-rated", "residential", "commercial"],
    isFree: true,
    notes: null,
  },
  {
    name: "CertainTeed Vinyl Siding Installation",
    description: "Vinyl siding installation details including starter strip, J-channel, and corner post",
    manufacturer: "CertainTeed",
    trade: "carpentry",
    csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection",
    detailType: "installation",
    format: "PDF",
    sourceUrl: "https://www.certainteed.com/resources/siding-installation",
    tags: ["siding", "vinyl", "residential"],
    isFree: true,
    notes: null,
  },
  // ── Pella Windows ──────────────────────────────────────────────────────────
  {
    name: "Pella Window Installation Details",
    description: "New construction and replacement window rough opening prep, shimming, and flashing details",
    manufacturer: "Pella",
    trade: "carpentry",
    csiDivision: "08",
    csiTitle: "Openings",
    detailType: "installation",
    format: "DWG",
    sourceUrl: "https://www.pella.com/professionals/resources/installation-details/",
    tags: ["window", "installation", "flashing", "rough-opening", "residential"],
    isFree: true,
    notes: null,
  },
  // ── Andersen Windows ───────────────────────────────────────────────────────
  {
    name: "Andersen Window Flashing Details",
    description: "Pan flashing, head flashing, and sill flashing details for Andersen window products",
    manufacturer: "Andersen",
    trade: "carpentry",
    csiDivision: "08",
    csiTitle: "Openings",
    detailType: "flashing",
    format: "PDF",
    sourceUrl: "https://www.andersenwindows.com/for-professionals/detail-drawings/",
    tags: ["window", "flashing", "pan-flashing", "residential"],
    isFree: true,
    notes: null,
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const detail of details) {
    const result = await prisma.detailLibraryItem.upsert({
      where: { sourceUrl: detail.sourceUrl },
      update: {
        name: detail.name,
        description: detail.description,
        manufacturer: detail.manufacturer,
        trade: detail.trade,
        csiDivision: detail.csiDivision,
        csiTitle: detail.csiTitle,
        detailType: detail.detailType,
        format: detail.format,
        tags: detail.tags,
        isFree: detail.isFree,
        notes: detail.notes,
      },
      create: detail,
    });

    // Check if this was a create or update by comparing timestamps
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`Detail library seeded: ${created} created, ${updated} updated (${details.length} total)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add the seed script to package.json**

Add to the `scripts` section in `package.json`:

```json
"seed:details": "tsx prisma/seed-detail-library.ts"
```

- [ ] **Step 3: Run the seed script against dev DB**

Run: `npm run seed:details`

Expected: `Detail library seeded: 55 created, 0 updated (55 total)`

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-detail-library.ts package.json
git commit -m "feat: add detail library seed script with 55 architectural details"
```

---

### Task 4: Create the Details page with client-side filtering

**Files:**
- Create: `src/app/internal/details/DetailFilters.tsx`
- Create: `src/app/internal/details/page.tsx`

- [ ] **Step 1: Create the filter bar component**

Create `src/app/internal/details/DetailFilters.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { TRADES } from "@/lib/trades";
import { DETAIL_TYPES, CSI_DIVISIONS } from "@/lib/detail-library";

interface DetailItem {
  id: string;
  name: string;
  description: string | null;
  manufacturer: string;
  trade: string;
  csiDivision: string | null;
  csiTitle: string | null;
  detailType: string;
  format: string;
  sourceUrl: string;
  tags: string[];
  isFree: boolean;
  notes: string | null;
}

export default function DetailFilters({ items }: { items: DetailItem[] }) {
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("");
  const [detailType, setDetailType] = useState("");
  const [csiDivision, setCsiDivision] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (trade && item.trade !== trade) return false;
      if (detailType && item.detailType !== detailType) return false;
      if (csiDivision && item.csiDivision !== csiDivision) return false;
      if (search) {
        const q = search.toLowerCase();
        const searchable = [
          item.name,
          item.manufacturer,
          item.description ?? "",
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, trade, detailType, csiDivision]);

  const activeFilterCount = [trade, detailType, csiDivision, search].filter(Boolean).length;

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-muted w-64 focus:outline-none focus:border-accent"
        />
        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Trades</option>
          {TRADES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={detailType}
          onChange={(e) => setDetailType(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Types</option>
          {DETAIL_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={csiDivision}
          onChange={(e) => setCsiDivision(e.target.value)}
          className="bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All CSI Divisions</option>
          {CSI_DIVISIONS.map((d) => (
            <option key={d.code} value={d.code}>
              Div {d.code} — {d.title}
            </option>
          ))}
        </select>
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setSearch("");
              setTrade("");
              setDetailType("");
              setCsiDivision("");
            }}
            className="text-text-muted hover:text-text-primary text-sm transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results Count */}
      <p className="text-text-muted text-sm mb-4">
        {filtered.length} detail{filtered.length !== 1 ? "s" : ""}
        {activeFilterCount > 0 ? " matching filters" : ""}
      </p>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted">No details match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-sm p-5 hover:border-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-text-primary font-medium text-sm group-hover:text-accent transition-colors">
                  {item.name}
                </h3>
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-surface border border-border text-text-muted shrink-0">
                  {item.format}
                </span>
              </div>
              <p className="text-text-muted text-xs mb-3">
                {item.manufacturer}
                {item.csiDivision ? ` · Div ${item.csiDivision}` : ""}
              </p>
              {item.description && (
                <p className="text-text-muted text-xs mb-3 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-accent/10 text-accent border border-accent/20">
                  {item.detailType}
                </span>
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded-sm bg-surface border border-border text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-xs text-text-muted">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="text-text-muted text-xs mt-2 italic">{item.notes}</p>
              )}
              {!item.isFree && (
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-400 border border-orange-500/20 mt-2 inline-block">
                  Paid
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the server page component**

Create `src/app/internal/details/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import DetailFilters from "./DetailFilters";

export const dynamic = "force-dynamic";

export default async function DetailsPage() {
  const items = await prisma.detailLibraryItem.findMany({
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Detail Library</h1>
        <p className="text-text-muted text-sm mt-1">
          Architectural construction details from manufacturers and industry resources.
        </p>
      </div>
      <DetailFilters items={items} />
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders**

Run: `npm run dev`

Navigate to `http://localhost:3000/internal/details` and verify:
- Page loads with all seeded details
- Filter bar renders with trade, type, and CSI division dropdowns
- Search filters results in real time
- Clicking a card opens the source URL in a new tab

- [ ] **Step 4: Commit**

```bash
git add src/app/internal/details/
git commit -m "feat: add detail library page with search and filtering"
```

---

### Task 5: Add Details link to InternalNav

**Files:**
- Modify: `src/components/internal/InternalNav.tsx:34`

- [ ] **Step 1: Add the nav link**

In `src/components/internal/InternalNav.tsx`, add the "Details" link after the "Catalog" link (line 34):

```tsx
        {navLink("/internal/components", "Catalog")}
        {navLink("/internal/details", "Details")}
        {navLink("/internal/subcontractors", "Subs")}
```

- [ ] **Step 2: Verify navigation works**

Run: `npm run dev`

Navigate to the internal section and confirm:
- "Details" link appears in the nav bar between "Catalog" and "Subs"
- Clicking it navigates to the details page
- Active state highlights correctly

- [ ] **Step 3: Commit**

```bash
git add src/components/internal/InternalNav.tsx
git commit -m "feat: add Details link to internal navigation"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx jest`

Expected: All tests pass, including the new `detail-library.test.ts`.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: Build succeeds with no TypeScript or lint errors.

- [ ] **Step 3: End-to-end smoke test**

Run: `npm run dev`

Verify the full flow:
1. Navigate to `/internal/details`
2. All ~55 seeded details display
3. Filter by trade (e.g., "Roofing") — shows only roofing details
4. Filter by CSI division (e.g., "Div 07") — shows thermal/moisture protection details
5. Search "simpson" — shows only Simpson Strong-Tie entries
6. Combine filters — trade "Carpentry" + search "flashing" — shows relevant subset
7. Clear filters — all details return
8. Click a card — opens source URL in new tab
