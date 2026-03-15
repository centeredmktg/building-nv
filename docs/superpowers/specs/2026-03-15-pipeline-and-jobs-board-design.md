# Pipeline Enhancements & Active Jobs Board — Design Spec

**Date:** 2026-03-15
**Status:** Approved for implementation planning

---

## Vision

One pipeline from first contact to project completion. Pre-contract stages are a sales motion (potential energy). Post-contract stages are a project management workflow (kinetic energy). These two contexts deserve separate views but share a single data model.

Future systems (invoice engine, cost tracking, Gusto labor integration, procurement/vendor ordering, change orders) will plug into this foundation. This spec covers Bite 1 only: schema, pipeline enhancements, and the Active Jobs board with manual financial/milestone entry.

---

## Pre-Contract Stage Migration (Prerequisite)

The current pipeline has 6 pre-contract stages:
`opportunity_identified → quote_requested → bid_delivered → contract_completed → contract_sent → contract_signed → closed_lost`

This spec collapses them to 3:
`opportunity_identified → quote_sent → contract_signed → closed_lost`

**Migration strategy:**
- `quote_requested` + `bid_delivered` → `quote_sent`
- `contract_completed` + `contract_sent` → `contract_signed`
- `opportunity_identified` and `closed_lost` → unchanged

A data migration script runs `UPDATE Project SET stage = 'quote_sent' WHERE stage IN ('quote_requested', 'bid_delivered')` and `UPDATE Project SET stage = 'contract_signed' WHERE stage IN ('contract_completed', 'contract_sent')` before deploying the new kanban column definitions.

`crmTypes.ts` STAGES array is replaced with the following complete ordered array:

```typescript
export const STAGES = [
  { id: "opportunity_identified", label: "Opportunity Identified" },
  { id: "quote_sent",             label: "Quote Sent" },
  { id: "contract_signed",        label: "Contract Signed" },
  { id: "closed_lost",            label: "Closed Lost" },
  { id: "preconstruction",        label: "Preconstruction" },
  { id: "active",                 label: "Active" },
  { id: "punch_list",             label: "Punch List" },
  { id: "complete",               label: "Complete" },
] as const;
```

`StageId` type is regenerated from the new array. The pipeline KanbanBoard only renders columns for the first four stages; the jobs board only uses the last four.

---

## Full Pipeline Stages

