# Per-Trade Internal Cost Commitments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every quote line item gets a trade assignment and internal cost commitment, calculated by a deterministic pricing engine backed by a database rate table. Margin is visible per trade in the QuoteEditor and persists to the project after contract signing.

**Architecture:** New `TradeRate` model holds pricing inputs. AI classifies scope into structured line items with trade/quantity/unit. A deterministic pricing engine (`pricing-engine.ts`) looks up rates and calculates costs. The QuoteEditor shows internal cost columns alongside customer-facing pricing. Contract conversion auto-populates `targetCostAmount` from committed costs.

**Tech Stack:** Next.js 16, Prisma, TypeScript, Tailwind CSS, Anthropic SDK (Claude claude-sonnet-4-6)

**Spec:** `docs/superpowers/specs/2026-04-17-per-trade-cost-commitments-design.md`

---

### Task 1: Schema Migration — TradeRate model + LineItem fields

**Files:**
- Modify: `prisma/schema.prisma`

Add the `TradeRate` model and new fields on `LineItem`.

- [ ] **Step 1: Add new fields to LineItem model**

In `prisma/schema.prisma`, find the `LineItem` model (around line 88). Add these fields after the existing `trade` field (line 102):

```prisma
  estimatedHours  Float?
  hourlyRate      Float?
  materialCost    Float?
  costType        String?   // "self_performed" | "subcontracted"
```

- [ ] **Step 2: Add TradeRate model**

Add this model at the end of the schema file, before any closing comments:

```prisma
// ─── Trade Rate Table ─────────────────────────────────────────────────────────

model TradeRate {
  id                  String    @id @default(cuid())
  trade               String    // from trades.ts classification
  costType            String    // "self_performed" | "subcontracted"

  // Self-performed rates
  laborRatePerHour    Float?    // $/hr for this trade
  defaultCrewSize     Int?      // typical crew size
  productivityRate    Float?    // units per labor-hour (e.g., SF/hr for painting)
  productivityUnit    String?   // unit type: "sf", "lf", "ea", "unit"
  materialCostPerUnit Float?    // material cost per unit of work

  // Subcontracted rates
  typicalCostPerUnit  Float?    // supply+install $/unit for sub bids

  // Metadata
  effectiveDate       DateTime  @default(now())
  source              String    // "CPP actuals", "sub bid average", "initial estimate"
  notes               String?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([trade, costType])
}
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name add-trade-rates-and-line-item-cost-fields
```

- [ ] **Step 4: Stage generated Prisma client**

```bash
git add prisma/ src/generated/
git commit -m "feat: add TradeRate model and LineItem cost fields"
```

---

### Task 2: Seed Trade Rates

**Files:**
- Create: `prisma/seed-trade-rates.ts`

Seed the `TradeRate` table with initial rates derived from existing market data in `claude.ts`. These are the starting point — rates get refined as actuals come in.

- [ ] **Step 1: Create seed script**

Create `prisma/seed-trade-rates.ts`:

```typescript
// prisma/seed-trade-rates.ts
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const TRADE_RATES = [
  // ─── Self-performed trades ──────────────────────────────────────────
  {
    trade: 'painting',
    costType: 'self_performed',
    laborRatePerHour: 32,
    defaultCrewSize: 2,
    productivityRate: 200,    // SF per labor-hour
    productivityUnit: 'sf',
    materialCostPerUnit: 0.65, // $/SF
    source: 'initial estimate',
    notes: 'Interior commercial. Residential may differ.',
  },
  {
    trade: 'carpentry',
    costType: 'self_performed',
    laborRatePerHour: 35,
    defaultCrewSize: 2,
    productivityRate: 10,     // SF per labor-hour (framing)
    productivityUnit: 'sf',
    materialCostPerUnit: 13,  // $/SF lumber
    source: 'initial estimate',
    notes: 'Framing rate. Finish carpentry will differ.',
  },
  {
    trade: 'demolition',
    costType: 'self_performed',
    laborRatePerHour: 28,
    defaultCrewSize: 2,
    productivityRate: null,
    productivityUnit: null,
    materialCostPerUnit: null,
    source: 'initial estimate',
    notes: 'Typically priced as lump sum. Rate for hourly estimation.',
  },
  {
    trade: 'general_labor',
    costType: 'self_performed',
    laborRatePerHour: 28,
    defaultCrewSize: 2,
    productivityRate: null,
    productivityUnit: null,
    materialCostPerUnit: null,
    source: 'initial estimate',
    notes: 'Cleanup, site prep, misc labor.',
  },
  // ─── Subcontracted trades ───────────────────────────────────────────
  {
    trade: 'electrical',
    costType: 'subcontracted',
    typicalCostPerUnit: 8,    // $/SF
    source: 'initial estimate',
    notes: 'Rough + finish. Commercial TI range $6-10/SF.',
  },
  {
    trade: 'plumbing',
    costType: 'subcontracted',
    typicalCostPerUnit: 10,   // $/SF
    source: 'initial estimate',
    notes: 'Rough + finish. Range $8-12/SF.',
  },
  {
    trade: 'hvac',
    costType: 'subcontracted',
    typicalCostPerUnit: 5.5,  // $/SF
    source: 'initial estimate',
    notes: 'Forced air single zone. Range $4-7/SF.',
  },
  {
    trade: 'flooring',
    costType: 'subcontracted',
    typicalCostPerUnit: 7,    // $/SF
    source: 'initial estimate',
    notes: 'LVT/LVP installed. Range $6-8/SF.',
  },
  {
    trade: 'drywall',
    costType: 'subcontracted',
    typicalCostPerUnit: 5,    // $/SF
    source: 'initial estimate',
    notes: 'Hang + tape + texture. Range $4-6/SF.',
  },
  {
    trade: 'insulation',
    costType: 'subcontracted',
    typicalCostPerUnit: 4,    // $/SF
    source: 'initial estimate',
    notes: 'Batts + vapor barrier. Range $3-5/SF.',
  },
  {
    trade: 'concrete',
    costType: 'subcontracted',
    typicalCostPerUnit: 14,   // $/SF
    source: 'initial estimate',
    notes: '24" stem wall w/ crawlspace. Range $12-16/SF.',
  },
  {
    trade: 'roofing',
    costType: 'subcontracted',
    typicalCostPerUnit: 5.5,  // $/SF
    source: 'initial estimate',
    notes: 'Comp shingle. Range $4-7/SF.',
  },
];

async function main() {
  for (const rate of TRADE_RATES) {
    await prisma.tradeRate.upsert({
      where: {
        trade_costType: { trade: rate.trade, costType: rate.costType },
      },
      update: { ...rate },
      create: { ...rate },
    });
  }
  console.log(`Seeded ${TRADE_RATES.length} trade rates.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Run the seed script**

