# Per-Trade Internal Cost Commitments — Design Spec

**Date:** 2026-04-17
**Status:** Approved

## Purpose

Every line item on a quote gets a trade assignment and an internal cost commitment. This enables margin visibility per trade during quoting and persists committed costs to the project after contract signing. Prevents post-hoc cost disputes (e.g., "painting cost $20K" on a lump-sum contract with no internal allocation).

**Design principle:** Inputs are the only debatable part. Once quantities, rates, and crew sizes are locked, the math is deterministic and defensible. AI classifies unstructured scope into structured line items. A deterministic engine calculates costs from a database-backed rate table. AI never holds market rates or estimates costs directly.

## Data Model

### Existing Fields (already in schema, currently unused)

- `LineItemSection.trade` (String?) — default trade for items in that section
- `LineItem.trade` (String?) — trade classification, inherits from section if not set
- `LineItem.vendorCost` (Float?) — repurposed as total internal cost for the line item

### New Fields on LineItem

- `estimatedHours` (Float?) — labor hours for self-performed trades
- `hourlyRate` (Float?) — labor rate per hour for self-performed trades
- `materialCost` (Float?) — material cost for self-performed trades
- `costType` (String?) — `"self_performed"` or `"subcontracted"`, auto-set from trade classification but overridable

For self-performed items: `vendorCost = (estimatedHours × hourlyRate) + materialCost`
For subcontracted items: `vendorCost` is entered directly as the sub bid.

`vendorCost` is the single source of truth for internal cost regardless of how it was calculated.

### New Model: TradeRate

Rate table backing the deterministic pricing engine.

```
TradeRate {
  id              String    @id @default(cuid())
  trade           String    // from trades.ts classification
  costType        String    // "self_performed" or "subcontracted"

  // Self-performed rates
  laborRatePerHour    Float?    // $/hr for this trade
  defaultCrewSize     Int?      // typical crew size
  productivityRate    Float?    // units per labor-hour (e.g., SF/hr for painting)
  productivityUnit    String?   // unit type: "sf", "lf", "ea", "unit"
  materialCostPerUnit Float?    // material cost per unit of work

  // Subcontracted rates
  typicalCostPerUnit  Float?    // supply+install $/unit for sub bids

  // Metadata
  effectiveDate   DateTime  @default(now())
  source          String    // "CPP actuals", "sub bid average", "initial estimate"
  notes           String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([trade, costType])
}
```

## Trade Assignment

Sections set a default trade. Line items inherit the section trade unless overridden. This handles both clean cases (painting section = all painting) and mixed cases (kitchenette section = plumbing + electrical + carpentry).

Trade values come from the existing `trades.ts` classification: general_labor, carpentry, electrical, plumbing, hvac, painting, concrete, roofing, flooring, drywall, insulation, demolition, excavation, landscaping, fire_protection, low_voltage, glazing, masonry, welding, other.

Cost type (`self_performed` or `subcontracted`) auto-sets based on existing in-house classification in `claude.ts` but is overridable per line item.

Self-performed trades: framing/carpentry, painting, general labor, demolition, cleanup, site prep.
Subcontracted trades: concrete, roofing, plumbing, electrical, HVAC, insulation, drywall, flooring, cabinets/countertops.

## Deterministic Pricing Engine

After AI structures line items with trade/quantity/unit, the engine runs:

1. Resolve trade for each line item (line item trade → section trade fallback)
2. Look up `TradeRate` by trade + costType
3. **Self-performed:** `estimatedHours = (quantity / productivityRate) × defaultCrewSize` where applicable (total labor hours across crew), `hourlyRate` from table, `materialCost = quantity × materialCostPerUnit`. Total: `vendorCost = (estimatedHours × hourlyRate) + materialCost`
4. **Subcontracted:** `vendorCost = quantity × typicalCostPerUnit`
5. **Missing rate:** Flag line item for manual entry. Do not guess. The item shows a "needs rate" indicator in the UI.

Customer-facing `unitPrice` is then derived from `vendorCost` using the existing markup/overhead/profit percentages on the quote, or can be manually set.

### Gap Handling