```
opportunity_identified → quote_sent → contract_signed → preconstruction → active → punch_list → complete
                                                     ↘                                           ↘
                                                   closed_lost ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

`closed_lost` is reachable from **any stage** — a deal can fall through at any point. It is never shown in the Active Jobs board.

**Pipeline view** shows: `opportunity_identified`, `quote_sent`, `contract_signed`, `closed_lost`
**Active Jobs view** shows: `preconstruction`, `active`, `punch_list`, `complete` (with toggle to hide `complete`)

The pipeline page DB query filters to pre-contract stages only:
```
WHERE stage IN ('opportunity_identified', 'quote_sent', 'contract_signed', 'closed_lost')
```
Post-contract projects never reach the KanbanBoard component.

---

## Schema Additions

### Project (new fields)

```prisma
estimatedCloseDate  DateTime?  // pipeline view — "Est. Close" label on kanban cards
contractAmount      Float?     // what the customer pays — set at activation
targetCostAmount    Float?     // internal cost budget — set at activation
estimatedStartDate  DateTime?  // seeds from quote.estimatedStartDate at activation
estimatedEndDate    DateTime?  // seeds from quote at activation (quote.estimatedDuration used to derive if no explicit date)
timingNotes         String?    // free-form timing context (e.g. "12 weeks from permit approval")
```

### Quote (new fields)

```prisma
estimatedDuration   String?    // e.g. "8 weeks", "3 months" — shown on quote, used to seed project plan
estimatedStartDate  DateTime?  // target start — shown on quote, seeds project.estimatedStartDate at activation
```

These fields must be exposed in the quote edit UI (`/internal/quotes/[id]/edit`). They are added as a new "Project Timeline" section in the QuoteEditor, below the existing markup/overhead/profit fields and above the line items. Layout: two fields side by side — "Est. Start Date" (date input, maps to `estimatedStartDate`) and "Est. Duration" (text input, e.g. "8 weeks", maps to `estimatedDuration`). Labels are plain text, no asterisk (optional fields). If null at activation, the activate modal prompts the user to enter them directly.

### Milestone (new model)

```prisma
model Milestone {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  plannedDate DateTime?
  completedAt DateTime?
  position    Int
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

---

## Milestone Templates

Templates are selected based on `project.projectType`. The exact string values that trigger each template match the values in use across the quoting and contact forms:

**Office Buildout template** — triggers on: `"Office Buildout"`, `"Medical Suite"`, `"Warehouse / Industrial"`, `"Suite Renovation"`, `"Retail / Restaurant"`, `"Retail & Restaurant"`, `"Light Maintenance / Repair"`
Milestones: Preconstruction → Demo → Rough-In (MEP) → Inspections → Drywall & Finish → Punch List → Final Walkthrough

**Kitchen / Bathroom template** — triggers on: `"Kitchen Remodel"`, `"Bathroom Renovation"`
Milestones: Preconstruction → Demo → Rough-In → Tile & Fixtures → Finish Carpentry → Punch List → Final Walkthrough

**Custom Residential template** — triggers on: `"Custom Residential Build"`
Milestones: Preconstruction → Foundation → Framing → MEP Rough → Insulation & Drywall → Finish Work → Landscaping → Punch List → Final Walkthrough

**Default template** — triggers on: `"Other"`, `null`, or any unrecognized value
Milestones: Preconstruction → Active Work → Punch List → Final Walkthrough

All milestones are created with `plannedDate: null` and `completedAt: null`. The user sets dates manually on the project detail page after activation.

---

## Pipeline View (Enhanced)

Existing kanban board. Changes:

- **Stage columns** updated to: `opportunity_identified`, `quote_sent`, `contract_signed`, `closed_lost`
- **Cards** show `estimatedCloseDate` formatted as "Est. Close: Mar 30" (new field; displays "—" if null)
- **Cards** show linked accepted quote total if a quote with `status: "accepted"` is linked to the project; displays "—" if none
- **`contract_signed` column cards** show an "Activate Job →" CTA button
- **`closed_lost` is reachable from any card** via the existing stage drag or the LeadPanel stage selector

### Activation Flow

Clicking "Activate Job →" opens a modal/panel with:

| Field | Pre-filled from | Required |
|---|---|---|
| Contract Amount | linked accepted quote total | Yes |
| Target Cost | blank | Yes |
| Est. Start Date | `quote.estimatedStartDate` | No |
| Est. End Date | derived from start + `quote.estimatedDuration` | No |
| Timing Notes | blank / free-form (user-entered) | No |

On confirm: calls `POST /api/projects/[id]/activate`. Guard: if `project.stage` is already a post-contract stage, returns 409 with message "Project is already active." Response: updated project object with seeded milestones.

After activation: redirect to `/internal/jobs`.

---

## Active Jobs Board (`/internal/jobs`)

New nav item: **Jobs** (added to internal nav after "Projects"). Pipeline nav item retains its name.

Shows projects in `preconstruction`, `active`, `punch_list`. Toggle to include/exclude `complete` (default: hidden).

### Card Layout

Card grid, sorted by `estimatedEndDate` ascending (soonest deadline first; null dates sort last).

| Field | Source | Null fallback |
|---|---|---|
| Job name | `project.name` | — |
| Address | `project.siteAddress` | "No address on file" |
| Stage badge | `project.stage` | — |
| Contract amount | `project.contractAmount` | "—" |
| Uninvoiced remaining | `contractAmount` (placeholder — full amount until invoice engine) | "—" |
| Target margin % | `((contractAmount - targetCostAmount) / contractAmount) * 100` | "—" if either is null |
| Budget health | Gray dot — placeholder until cost tracking | always gray |
| Schedule health | Derived from milestones (see logic below) | Gray if no milestones |
| Next milestone | Earliest incomplete milestone name + planned date | "No milestones set" |
| Est. completion | `project.estimatedEndDate` | "—" |

**Stage badge colors:**
- `preconstruction` → blue
- `active` → amber
- `punch_list` → orange
- `complete` → green

### Schedule Health Logic

```
no milestones set → gray
any incomplete milestone where plannedDate < today → red
next incomplete milestone plannedDate is within 3 days → yellow
all milestones on track (or no planned dates set) → green
```

---

## Project Detail Page (Additions)

Two new sections added to `/internal/projects/[id]` page:

### Financial Summary section

Displays: Contract Amount, Target Cost, Target Margin %, Uninvoiced Remaining (placeholder).
All four fields are editable inline. Editing calls `PATCH /api/projects/[id]` with the financial fields added to the allowed fields allowlist: `contractAmount`, `targetCostAmount`, `estimatedStartDate`, `estimatedEndDate`, `timingNotes`.

### Milestones section

- List of milestones sorted by `position`
- Each row: name, planned date (editable), complete toggle (updates `completedAt`), notes (editable), delete button
- "Add Milestone" button appends a new blank row with `position = max(existing positions) + 1` (or 0 if no milestones exist)
- Template seeding assigns positions by array index (0, 1, 2...)
- Reorder via up/down arrow buttons: swaps `position` values between the two adjacent milestones (two sequential PATCH calls). After any delete, positions are not re-indexed — gaps are acceptable since sort is by `position` ascending. Bulk reorder endpoint not required for v1.
- Complete toggle sets `completedAt: new Date()` on check, `completedAt: null` on uncheck

---

## API Routes

### New routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/projects/[id]/activate` | Transition to `preconstruction`, seed financial fields + milestones. Guard: 409 if already post-contract. Request body: `{ contractAmount, targetCostAmount, estimatedStartDate?, estimatedEndDate?, timingNotes? }`. Response: updated project + created milestones. Quote fields read: linked accepted quote total, `quote.estimatedStartDate`, `quote.estimatedDuration`. If no accepted quote is linked, form fields are user-entered only. |
| GET | `/api/jobs` | Fetch projects in post-contract stages with all milestones included (full milestone list required to compute schedule health and next milestone). Query param: `?includeComplete=true` to include `complete` stage. Default excludes `complete`. Prisma include shape: `{ milestones: { orderBy: { position: 'asc' } }, projectContacts: { include: { contact: true } } }`. |
| GET | `/api/projects/[id]/milestones` | List milestones for a project, ordered by `position` |
| POST | `/api/projects/[id]/milestones` | Create a milestone |
| PATCH | `/api/projects/[id]/milestones/[milestoneId]` | Update milestone (name, plannedDate, completedAt, position, notes) |
| DELETE | `/api/projects/[id]/milestones/[milestoneId]` | Delete a milestone |

### Modified routes

| Method | Route | Change |
|---|---|---|
| PATCH | `/api/projects/[id]` | Add to allowed fields: `contractAmount`, `targetCostAmount`, `estimatedStartDate`, `estimatedEndDate`, `timingNotes`, `estimatedCloseDate` |

---

## Navigation Changes

- Internal nav: add **Jobs** link after "Projects"
- "Projects" nav item stays as-is (links to `/internal/projects` — the pipeline kanban)
- Jobs links to `/internal/jobs`
- InternalNav active-link detection: the "Projects" link must use exact match (`pathname === '/internal/projects'`) not `startsWith`, to prevent it highlighting when the user is on a project detail page (`/internal/projects/[id]`) that may be a post-contract job. The Jobs link uses `startsWith('/internal/jobs')`.

---

## What's Explicitly Out of Scope (Next Bites)

- Invoice engine (milestone-triggered, % complete, ad-hoc)
- Cost tracking (labor hours + materials against job)
- Gusto API integration for labor costs
- Change order tracking
- Procurement / vendor RFQ / agentic materials ordering
- QuickBooks sync
- Bulk milestone reorder endpoint (v1 uses sequential PATCH with up/down arrows)

---

## Success Criteria

- Pre-contract stage migration runs without data loss
- Contract activation takes < 60 seconds: fill required fields, milestones pre-populated, redirect to jobs board
- Jobs board gives instant health read on all active projects at a glance
- Schedule health indicator accurately reflects milestone dates
- No data re-entry between quoting and project activation when quote fields are populated
- Financial fields are editable after activation
- `closed_lost` is reachable from any stage
