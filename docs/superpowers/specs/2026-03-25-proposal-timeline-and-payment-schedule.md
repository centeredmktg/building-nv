# Proposal Timeline & Payment Schedule

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Add auto-generated project timeline and milestone-based payment schedule to the client-facing proposal page, with full editability in the QuoteEditor.

---

## Problem

The current proposal shows scope + total cost but gives the client no visibility into **when** work happens or **when** payments are due. Property managers and landlords managing multiple properties need to see cash flow timing upfront. A proposal that includes a high-level project plan alongside pricing is a meaningful differentiator.

## Design

### Approach

Approach A: stored milestones on the Quote with auto-generation from scope sections. Milestones are editable per-quote in the QuoteEditor before sending.

This is designed to evolve toward a full critical path engine (Approach C) for higher-complexity project types like kitchens and custom home builds. The data model supports that transition without breaking changes.

---

## Data Model

### New: `QuoteMilestone`

```prisma
model QuoteMilestone {
  id           String  @id @default(cuid())
  quoteId      String
  quote        Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  name         String                    // "Demolition", "Paint & Drywall", etc.
  weekNumber   Int                       // 0 = signing week, 1, 2, 3...
  duration     String?                   // "3-5 days", "1 week", etc.
  paymentPct   Float?                    // 10, 25, null — percentage of total due at this milestone
  paymentLabel String?                   // "Contract Signing", "Materials Purchase", etc.
  position     Int                       // display order

  @@unique([quoteId, position])
}
```

### Quote Model Changes

- Add relation: `milestones QuoteMilestone[]`
- The existing `paymentTerms` text field remains for backwards compatibility on old quotes. New quotes use milestones as the source of truth for payment schedule.
- Existing `estimatedStartDate` on Quote is used as the timeline anchor. If null, "today" is used on the proposal render.
- Existing `estimatedDuration` can be auto-calculated as the max weekNumber value (in weeks).

### Payment Amount Derivation

Payment dollar amounts are **never stored** — always derived at render time:

```
paymentAmount = (milestone.paymentPct / 100) * totals.total
```

This ensures line item changes automatically update the payment schedule.

---

## Auto-Generation Logic

When a quote is created with scope sections, milestones are auto-generated based on the sections present. The generation maps section titles to a known trade sequence with conservative duration estimates.

### Default Payment Split

The default distribution front-loads cash to cover material procurement and lead times:

```
10% — Contract Signing (Week 0)
25% — First trade phase / Materials Purchase (Week 1)
25% — Second trade phase (Week 2)
25% — Third trade phase (Week 3-4)
10% — Fourth trade phase (Week 4)
5%  — Final Walkthrough / Punch List (last week)
```

If fewer than 4 scope sections exist, the percentages consolidate (e.g., 3 sections: 10/30/30/25/5 signing/phase1/phase2/phase3/final). If more than 4, the middle phases split the 75% (25+25+25) evenly.

### Duration Mapping

Conservative estimates by trade for commercial interior:

| Trade | Duration Estimate |
|-------|-------------------|
| Demolition | 3-5 days |
| Paint & Drywall | 5-7 days |
| Flooring | 5-8 days |
| Ceiling | 2-3 days |
| Electrical | 3-5 days |
| Plumbing | 3-5 days |
| Framing | 5-7 days |
| Finish Carpentry | 3-5 days |
| HVAC | 3-5 days |
| Final Walkthrough | 1-2 days |

Sections that don't match a known trade get a default of "3-5 days".

The week number increments by 1 per phase by default (weekly cadence). The auto-generation creates a "Contract Signed" milestone at week 0 and a "Final Walkthrough & Punch List" milestone at the end, regardless of scope sections.

### Example: 831 Deming Way

Scope sections: Demolition, Paint & Drywall, Flooring, Ceiling

Generated milestones:

| Pos | Week | Name | Duration | Payment % | Payment Label |
|-----|------|------|----------|-----------|---------------|
| 0 | 0 | Contract Signed | — | 10 | Contract Signing |
| 1 | 1 | Demolition | 3-5 days | 25 | Materials Purchase |
| 2 | 2 | Paint & Drywall | 5-7 days | 25 | Phase 2 Progress |
| 3 | 3 | Flooring | 5-8 days | 25 | Phase 3 Progress |
| 4 | 4 | Ceiling | 2-3 days | 10 | Phase 4 Progress |
| 5 | 5 | Final Walkthrough & Punch List | 1-2 days | 5 | Project Completion |