```bash
npx tsx prisma/seed-trade-rates.ts
```

Expected: `Seeded 12 trade rates.`

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-trade-rates.ts
git commit -m "feat: seed trade rate table with initial estimates"
```

---

### Task 3: Trade Rate API

**Files:**
- Create: `src/app/api/trade-rates/route.ts`

Simple CRUD so rates can be read by the pricing engine and managed later.

- [ ] **Step 1: Create `src/app/api/trade-rates/route.ts`**

```typescript
// src/app/api/trade-rates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rates = await prisma.tradeRate.findMany({
    orderBy: [{ trade: 'asc' }, { costType: 'asc' }],
  });
  return NextResponse.json(rates);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.trade || !body.costType) {
    return NextResponse.json({ error: 'trade and costType required' }, { status: 400 });
  }

  const rate = await prisma.tradeRate.upsert({
    where: {
      trade_costType: { trade: body.trade, costType: body.costType },
    },
    update: {
      laborRatePerHour: body.laborRatePerHour ?? null,
      defaultCrewSize: body.defaultCrewSize ?? null,
      productivityRate: body.productivityRate ?? null,
      productivityUnit: body.productivityUnit ?? null,
      materialCostPerUnit: body.materialCostPerUnit ?? null,
      typicalCostPerUnit: body.typicalCostPerUnit ?? null,
      source: body.source ?? 'manual',
      notes: body.notes ?? null,
      effectiveDate: new Date(),
    },
    create: {
      trade: body.trade,
      costType: body.costType,
      laborRatePerHour: body.laborRatePerHour ?? null,
      defaultCrewSize: body.defaultCrewSize ?? null,
      productivityRate: body.productivityRate ?? null,
      productivityUnit: body.productivityUnit ?? null,
      materialCostPerUnit: body.materialCostPerUnit ?? null,
      typicalCostPerUnit: body.typicalCostPerUnit ?? null,
      source: body.source ?? 'manual',
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(rate);
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trade-rates/route.ts
git commit -m "feat: add trade rate CRUD API"
```

---

### Task 4: In-House Trade Classification

**Files:**
- Modify: `src/lib/trades.ts`

Add a function that returns whether a trade is self-performed or subcontracted, extracting the logic currently hardcoded in `claude.ts`.

- [ ] **Step 1: Add costType classification to trades.ts**

Add the following after the existing `TradeRecommendation` interface at the end of `src/lib/trades.ts`:

```typescript
/**
 * Trades currently self-performed by Building NV.
 * Used to auto-set costType on line items.
 */
const SELF_PERFORMED_TRADES: Set<TradeId> = new Set([
  'carpentry',
  'painting',
  'general_labor',
  'demolition',
]);

export function getDefaultCostType(trade: TradeId): 'self_performed' | 'subcontracted' {
  return SELF_PERFORMED_TRADES.has(trade) ? 'self_performed' : 'subcontracted';
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/trades.ts
git commit -m "feat: add costType classification for self-performed vs subcontracted trades"
```

---

### Task 5: Deterministic Pricing Engine

**Files:**
- Create: `src/lib/pricing-engine.ts`

The core engine: takes line items with trade/quantity/unit, looks up rates from the DB, calculates internal costs.

- [ ] **Step 1: Create `src/lib/pricing-engine.ts`**

```typescript
// src/lib/pricing-engine.ts
import { prisma } from '@/lib/prisma';
import type { TradeId } from '@/lib/trades';
import { getDefaultCostType } from '@/lib/trades';

export interface CostableLineItem {
  trade: string | null;
  costType: string | null;
  quantity: number;
  unit: string;
  // Existing cost fields (may already be set manually)
  vendorCost: number | null;
  estimatedHours: number | null;
  hourlyRate: number | null;
  materialCost: number | null;
}

export interface CostResult {
  vendorCost: number | null;
  estimatedHours: number | null;
  hourlyRate: number | null;
  materialCost: number | null;
  costType: string;
  needsRate: boolean; // true if no rate found in table
}

/**
 * Calculate internal cost for a single line item from the trade rate table.
 * Returns null fields + needsRate=true if no rate exists for the trade.
 */
export async function calculateItemCost(
  item: CostableLineItem,
  rateCache?: Map<string, Awaited<ReturnType<typeof getRate>>>
): Promise<CostResult> {
  const trade = item.trade as TradeId | null;
  if (!trade) {
    return {
      vendorCost: null,
      estimatedHours: null,
      hourlyRate: null,
      materialCost: null,
      costType: item.costType ?? 'subcontracted',
      needsRate: true,
    };
  }

  const costType = item.costType ?? getDefaultCostType(trade);
  const cacheKey = `${trade}:${costType}`;
  let rate = rateCache?.get(cacheKey);
  if (rate === undefined) {
    rate = await getRate(trade, costType);
    rateCache?.set(cacheKey, rate);
  }

  if (!rate) {
    return {
      vendorCost: null,
      estimatedHours: null,
      hourlyRate: null,
      materialCost: null,
      costType,
      needsRate: true,
    };
  }

  if (costType === 'self_performed') {
    const hourlyRate = rate.laborRatePerHour ?? 0;
    const crewSize = rate.defaultCrewSize ?? 1;
    let estimatedHours: number | null = null;
    let materialCost: number | null = null;

    if (rate.productivityRate && rate.productivityRate > 0) {
      // total labor-hours = (quantity / units-per-hour) * crew size
      estimatedHours = round2((item.quantity / rate.productivityRate) * crewSize);
    }

    if (rate.materialCostPerUnit != null) {
      materialCost = round2(item.quantity * rate.materialCostPerUnit);
    }

    const laborCost = estimatedHours != null ? round2(estimatedHours * hourlyRate) : 0;
    const vendorCost = round2(laborCost + (materialCost ?? 0));

    return {
      vendorCost,
      estimatedHours,
      hourlyRate,
      materialCost,
      costType,
      needsRate: false,
    };
  }

  // Subcontracted
  if (rate.typicalCostPerUnit != null) {
    return {
      vendorCost: round2(item.quantity * rate.typicalCostPerUnit),
      estimatedHours: null,
      hourlyRate: null,
      materialCost: null,
      costType,
      needsRate: false,
    };
  }

  return {
    vendorCost: null,
    estimatedHours: null,
    hourlyRate: null,
    materialCost: null,
    costType,
    needsRate: true,
  };
}

/**
 * Calculate costs for all line items in a quote's sections.
 * Returns the sections with cost fields populated.
 */
export async function calculateQuoteCosts<T extends { trade: string | null; costType: string | null; quantity: number; unit: string }>(
  items: T[]
): Promise<(T & CostResult)[]> {
  const rateCache = new Map<string, Awaited<ReturnType<typeof getRate>>>();
  const results: (T & CostResult)[] = [];

  for (const item of items) {
    const costItem: CostableLineItem = {
      trade: item.trade,
      costType: item.costType,
      quantity: item.quantity,
      unit: item.unit,
      vendorCost: null,
      estimatedHours: null,
      hourlyRate: null,
      materialCost: null,
    };
    const result = await calculateItemCost(costItem, rateCache);
    results.push({ ...item, ...result });
  }

  return results;
}

async function getRate(trade: string, costType: string) {
  return prisma.tradeRate.findUnique({
    where: { trade_costType: { trade, costType } },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface TradeMarginSummary {
  trade: string;
  customerTotal: number;
  internalCost: number;
  marginDollars: number;
  marginPct: number;
  needsRate: boolean;
}

/**
 * Calculate margin summary grouped by trade.
 */
export function calculateTradeMargins(
  items: Array<{
    trade: string | null;
    unitPrice: number;
    quantity: number;
    vendorCost: number | null;
  }>
): TradeMarginSummary[] {
  const byTrade = new Map<string, { customerTotal: number; internalCost: number; needsRate: boolean }>();

  for (const item of items) {
    const trade = item.trade ?? 'other';
    const existing = byTrade.get(trade) ?? { customerTotal: 0, internalCost: 0, needsRate: false };
    existing.customerTotal += item.unitPrice * item.quantity;
    existing.internalCost += item.vendorCost ?? 0;
    if (item.vendorCost == null) existing.needsRate = true;
    byTrade.set(trade, existing);
  }

  const summaries: TradeMarginSummary[] = [];
  for (const [trade, data] of byTrade) {
    const marginDollars = round2(data.customerTotal - data.internalCost);
    const marginPct = data.customerTotal > 0 ? round2((marginDollars / data.customerTotal) * 100) : 0;
    summaries.push({
      trade,
      customerTotal: round2(data.customerTotal),
      internalCost: round2(data.internalCost),
      marginDollars,
      marginPct,
      needsRate: data.needsRate,
    });
  }

  return summaries.sort((a, b) => a.trade.localeCompare(b.trade));
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing-engine.ts
git commit -m "feat: add deterministic pricing engine backed by trade rate table"
```

---

### Task 6: Quote API — Persist Trade and Cost Fields

**Files:**
- Modify: `src/app/api/quotes/route.ts:67-86`
- Modify: `src/app/api/quotes/[id]/route.ts:60-76`

Both the POST (create) and PUT (update) routes need to save trade/cost fields on line items and sections.

- [ ] **Step 1: Update POST route line item creation**

In `src/app/api/quotes/route.ts`, find the `lineItem.create` call inside the sections loop (around lines 75-86). Replace the `data` object:

```typescript
        await prisma.lineItem.create({
          data: {
            sectionId: section.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            isMaterial: item.isMaterial ?? false,
            position: li,
            trade: item.trade ?? null,
            vendorCost: item.vendorCost ?? null,
            estimatedHours: item.estimatedHours ?? null,
            hourlyRate: item.hourlyRate ?? null,
            materialCost: item.materialCost ?? null,
            costType: item.costType ?? null,
          },
        });
```

Also update the `lineItemSection.create` call (around line 70-72) to include trade:

```typescript
      const section = await prisma.lineItemSection.create({
        data: { quoteId: quote.id, title: sec.title, position: si, trade: sec.trade ?? null },
      });
```

- [ ] **Step 2: Update PUT route line item creation**

In `src/app/api/quotes/[id]/route.ts`, find the `lineItemSection.create` and `lineItem.create` calls inside the `$transaction` (around lines 60-76). Apply the same changes:

Section create (around line 61):
```typescript
          const section = await tx.lineItemSection.create({
            data: { quoteId: id, title: sec.title, position: si, trade: sec.trade ?? null },
          });
```

Line item create (around lines 65-75):
```typescript
            await tx.lineItem.create({
              data: {
                sectionId: section.id,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                isMaterial: item.isMaterial ?? false,
                position: li,
                trade: item.trade ?? null,
                vendorCost: item.vendorCost ?? null,
                estimatedHours: item.estimatedHours ?? null,
                hourlyRate: item.hourlyRate ?? null,
                materialCost: item.materialCost ?? null,
                costType: item.costType ?? null,
              },
            });
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/quotes/route.ts" "src/app/api/quotes/[id]/route.ts"
git commit -m "feat: persist trade and cost fields on line item save"
```

---

### Task 7: AI Generation — Trade Assignment

**Files:**
- Modify: `src/lib/claude.ts`

Update the AI to assign `trade` and `costType` to each line item and section. Remove market rate pricing from the prompt — the AI classifies, the engine prices.

- [ ] **Step 1: Update GeneratedLineItem type**

In `src/lib/claude.ts`, add `trade` and `costType` to the `GeneratedLineItem` interface (lines 7-13):

```typescript
export interface GeneratedLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
  trade: string | null;
  costType: string | null;
}
```

- [ ] **Step 2: Update GeneratedSection type**

Add `trade` to `GeneratedSection` (lines 15-18):

```typescript
export interface GeneratedSection {
  title: string;
  trade: string | null;
  items: GeneratedLineItem[];
}
```

- [ ] **Step 3: Update STREAM_SYSTEM_PROMPT**

Replace the `STREAM_SYSTEM_PROMPT` (lines 81-97) with a version that instructs the AI to assign trades and removes pricing from AI responsibility. The AI should still output `unitPrice` as a placeholder (0) — the pricing engine fills in actuals:

```typescript
const STREAM_SYSTEM_PROMPT = `${BASE_CONTEXT}

Your job is to parse a scope of work (which may be a voice transcript, an RFP, typed notes, or contractor shorthand) and output structured data as newline-delimited JSON (NDJSON). Parse intent, not grammar — voice transcripts will have incomplete sentences and measurements embedded in prose.

For each line item, assign a trade from this list: general_labor, carpentry, electrical, plumbing, hvac, painting, concrete, roofing, flooring, drywall, insulation, demolition, excavation, landscaping, fire_protection, low_voltage, glazing, masonry, welding, other.

Self-performed trades (costType: "self_performed"): carpentry, painting, general_labor, demolition.
All other trades: costType: "subcontracted".

For each section, set "trade" to the dominant trade in that section (the trade that applies to most items). If items span multiple trades, use the most common one.

Output rules:
1. First line: an "extracted" event with whatever you can identify from the input (contact name, job site address, project type) and a "gaps" array listing required fields you could NOT extract. Use these gap key names: "contact_name", "address", "project_type".
2. Then output one "section" event per section of the quote.
3. Final line: a "done" event.
4. Each line must be valid JSON. No markdown, no code blocks, no prose — only NDJSON.
5. Materials (supply-only items) have isMaterial: true. Combined supply+install are isMaterial: false.
6. Keep descriptions tight: "Remove 10 ea. fluorescent lights and install LED lights per code"
7. Set unitPrice to 0 for all items — pricing is handled by a separate engine.
8. Focus on accurate quantities, units, trade assignment, and scope description.
9. If you genuinely cannot produce even one line item (e.g., input is gibberish), output a single section with a placeholder item and note the gap.

Example output (3 lines total):
{"type":"extracted","contactName":"John Smith","address":"123 Main St, Reno NV","projectType":"Office Buildout","gaps":[]}
{"type":"section","data":{"title":"Demolition","trade":"demolition","items":[{"description":"Demo existing partition walls","quantity":1,"unit":"ls","unitPrice":0,"isMaterial":false,"trade":"demolition","costType":"self_performed"}]}}
{"type":"done"}`;
```

- [ ] **Step 4: Update LEGACY_SYSTEM_PROMPT similarly**

Replace `LEGACY_SYSTEM_PROMPT` (lines 156-170) to include trade assignment and remove pricing:

```typescript
const LEGACY_SYSTEM_PROMPT = `${BASE_CONTEXT}

For each line item, assign a trade from this list: general_labor, carpentry, electrical, plumbing, hvac, painting, concrete, roofing, flooring, drywall, insulation, demolition, excavation, landscaping, fire_protection, low_voltage, glazing, masonry, welding, other.

Self-performed trades (costType: "self_performed"): carpentry, painting, general_labor, demolition.
All other trades: costType: "subcontracted".

For each section, set "trade" to the dominant trade in that section.

Output rules:
1. If you have enough information to classify ALL items, return JSON with sections and empty questions array.
2. If you are MISSING specific data needed to scope an item accurately, return the questions array with 1-3 specific questions. Do NOT guess.
3. Organize line items into logical sections.
4. Materials (supply-only items) should have isMaterial: true.
5. Combined supply+install items are isMaterial: false.
6. Keep descriptions tight and professional.
7. Set unitPrice to 0 — pricing is handled separately.

Return ONLY valid JSON:
{
  "sections": [{"title": "...", "trade": "demolition", "items": [{"description": "...", "quantity": 1, "unit": "ls", "unitPrice": 0, "isMaterial": false, "trade": "demolition", "costType": "self_performed"}]}],
  "questions": []
}`;
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: AI assigns trade and costType, pricing moved to deterministic engine"
```

---

### Task 8: Quote Generation API — Run Pricing Engine After AI

**Files:**
- Modify: `src/app/api/quotes/generate/route.ts`

The current route streams NDJSON events from the AI generator directly to the client. We intercept `section` events, run the pricing engine on each section's items, and emit the enriched section.

- [ ] **Step 1: Update the generate route**

Replace `src/app/api/quotes/generate/route.ts` with:

```typescript
import { NextRequest } from 'next/server';
import { generateQuoteStream } from '@/lib/claude';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { calculateItemCost } from '@/lib/pricing-engine';
import { getDefaultCostType } from '@/lib/trades';
import type { TradeId } from '@/lib/trades';
import type { StreamEvent } from '@/lib/claude';

async function enrichSectionEvent(event: StreamEvent): Promise<StreamEvent> {
  if (event.type !== 'section') return event;

  const section = event.data;
  const rateCache = new Map();
  const enrichedItems = [];

  for (const item of section.items) {
    const trade = item.trade as TradeId | null;
    const costType = item.costType ?? (trade ? getDefaultCostType(trade) : null);
    const costResult = await calculateItemCost(
      {
        trade: item.trade ?? null,
        costType,
        quantity: item.quantity,
        unit: item.unit,
        vendorCost: null,
        estimatedHours: null,
        hourlyRate: null,
        materialCost: null,
      },
      rateCache
    );
    enrichedItems.push({
      ...item,
      costType: costResult.costType,
      vendorCost: costResult.vendorCost,
      estimatedHours: costResult.estimatedHours,
      hourlyRate: costResult.hourlyRate,
      materialCost: costResult.materialCost,
    });
  }

  return { type: 'section', data: { ...section, items: enrichedItems } };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scopeText } = await req.json();
  if (!scopeText) {
    return NextResponse.json({ error: 'scopeText is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateQuoteStream(scopeText)) {
          const enriched = await enrichSectionEvent(event);
          controller.enqueue(encoder.encode(JSON.stringify(enriched) + '\n'));
        }
      } catch (err) {
        console.error('Stream error:', err);
        const message = err instanceof Error ? err.message : 'Quote generation failed';
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/quotes/generate/route.ts"
git commit -m "feat: run pricing engine on AI-generated sections before streaming"
```

---

### Task 9: QuoteEditor UI — Internal Cost Columns

**Files:**
- Modify: `src/components/internal/QuoteEditor.tsx`

Add trade dropdowns, internal cost fields, and margin display to the QuoteEditor. This is the largest UI change.

- [ ] **Step 1: Update interfaces**

In `QuoteEditor.tsx`, update the `LineItem` interface (lines 56-63) to include cost fields:

```typescript
interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
  trade: string | null;
  costType: string | null;
  vendorCost: number | null;
  estimatedHours: number | null;
  hourlyRate: number | null;
  materialCost: number | null;
}
```

Update the `Section` interface (lines 65-69):

```typescript
interface Section {
  id?: string;
  title: string;
  trade: string | null;
  items: LineItem[];
}
```

- [ ] **Step 2: Add TRADES import and cost toggle state**

At the top of the file, add:
```typescript
import { TRADES, getTradeLabel, getDefaultCostType } from "@/lib/trades";
import type { TradeId } from "@/lib/trades";
```

Inside the component, after the existing `useState` declarations (around line 126), add:
```typescript
  const [showCosts, setShowCosts] = useState(true);
```

- [ ] **Step 3: Update addItem to include cost fields**

In the `addItem` function (around line 150-159), update the new item to include cost defaults:

```typescript
  const addItem = (si: number) => {
    const sectionTrade = quote.sections[si]?.trade ?? null;
    setQuote((q) => ({
      ...q,
      sections: q.sections.map((s, sIdx) =>
        sIdx !== si ? s : {
          ...s,
          items: [...s.items, {
            description: "",
            quantity: 1,
            unit: defaultUnitForSection(s.title),
            unitPrice: 0,
            isMaterial: false,
            trade: sectionTrade,
            costType: sectionTrade ? getDefaultCostType(sectionTrade as TradeId) : null,
            vendorCost: null,
            estimatedHours: null,
            hourlyRate: null,
            materialCost: null,
          }],
        }
      ),
    }));
  };
```

- [ ] **Step 4: Add section trade dropdown**

In the section header bar (around line 349-389), after the section title input, add a trade dropdown:

```tsx
                <select
                  value={sec.trade ?? ""}
                  onChange={(e) => {
                    const newTrade = e.target.value || null;
                    setQuote((q) => ({
                      ...q,
                      sections: q.sections.map((s, i) => i === si ? { ...s, trade: newTrade } : s),
                    }));
                  }}
                  className="bg-surface border border-border rounded px-1 py-0.5 text-xs text-text-muted focus:outline-none focus:border-accent w-28 shrink-0"
                >
                  <option value="">No trade</option>
                  {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
```

- [ ] **Step 5: Add cost toggle button**

In the header area (around line 300-330, after the button group), add a toggle:

```tsx
            <button
              onClick={() => setShowCosts((v) => !v)}
              className={`border rounded-sm px-3 py-2 text-sm transition-colors ${
                showCosts ? 'border-accent text-accent' : 'border-border text-text-muted hover:border-text-muted'
              }`}
            >
              {showCosts ? 'Hide Costs' : 'Show Costs'}
            </button>
```

- [ ] **Step 6: Update column headers**

Replace the column headers grid (lines 334-341) to conditionally show cost columns:

```tsx
        <div className={`grid gap-2 px-3 mb-1 text-xs text-text-muted uppercase tracking-widest ${showCosts ? 'grid-cols-[2fr_auto_auto_1fr_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-12'}`}>
          <span className={showCosts ? '' : 'col-span-5'}>Description</span>
          {showCosts && <span className="text-center w-20">Trade</span>}
          <span className={`text-right ${showCosts ? '' : 'col-span-1'}`}>Qty</span>
          <span className={showCosts ? '' : 'col-span-1'}>Unit</span>
          <span className={`text-right ${showCosts ? '' : 'col-span-2'}`}>Unit Price</span>
          <span className={`text-right ${showCosts ? '' : 'col-span-2'}`}>Total</span>
          {showCosts && <span className="text-right">Int. Cost</span>}
          {showCosts && <span className="text-right">Margin</span>}
          <span className={showCosts ? '' : 'col-span-1'} />
        </div>
```

- [ ] **Step 7: Update line item rows**

In the line item rendering (around lines 393-426), update the grid to include trade select and cost display when `showCosts` is true:

After the unitPrice input and total display, add (inside the grid row):

```tsx
                        {showCosts && (
                          <div className="text-right text-sm text-text-muted tabular-nums">
                            {item.vendorCost != null
                              ? `$${item.vendorCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : <span className="text-amber-400 text-xs">needs rate</span>
                            }
                          </div>
                        )}
                        {showCosts && (
                          <div className="text-right text-sm tabular-nums">
                            {item.vendorCost != null ? (() => {
                              const customerTotal = item.quantity * item.unitPrice;
                              const margin = customerTotal - item.vendorCost;
                              const marginPct = customerTotal > 0 ? (margin / customerTotal * 100).toFixed(0) : '—';
                              return (
                                <span className={margin >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {marginPct}%
                                </span>
                              );
                            })() : '—'}
                          </div>
                        )}
```

Also add a trade select as a small dropdown per line item when showCosts is true, positioned after the description field:

```tsx
                        {showCosts && (
                          <div className="w-20">
                            <select
                              value={item.trade ?? ""}
                              onChange={(e) => updateItem(si, ii, "trade", e.target.value || null)}
                              className="bg-surface border border-border rounded px-0.5 py-0.5 text-[10px] text-text-muted focus:outline-none focus:border-accent w-full"
                            >
                              <option value="">—</option>
                              {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </div>
                        )}
```

Update the grid class on the row div to match the header:

```tsx
                      <div key={ii} className={`grid gap-2 px-3 py-2 items-center group ${showCosts ? 'grid-cols-[2fr_auto_auto_1fr_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-12'}`}>
```

- [ ] **Step 8: Add section cost subtotals**

In the section header, after the existing section subtotal (around line 367-368), add internal cost subtotal when showCosts is true:

```tsx
                {showCosts && (() => {
                  const sectionInternalCost = sec.items.reduce((sum, item) => sum + (item.vendorCost ?? 0), 0);
                  const sectionMargin = sectionSubtotal - sectionInternalCost;
                  const marginPct = sectionSubtotal > 0 ? (sectionMargin / sectionSubtotal * 100).toFixed(0) : '—';
                  return (
                    <span className={`text-xs tabular-nums shrink-0 ${sectionMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {marginPct}% margin
                    </span>
                  );
                })()}
```

- [ ] **Step 9: Add Trade Margin Summary to sidebar**

In the summary panel (around line 526, after the Total display), add a trade margin summary:

```tsx
          {showCosts && (() => {
            const allItemsWithCosts = quote.sections.flatMap((s) =>
              s.items.map((item) => ({
                trade: item.trade,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                vendorCost: item.vendorCost,
              }))
            );
            const totalInternalCost = allItemsWithCosts.reduce((sum, i) => sum + (i.vendorCost ?? 0), 0);
            const totalMargin = totals.subtotal - totalInternalCost;
            const totalMarginPct = totals.subtotal > 0 ? (totalMargin / totals.subtotal * 100).toFixed(1) : '—';

            // Group by trade
            const byTrade = new Map<string, { customer: number; internal: number }>();
            for (const item of allItemsWithCosts) {
              const trade = item.trade ?? 'other';
              const existing = byTrade.get(trade) ?? { customer: 0, internal: 0 };
              existing.customer += item.unitPrice * item.quantity;
              existing.internal += item.vendorCost ?? 0;
              byTrade.set(trade, existing);
            }

            return (
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-3">
                  Cost &amp; Margin
                </h3>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">Internal Cost</span>
                  <span className="text-text-primary">${totalInternalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-text-muted">Gross Margin</span>
                  <span className={totalMargin >= 0 ? 'text-green-400' : 'text-red-400'}>
                    ${totalMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalMarginPct}%)
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {Array.from(byTrade.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([trade, data]) => {
                      const margin = data.customer - data.internal;
                      const pct = data.customer > 0 ? (margin / data.customer * 100).toFixed(0) : '—';
                      return (
                        <div key={trade} className="flex justify-between text-[10px]">
                          <span className="text-text-muted capitalize">{trade.replace('_', ' ')}</span>
                          <span className={`tabular-nums ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })()}
```

- [ ] **Step 10: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/components/internal/QuoteEditor.tsx
git commit -m "feat: add trade assignment, internal cost, and margin display to QuoteEditor"
```

---

### Task 10: Contract Conversion — Auto-Populate Target Cost

**Files:**
- Modify: `src/app/api/quotes/[id]/convert-to-contract/route.ts:66-84`

When converting a quote to a contract, auto-populate `Project.targetCostAmount` from the sum of all line item `vendorCost` values.

- [ ] **Step 1: Update convert-to-contract route**

In `src/app/api/quotes/[id]/convert-to-contract/route.ts`, after the contract is created (around line 84), add:

```typescript
  // Auto-populate project targetCostAmount from committed internal costs
  if (contract.projectId) {
    const totalInternalCost = quote.sections
      .flatMap((s) => s.items)
      .reduce((sum, item) => sum + (item.vendorCost ?? 0), 0);

    if (totalInternalCost > 0) {
      await prisma.project.update({
        where: { id: contract.projectId },
        data: { targetCostAmount: totalInternalCost },
      });
    }
  }
```

The `items` are already loaded via the `include` on the quote query at line 25.

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/quotes/[id]/convert-to-contract/route.ts"
git commit -m "feat: auto-populate targetCostAmount from committed internal costs at contract conversion"
```

---

### Task 11: Cost Commitment Summary Panel on Project Detail

**Files:**
- Create: `src/components/internal/CostCommitmentSummary.tsx`
- Modify: `src/app/internal/projects/[id]/page.tsx`

Display committed cost by trade on the project detail page, pulled from the source quote's line items.

- [ ] **Step 1: Create CostCommitmentSummary component**

Create `src/components/internal/CostCommitmentSummary.tsx`:

```typescript
// src/components/internal/CostCommitmentSummary.tsx
import { getTradeLabel } from '@/lib/trades';
import type { TradeId } from '@/lib/trades';

interface CostItem {
  trade: string | null;
  unitPrice: number;
  quantity: number;
  vendorCost: number | null;
}

export default function CostCommitmentSummary({ items, contractAmount }: { items: CostItem[]; contractAmount: number | null }) {
  if (items.length === 0) return null;

  const totalInternalCost = items.reduce((sum, i) => sum + (i.vendorCost ?? 0), 0);
  if (totalInternalCost === 0) return null;

  const totalCustomer = contractAmount ?? items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const totalMargin = totalCustomer - totalInternalCost;
  const totalMarginPct = totalCustomer > 0 ? (totalMargin / totalCustomer * 100).toFixed(1) : '—';

  // Group by trade
  const byTrade = new Map<string, { committed: number; customer: number }>();
  for (const item of items) {
    const trade = item.trade ?? 'other';
    const existing = byTrade.get(trade) ?? { committed: 0, customer: 0 };
    existing.committed += item.vendorCost ?? 0;
    existing.customer += item.unitPrice * item.quantity;
    byTrade.set(trade, existing);
  }

  const fmtCurrency = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="border border-border rounded-sm p-6">
      <h2 className="text-text-primary font-semibold mb-4">Cost Commitments</h2>

      <div className="flex gap-6 mb-4 text-sm">
        <div>
          <p className="text-text-muted text-xs">Contract</p>
          <p className="text-text-primary font-medium">{fmtCurrency(totalCustomer)}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Committed Cost</p>
          <p className="text-text-primary font-medium">{fmtCurrency(totalInternalCost)}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Margin</p>
          <p className={`font-medium ${totalMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtCurrency(totalMargin)} ({totalMarginPct}%)
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted text-xs uppercase tracking-widest border-b border-border">
            <th className="text-left py-2">Trade</th>
            <th className="text-right py-2">Committed</th>
            <th className="text-right py-2">Contract</th>
            <th className="text-right py-2">Margin</th>
            <th className="text-right py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(byTrade.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([trade, data]) => {
              const margin = data.customer - data.committed;
              const pct = data.customer > 0 ? (margin / data.customer * 100).toFixed(0) : '—';
              return (
                <tr key={trade} className="border-b border-border/50">
                  <td className="py-2 text-text-primary capitalize">
                    {getTradeLabel(trade as TradeId)}
                  </td>
                  <td className="py-2 text-right text-text-muted tabular-nums">{fmtCurrency(data.committed)}</td>
                  <td className="py-2 text-right text-text-primary tabular-nums">{fmtCurrency(data.customer)}</td>
                  <td className={`py-2 text-right tabular-nums ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtCurrency(margin)}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pct}%
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Add to project detail page**

In `src/app/internal/projects/[id]/page.tsx`, add the import at the top:

```typescript
import CostCommitmentSummary from "@/components/internal/CostCommitmentSummary";
```

Update the Prisma query (around line 23) to include contract → quote → sections → items with cost fields. Add to the `quotes` include:

```typescript
        contracts: {
          include: {
            quote: {
              include: {
                sections: {
                  include: {
                    items: {
                      select: {
                        trade: true,
                        unitPrice: true,
                        quantity: true,
                        vendorCost: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
```

Then in the JSX, after the `FinancialSummarySection` component, add:

```tsx
      {project.contracts?.[0]?.quote && (
        <CostCommitmentSummary
          items={project.contracts[0].quote.sections.flatMap((s) => s.items)}
          contractAmount={project.contractAmount}
        />
      )}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v projectFinancials`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/internal/CostCommitmentSummary.tsx "src/app/internal/projects/[id]/page.tsx"
git commit -m "feat: add cost commitment summary panel to project detail page"
```

---

### Task 12: Manual Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify trade rates seeded**

Navigate to or curl `GET /api/trade-rates`. Verify 12 trade rates are returned with correct fields.

- [ ] **Step 3: Test AI quote generation with trade assignment**

Create a new quote with AI draft. Enter a scope like "8600 SF tenant improvement - demo existing carpet, paint all walls 2 colors, install new LVT flooring, replace all lights with LED". Verify:
- Each section has a `trade` assigned
- Each line item has `trade` and `costType`
- Internal costs are populated from the rate table
- Items with missing rates show "needs rate" indicator

- [ ] **Step 4: Test QuoteEditor cost display**

Open the generated quote in the editor. Verify:
- "Show Costs" toggle works
- Trade dropdowns appear on sections and line items
- Internal cost and margin columns show
- Sidebar shows Cost & Margin summary by trade
- Changing a trade on a line item updates the display

- [ ] **Step 5: Test save and reload**

Save the quote, reload the page. Verify all trade and cost fields persist.

- [ ] **Step 6: Test contract conversion**

If you have a signed quote, convert it to a contract. Verify:
- `targetCostAmount` on the project gets populated
- Cost Commitment Summary panel appears on the project detail page
