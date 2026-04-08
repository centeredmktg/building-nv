# Architectural Detail Library — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Approach:** Single table + tags (Approach C)

## Problem

CPP's team currently has no centralized way to find architectural construction details. They search manufacturer websites individually, which is slow and inconsistent. A curated, searchable catalog inside building-nv gives the team instant access to the most relevant details organized by trade and CSI division.

## Data Model

```prisma
model DetailLibraryItem {
  id           String   @id @default(cuid())
  name         String                          // "Eave Flashing Detail"
  description  String?                         // Brief explanation of what the detail covers
  manufacturer String                          // "GAF", "Simpson Strong-Tie", "ARCAT"
  trade        String                          // TradeId — maps to existing trades in src/lib/trades.ts
  csiDivision  String?                         // "07", "06", etc.
  csiTitle     String?                         // "Thermal & Moisture Protection" — human-readable
  detailType   String                          // "installation" | "assembly" | "connection" | "flashing" | "waterproofing" | "structural" | "general"
  format       String                          // "DWG" | "PDF" | "DXF" | "RFA" | "SKP"
  sourceUrl    String                          // Link to detail on manufacturer/library site
  tags         String[]                        // ["submittal", "residential", "flashing", "roof"]
  isFree       Boolean  @default(true)
  notes        String?                         // "Registration required" or other access notes
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Design Decisions

- **No relations** to other models. Standalone reference catalog.
- **`trade` uses existing `TradeId` values** from `src/lib/trades.ts` for consistency across the app.
- **`manufacturer` is a string**, not a foreign key to `Vendor`. If manufacturers need to become first-class entities later, add a nullable `vendorId`. For a reference catalog, string is sufficient.
- **`tags` as `String[]`** gives flexible filtering without schema changes. Useful for cross-cutting concerns like "submittal", "residential", "commercial", "moisture-barrier".
- **`csiDivision` + `csiTitle` are optional.** Trade is the primary filter; CSI is there for precision when handing off to architects or pulling submittals.

### Detail Type Values

| Value | Description |
|---|---|
| `installation` | How to install a specific product |
| `assembly` | Wall/roof/foundation assembly cross-sections |
| `connection` | Structural connections (hangers, tie-downs, anchors) |
| `flashing` | Flashing and transition details |
| `waterproofing` | Below-grade and moisture barrier details |
| `structural` | Structural engineering details |
| `general` | Catch-all for details that don't fit above |

### CSI Division Reference

Common divisions relevant to CPP's work:

| Division | Title |
|---|---|
| 03 | Concrete |
| 04 | Masonry |
| 05 | Metals |
| 06 | Wood, Plastics, and Composites |
| 07 | Thermal and Moisture Protection |
| 08 | Openings (Doors, Windows) |
| 09 | Finishes |
| 22 | Plumbing |
| 23 | HVAC |
| 26 | Electrical |
| 31 | Earthwork |

## Seed Data

A TypeScript seed script at `prisma/seeds/detail-library.ts` populates the catalog. The script uses upsert logic (keyed on `sourceUrl`) so it can be re-run without duplicating entries.

### Sources and Approximate Coverage

| Source | Trade(s) | Detail Types | ~Count |
|---|---|---|---|
| Simpson Strong-Tie | carpentry, concrete, masonry | connection, structural | 10-12 |
| GAF | roofing | installation, flashing | 8-10 |
| ZIP System / Huber | carpentry, insulation | assembly, flashing | 6-8 |
| James Hardie | carpentry | installation, flashing | 5-6 |
| ARCAT (general) | mixed | mixed | 10-12 |
| CADdetails.com | mixed | mixed | 8-10 |
| Building America (basc.pnnl.gov) | insulation, carpentry | assembly | 5-6 |
| Owens Corning | roofing, insulation | installation | 4-5 |
| LP Building Solutions | carpentry | installation, flashing | 3-4 |

**Total: ~60-80 entries for V1.**

Each entry includes name, description, manufacturer, trade, CSI division (when applicable), detail type, format, source URL, tags, and access notes.

## App Surface

### Route

`/details` — single read-only page.

### UI Components

**Filter bar:**
- Trade dropdown — reuses existing `TRADES` from `src/lib/trades.ts`
- Free-text search — searches across `name`, `manufacturer`, `tags`
- CSI division filter — optional, dropdown of relevant divisions
- Detail type filter — optional
- Format filter — optional

**Results grid:**
- Card layout, each card shows:
  - Name (primary)
  - Manufacturer
  - Detail type badge
  - Format badge (DWG, PDF, etc.)
  - Tags as small chips
  - `isFree` indicator if paid
- Click card → opens `sourceUrl` in new tab

**No create/edit UI for V1.** The seed script is the source of truth. To add or update entries, edit the seed data and re-run.

### Behavior

- All filtering is client-side for V1 (dataset is small, <100 items)
- No pagination needed at this scale
- Empty state: "No details match your filters"

## Future Considerations (Not In Scope)

- Admin UI for CRUD operations on detail entries
- File hosting in Supabase storage (download DWG/PDF directly instead of linking out)
- `vendorId` foreign key to `Vendor` model for manufacturer normalization
- Link details to specific `ProjectTask` or `LineItem` entries
- Automated URL health checking (detect broken links)
- User-submitted detail suggestions