When the rate table has no entry for a trade:
- Line item is flagged visually (icon + highlight in QuoteEditor)
- Internal cost fields are blank, waiting for manual entry
- AI can suggest an initial rate value based on contextual research, but it goes into the `TradeRate` table for human review before it's used in any calculation
- The `source` field on TradeRate tracks provenance ("initial estimate" vs. "CPP actuals" vs. "sub bid average")

## AI Quote Generation

**AI's role:** Classify unstructured scope into structured line items.

For each line item, AI determines:
- `trade` — which trade this belongs to
- `costType` — self_performed or subcontracted (from in-house classification)
- `quantity` and `unit` — how much of what
- `description` — what the work is

For each section, AI determines:
- `trade` — default trade from dominant trade in that section

**AI does NOT determine:** hourly rates, material costs, sub bid estimates, customer-facing prices, or any dollar amounts. All pricing runs through the deterministic engine against the rate table.

The streaming response shape (section/extracted/done events) adds `trade` and `costType` to each line item in the section event. No new event types.

After AI returns structured items, the pricing engine runs automatically to populate cost fields from the rate table.

## QuoteEditor UI

Dual-view: customer-facing pricing (existing) alongside internal cost (new).

### Section Level
- Trade dropdown (sets default for items in section)
- Section subtotal row: customer price, internal cost, margin $, margin %

### Line Item Level
- Trade tag (inherited from section, click to override)
- Cost type indicator (self-performed / subcontracted)
- Self-performed items: `estimatedHours`, `hourlyRate` (from rate table, editable), `materialCost`, calculated total
- Subcontracted items: single `internalCost` field
- Per-item margin (customer price vs. internal cost)
- Flag icon if rate was missing from table and needs validation

### Quote-Level Summary
- Margin by trade table: trade, total customer price, total internal cost, margin $, margin %
- Overall margin summary row

Internal cost columns are only visible to authenticated internal users. They never appear on customer-facing proposal pages (`/proposals/[slug]`).

## Contract Conversion & Project Persistence

When a quote converts to a contract:
- Line item trade assignments and internal costs persist on the quote (quote data is not deleted)
- `Project.targetCostAmount` auto-populates as the sum of all `vendorCost` values across line items
- Project detail page gains a **Cost Commitment Summary** panel showing committed cost by trade, pulled from the source quote's line items

### Cost Commitment Summary Panel (Project Detail)

Table showing:
| Trade | Committed Cost | Contract Price | Margin $ | Margin % |
|-------|---------------|----------------|----------|----------|

Visible on the internal project detail page for any project with stage `contract_signed` or later.

### Future: Committed vs. Actual (out of scope)

When time tracking and material receipt tracking exist, this panel adds an "actuals" column. The data structure supports it — committed costs are already stored per trade on the quote line items. This is a separate feature that depends on time tracking and material tracking infrastructure.

## Files Changed

### New Files
- `src/lib/pricing-engine.ts` — deterministic cost calculation from rate table
- `src/app/api/trade-rates/route.ts` — CRUD for trade rates
- `src/components/internal/CostCommitmentSummary.tsx` — project-level margin by trade panel

### Modified Files
- `prisma/schema.prisma` — add TradeRate model, add new fields to LineItem
- `src/lib/claude.ts` — update AI prompt to return trade/costType per line item (remove market rate context)
- `src/lib/pricing.ts` — add margin calculation using vendorCost
- `src/components/internal/QuoteEditor.tsx` — add internal cost columns, trade dropdowns, margin display
- `src/app/api/quotes/route.ts` — persist trade/cost fields on line item create
- `src/app/api/quotes/[id]/route.ts` — persist trade/cost fields on line item update
- `src/app/api/quotes/generate/route.ts` — run pricing engine after AI generation
- `src/app/api/quotes/[id]/convert-to-contract/route.ts` — auto-populate targetCostAmount from line item vendorCost sum
- `src/app/internal/projects/[id]/page.tsx` — add CostCommitmentSummary panel

## Out of Scope

- Actual cost tracking (time sheets, material receipts) — future feature
- Committed vs. actual comparison — depends on actual cost tracking
- TradeRate admin UI — seed from code initially, build admin page later
- Per-employee hourly rates — use trade-level rates for now
- Historical rate versioning — single current rate per trade, effectiveDate for reference only