---

## QuoteEditor Integration

### Milestone Editor (sidebar)

Add a "Project Timeline & Payments" section to the QuoteEditor sidebar, below the existing start date and duration fields:

- List milestones in position order
- Each milestone row shows: name, week number (editable number input), duration (editable text), payment % (editable number input)
- Running total of payment percentages displayed at the bottom — warn (amber) if != 100%, error (red) if > 100%
- "Regenerate from Sections" button — re-derives milestones from current scope sections, replacing existing milestones (confirm dialog first)
- Milestones are saved via the existing quote PUT endpoint alongside other quote data

### API Changes

**POST /api/quotes** — auto-generate milestones when sections are provided. Include milestones in the response.

**PUT /api/quotes/[id]** — accept `milestones` array in the request body. Delete existing milestones and recreate (simpler than diffing). Include milestones in the response.

**GET /api/quotes** and **GET /api/quotes/[id]** — include milestones in the response (add to Prisma include).

---

## Proposal Page Rendering

New section placed between the "Total Investment" block and "Payment Terms". Two sub-sections:

### 1. Project Timeline — Visual Bar Chart

A simplified horizontal bar chart (not a full Gantt — no dependency arrows or resource lanes). Each phase gets a horizontal bar spanning its week range, stacked vertically. This gives clients an immediate visual of how the project flows and where phases overlap.

**Layout:**

```
Week:        0     1     2     3     4     5
             |     |     |     |     |     |
Signing      [==]
Demolition         [=========]
Paint & DW               [==============]
Flooring                        [================]
Ceiling                                   [======]
Punch List                                      [===]
```

**Styling:**
- Week columns evenly spaced across the container width
- Phase bars are rounded rectangles — navy fill (`#1E2A38`) with copper left-border for payment milestones
- Payment milestones get a small copper diamond marker on the bar
- Phase name labels sit to the left of the bars
- Week numbers along the top, with projected dates below (e.g., "Apr 1", "Apr 8")
- Bars use CSS grid columns mapped to week positions — no JS charting library needed

**The bar width for each phase is derived from:**
- Start: `weekNumber * columnWidth`
- Width: duration mapped to approximate fractional weeks (e.g., "3-5 days" = ~0.7 weeks, "5-7 days" = ~1 week)
- Phases can overlap if weekNumbers are close — this is intentional for concurrent trades

**Below the chart**, a subtle note: "Timeline assumes project start of [date]. Actual dates may vary based on material availability and scheduling."

The anchor date is `quote.estimatedStartDate` if set, otherwise the current date.

### 2. Payment Schedule

Table styled consistently with the scope section line items (white card, bordered, zebra striping):

| Milestone | Week | Payment | Amount | Balance |
|-----------|------|---------|--------|---------|
| Contract Signed | 0 | 10% | $X,XXX | $XX,XXX |
| Demolition / Materials | 1 | 25% | $XX,XXX | $XX,XXX |
| ... | ... | ... | ... | ... |
| Final Walkthrough | 5 | 5% | $X,XXX | $0 |

Columns:
- **Milestone**: name + paymentLabel
- **Week**: weekNumber
- **Payment**: paymentPct displayed as percentage
- **Amount**: derived from pct * total, formatted with commas
- **Balance**: running balance (total minus cumulative payments), ends at $0

The balance column is the key differentiator — property managers see exactly when cash is needed.

---

## What This Does NOT Include

- Gantt chart rendering (future — Approach C)
- Dependency chains between milestones (future — Approach C)
- Invoice generation tied to milestones (future feature, separate spec)
- Milestone completion tracking (that's the Project Milestone model, post-contract)
- Changes to the contract or change order templates (separate concern)

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `QuoteMilestone` model, add relation on `Quote` |
| `src/app/api/quotes/route.ts` | Auto-generate milestones on POST, include in response |
| `src/app/api/quotes/[id]/route.ts` | Accept milestones on PUT, include in GET |
| `src/app/proposals/[slug]/page.tsx` | Add timeline + payment schedule sections |
| `src/components/internal/QuoteEditor.tsx` | Add milestone editor in sidebar |
| `src/lib/milestone-defaults.ts` | New — trade duration mapping and auto-generation logic |
| `src/lib/pricing.ts` | Add payment schedule calculation helper |
