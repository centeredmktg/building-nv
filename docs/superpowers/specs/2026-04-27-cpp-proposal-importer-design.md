# CPP Proposal Importer — Design Spec

**Date:** 2026-04-27
**Status:** Approved (pending implementation plan)
**Owner:** Danny Cox

## Goal

Backfill 10–30 archival CPP-era proposal PDFs into the Building NV system as `Quote` records. Preserve original numbers exactly (these documents have already been delivered to customers). Display under the CPP brand via the existing `cppBranded` toggle.

## Context

A working manual import pattern already exists: `scripts/seed-2187-market-quote.ts` was hand-written to import one proposal (2187 Market St, Hallmark Investments, $46,378.24). This spec generalizes that pattern so the remaining backfill is repeatable without hand-coding each one.

Existing reference: `scripts/planset-ingestion/` follows the same two-step shape (extract → seed) for blueprint extraction. We're not reusing it — different document type — but the file layout convention is the same.

## Non-Goals

- No live PDF upload UI. CLI scripts only. (Future stream may justify a UI, but that's a separate spec.)
- No re-pricing at Building NV's standard margins. Numbers from the PDF win.
- No automatic CRM `Project` record creation. The `Quote.projectId` is left null; can be linked later.
- No batch mode. One PDF per invocation. Shell loops or a wrapper script handle bulk.
- No deploy-time execution. These run locally against the prod DB by an authorized operator.

## Architecture

Two scripts with a JSON intermediate file. The intermediate exists so the operator can review and correct the LLM extraction before any DB write.

```
                                              ┌─ review/edit JSON
                                              │
PDF             ───extract───►   JSON         ▼
                                  ─────seed─────►   Postgres
2187-market.pdf                  outputs/cpp-imports/    (Quote + sections + items
                                 2187-market-st-ti.json   + Company link)
```

**Extract step**: `scripts/import-cpp-proposal/extract.ts <pdf-path>`
**Seed step**: `scripts/import-cpp-proposal/seed.ts <json-path>`

### Why two scripts?

Volume is 10–30. The LLM is fast but not perfect. A 30-second eyeball pass per JSON before seeding catches hallucinated descriptions, mistagged trades, and total mismatches. Single-script flow would either commit errors silently or require interactive prompts (worse ergonomics at scale).

## Extract Script

`scripts/import-cpp-proposal/extract.ts <pdf-path>`

### Behavior

1. Read PDF as base64.
2. Send to Claude Sonnet 4.6 with a system prompt that defines the extraction schema (tool-use style structured output — not free-text JSON parsing).
3. Compute reconciliation: sum line items, apply extracted OH and Profit, compare to the PDF's stated total.
4. Tag review flags for any anomalies.
5. Write JSON to `outputs/cpp-imports/<slug>.json`. Slug derived from address: lowercase, kebab-case, alphanumeric (`2187 Market St` → `2187-market-st`). If the PDF says "T.I." or "Tenant Improvement", append `-ti` suffix.

### LLM extraction asks for

- `customerCompany` (string)
- `address` (string)
- `proposalDate` (ISO date)
- `projectType` (string — defaults to `"Suite Renovation"` for tenant improvements)
- `overheadPct` (number from PDF, e.g. 8)
- `profitPct` (number from PDF, e.g. 20)
- `paymentTerms` (string verbatim from PDF)
- `exclusions` (string verbatim from PDF)
- `disclaimers[]` (any "Note:" paragraphs that aren't line items or exclusions, e.g. the kiln-dried wood warning)
- `lineItems[]`:
  - `description` (string)
  - `quantity` (number, default 1)
  - `unit` (string from `["ea", "ls", "sf", "lf", "hr"]`)
  - `unitPrice` (number)
  - `tradeTag` (one of `trades.ts` IDs, LLM's best guess)
  - `isAlternate` (boolean — true for items under "Option:" or "if we are unable to..." conditional sections)
- `statedTotal` (number — the headline total on the PDF)

### Reconciliation

```
subtotal       = sum(lineItems where !isAlternate, qty * unitPrice)
overhead       = subtotal * overheadPct/100
profit         = subtotal * profitPct/100
computedTotal  = subtotal + overhead + profit
```

If `abs(computedTotal - statedTotal) > 1.00`, set `reviewFlags.totalMismatch: true`.

If any `tradeTag` is not in `trades.ts`, set `reviewFlags.unknownTrades: [...]`.

### Output JSON schema

```ts
{
  source: { pdfPath, extractedAt, model },
  quote: {
    slug, title, address, projectType,
    proposalDate, customerCompany,
    overheadPct, profitPct,
    paymentTerms, exclusions, disclaimers,
  },
  lineItems: [
    { description, quantity, unit, unitPrice, tradeTag, isAlternate },
    ...
  ],
  reviewFlags: {
    totalMismatch: boolean,
    statedTotal: number,
    computedTotal: number,
    unknownTrades: string[],
  }
}
```

## Seed Script

`scripts/import-cpp-proposal/seed.ts <json-path> [--force]`

### Behavior

1. Read JSON.
2. **Bail if `reviewFlags.totalMismatch === true` and no `--force`** (operator must explicitly override after review).
3. Find-or-create `Company` by `customerCompany` name (case-insensitive). Type `customer`. Link as `QuoteCompany.role: "tenant"`.
4. Group line items by `tradeTag` into `LineItemSection` records. Section title is the trade label from `trades.ts` (e.g., `tradeTag: "carpentry"` → section title `"Framing & Carpentry"` — see Trade Tag → Section Title mapping below).
5. Within each section, preserve the order the items appeared in the PDF.
6. Route `isAlternate: true` items into the `Quote.notes` field as a formatted "Options/Alternates" block. Append disclaimers below.
7. Create the `Quote` with all the fields. `cppBranded: true`, `status: "sent"`, `sentAt: proposalDate`, `materialMarkupPct: 0`, `paddingPct: 0`.
8. Idempotent: `prisma.quote.deleteMany({ where: { slug } })` before create.
9. Print created quote ID + view URL.

### Trade Tag → Section Title mapping

The LLM returns a `tradeTag` from the `trades.ts` enum. The seed script translates the tag into a friendlier section title for display. Multiple tags may collapse into one section title:

| Trade Tag(s) | Section Title |
|---|---|
| `demolition` | Demo & Disposal |
| `carpentry` | Framing & Carpentry |
| `electrical` | Electrical |
| `plumbing` | Plumbing |
| `hvac` | HVAC |
| `drywall` | Drywall |
| `painting` | Painting |
| `flooring` | Flooring |
| `general_labor`, `other` | Equipment & Inspections |
| (any unmapped tag) | (use trade label from `trades.ts`) |

## Defaults & Assumptions

- `cppBranded: true` (always — these are CPP archives)
- `materialMarkupPct: 0` (CPP didn't itemize material markup separately)
- `paddingPct: 0`
- Per line item: `isMaterial: false`, `vendorCost: null`
- `status: "sent"`, `sentAt: proposalDate`
- `projectType: "Suite Renovation"` if not specified (matches existing milestone template)
- `Quote.title`: `"<address> — <projectType label>"` (e.g., `"2187 Market St — Tenant Improvement"`)

## File Layout

```
scripts/import-cpp-proposal/
├── extract.ts              # PDF → JSON
├── seed.ts                 # JSON → Postgres
├── prompts.ts              # extraction system prompt + schema definition
└── types.ts                # TypeScript types for the JSON intermediate

outputs/cpp-imports/
└── <slug>.json             # one per imported proposal, gitignored
```

`outputs/cpp-imports/` is added to `.gitignore` (PDFs may contain customer info we don't want in the repo).

## Risks & Open Questions

1. **PDF format drift**: Some proposals may have slightly different layouts. Spec says "mostly same template, occasional variant." If the LLM mis-extracts a variant, the JSON review step catches it; the operator hand-fixes the JSON and proceeds. We accept this — it's why the two-step exists.

2. **Total mismatch volume**: If most PDFs trip `totalMismatch`, the workflow becomes painful. Mitigation: the structured-output prompt should be specific about the math (subtotal × OH%, subtotal × Profit%). If we still see >20% mismatch rate after the first 5 imports, revisit the prompt.

3. **Customer name aliases**: "Hallmark Investments & Management" vs "Hallmark Investments LLC" would create two Company records. We'll find-by-exact-name only — if the operator notices a duplicate, they edit the JSON before seeding.

4. **Per-line item descriptions**: 2187 Market combined "Remove and replace office lighting 10 ea (14')" into a single line. The LLM may interpret that as qty=10 × $216 vs qty=1 × $2,160. Both are correct totals; the JSON review step lets the operator pick the rendering they want.

5. **License number**: Hard-coded display value `"NV License #0092515"` is the same for both Building NV and CPP brands. Not a field — no extraction needed. Already in `proposals/[slug]/page.tsx`.

## Success Criteria

- Importing 2187 Market St again via this pipeline produces a Quote that renders identically to the existing manually-seeded one.
- Operator can import a new CPP proposal in <2 minutes (extract + JSON review + seed) given a clean PDF.
- Total mismatch rate after first 5 imports is <20%; if higher, prompt is iterated.
