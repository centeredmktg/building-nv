# Pipeline Enhancements & Active Jobs Board — Design Spec

**Date:** 2026-03-15
**Status:** Approved for implementation planning

---

## Vision

One pipeline from first contact to project completion. Pre-contract stages are a sales motion (potential energy). Post-contract stages are a project management workflow (kinetic energy). These two contexts deserve separate views but share a single data model.

Future systems (invoice engine, cost tracking, Gusto labor integration, procurement/vendor ordering, change orders) will plug into this foundation. This spec covers Bite 1 only: schema, pipeline enhancements, and the Active Jobs board with manual financial/milestone entry.

---

## Pipeline Stages (Full)

```
opportunity_identified → quote_sent → contract_signed → preconstruction → active → punch_list → complete
                                                                                              ↘ closed_lost
```

- **Pipeline view** shows: `opportunity_identified → quote_sent → contract_signed`
- **Active Jobs view** shows: `preconstruction → active → punch_list → complete`
- `contract_signed` is the handoff column — cards show an "Activate Job →" button that transitions the project to `preconstruction` and redirects to Active Jobs

---

## Schema Additions

### Project (new fields)

```prisma
contractAmount      Float?     // what the customer pays
targetCostAmount    Float?     // internal cost budget (drives margin target)
estimatedStartDate  DateTime?  // seeds from quote at activation
estimatedEndDate    DateTime?  // seeds from quote at activation
timingNotes         String?    // free-form from quote (e.g. "12 weeks from permit")
```

### Quote (new fields)

```prisma
estimatedDuration   String?    // e.g. "8 weeks", "3 months"
estimatedStartDate  DateTime?  // target start date set during quoting
```

These fields persist from quote into project at contract activation. Nothing re-entered.

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
}
```

### Milestone templates by project type

Pre-populated at job activation. All overridable.

**Office Buildout / Commercial TI:**
Preconstruction → Demo → Rough-In (MEP) → Inspections → Drywall & Finish → Punch List → Final Walkthrough

**Kitchen / Bathroom Remodel:**
Preconstruction → Demo → Rough-In → Tile & Fixtures → Finish Carpentry → Punch List → Final Walkthrough

**Custom Residential Build:**
Preconstruction → Foundation → Framing → MEP Rough → Insulation & Drywall → Finish Work → Landscaping → Punch List → Final Walkthrough

**Default (Other / Unknown):**
Preconstruction → Active Work → Punch List → Final Walkthrough

---

## Pipeline View (Enhanced)

Existing kanban board. Changes:

- **Cards** — show linked accepted quote amount if available, formatted with commas
- **Date label** — renamed from whatever it currently says to "Est. Close"
- **Stage columns** — limited to pre-contract stages: `opportunity_identified`, `quote_sent`, `contract_signed`
- **contract_signed column** — cards show "Activate Job →" CTA button. On click: prompts for `contractAmount`, `targetCostAmount`, `estimatedStartDate`, `estimatedEndDate` (pre-filled from quote where available), then transitions stage to `preconstruction`, seeds milestone template based on `projectType`, and redirects to `/internal/jobs`

---

## Active Jobs Board (`/internal/jobs`)

New nav item: **Jobs**. Shows projects in `preconstruction`, `active`, `punch_list`, `complete`.

### Layout

Card grid (not kanban — jobs aren't dragged between stages). Cards sorted by `estimatedEndDate` ascending (soonest deadline first).

### Card Fields

| Field | Source |
|---|---|
| Job name | `project.name` |
| Address | `project.siteAddress` |
| Stage badge | `project.stage` — color coded (blue: preconstruction, amber: active, orange: punch_list, green: complete) |
| Contract amount | `project.contractAmount` |
| Uninvoiced remaining | `contractAmount` minus sum of invoices (placeholder: shows full contract amount until invoice engine exists) |
| Target margin % | `((contractAmount - targetCostAmount) / contractAmount) * 100` |
| Budget health | Green/yellow/red dot — placeholder (always gray) until cost tracking exists |
| Schedule health | Green/yellow/red dot — derived from milestones: all on track = green, any overdue incomplete = red, next milestone within 3 days = yellow |
| Next milestone | Earliest incomplete milestone name + planned date |
| Est. completion | `project.estimatedEndDate` |

### Schedule Health Logic

```
if no milestones → gray (not set up)
if any incomplete milestone.plannedDate < today → red
if next incomplete milestone.plannedDate within 3 days → yellow
else → green
```

### Budget Health Logic (placeholder)

Gray until cost tracking (labor + materials) is implemented. Field exists in the UI as a visual placeholder so the card layout doesn't change when it goes live.

---

## Project Detail Page (Additions)

Two new sections added to `/internal/projects/[id]`:

### Financial Summary

- Contract amount
- Target cost
- Target margin %
- Uninvoiced remaining (placeholder)
- Budget health status (placeholder)

### Milestones

- List of milestones with name, planned date, completed toggle, notes
- Add milestone button
- Drag to reorder (or simple up/down arrows to start)
- Completion toggle updates `completedAt` timestamp

---

## API Routes (New/Modified)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/projects/[id]/activate` | Transition to preconstruction, seed financial fields + milestones from quote |
| GET/POST | `/api/projects/[id]/milestones` | List and create milestones |
| PATCH | `/api/projects/[id]/milestones/[milestoneId]` | Update milestone (complete, reorder, edit) |
| DELETE | `/api/projects/[id]/milestones/[milestoneId]` | Delete milestone |
| GET | `/api/jobs` | Fetch all active-phase projects with milestones for jobs board |

---

## What's Explicitly Out of Scope (Next Bites)

- Invoice engine (milestone-triggered, % complete, ad-hoc)
- Cost tracking (labor hours + materials against job)
- Gusto API integration for labor costs
- Change order tracking
- Procurement / vendor RFQ / agentic materials ordering
- QuickBooks sync

---

## Navigation Changes

Add **Jobs** link to internal nav, between Projects and Employees (or after Projects). Pipeline and Jobs are peer nav items, not nested.

---

## Success Criteria

- Contract activation takes < 60 seconds: fill 4 fields, milestones pre-populated, redirected to jobs board
- Jobs board gives instant health read on all active projects at a glance
- No data re-entry between quoting and project activation
- Schedule health indicator is accurate based on milestone dates
