# Proposal Timeline & Payment Schedule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-generated project timeline with visual bar chart and milestone-based payment schedule to the client-facing proposal page, with full editability in the QuoteEditor.

**Architecture:** New `QuoteMilestone` model stores per-quote milestones with week numbers, durations, and payment percentages. A `milestone-defaults.ts` module auto-generates milestones from scope sections using trade-duration mappings. The proposal page renders a horizontal bar chart timeline and a payment schedule table with running balance. The QuoteEditor sidebar gets a milestone editor section.

**Tech Stack:** Prisma (PostgreSQL), Next.js 16 App Router, React, Tailwind CSS v4, CSS Grid for the bar chart (no charting library).

**Spec:** `docs/superpowers/specs/2026-03-25-proposal-timeline-and-payment-schedule.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `QuoteMilestone` model, add relation on `Quote` |
| `src/lib/milestone-defaults.ts` | Create | Trade-duration mapping, auto-generation logic, duration-to-weeks parser |
| `src/lib/pricing.ts` | Modify | Add `calculatePaymentSchedule()` helper |
| `src/__tests__/milestone-defaults.test.ts` | Create | Tests for auto-generation logic |
| `src/__tests__/pricing.test.ts` | Modify | Tests for payment schedule calculation |
| `src/app/api/quotes/route.ts` | Modify | Auto-generate milestones on POST |
| `src/app/api/quotes/[id]/route.ts` | Modify | Accept milestones on PUT, include in GET |
| `src/components/internal/QuoteEditor.tsx` | Modify | Add milestone editor section in sidebar |
| `src/app/proposals/[slug]/page.tsx` | Modify | Add bar chart timeline + payment schedule table |

---

### Task 1: Add QuoteMilestone model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the QuoteMilestone model**

Add this after the existing `Quote` model (after line 43):

```prisma
model QuoteMilestone {
  id           String  @id @default(cuid())
  quoteId      String
  quote        Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  name         String
  weekNumber   Int
  duration     String?
  paymentPct   Float?
  paymentLabel String?
  position     Int

  @@unique([quoteId, position])
}
```

Add the relation to the `Quote` model (inside the Quote model block, after the `estimatedStartDate` field on line 42):

```prisma
  milestones        QuoteMilestone[]
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add-quote-milestones`

Expected: Migration creates `QuoteMilestone` table. No data loss.

- [ ] **Step 3: Stage generated client files and commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add QuoteMilestone model to schema"
```

---

### Task 2: Create milestone auto-generation module

**Files:**
- Create: `src/lib/milestone-defaults.ts`
- Create: `src/__tests__/milestone-defaults.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/milestone-defaults.test.ts`:

```typescript
import { generateMilestones, durationToWeeks } from "@/lib/milestone-defaults";

describe("durationToWeeks", () => {
  it("converts '3-5 days' to ~0.7 weeks", () => {
    expect(durationToWeeks("3-5 days")).toBeCloseTo(0.57, 1);
  });

  it("converts '5-7 days' to ~0.86 weeks", () => {
    expect(durationToWeeks("5-7 days")).toBeCloseTo(0.86, 1);
  });

  it("converts '1-2 days' to ~0.21 weeks", () => {
    expect(durationToWeeks("1-2 days")).toBeCloseTo(0.21, 1);
  });

  it("returns 0 for null/undefined", () => {
    expect(durationToWeeks(null)).toBe(0);
    expect(durationToWeeks(undefined)).toBe(0);
  });
});

describe("generateMilestones", () => {
  it("generates milestones for 4 scope sections with default payment split", () => {
    const sections = [
      { title: "Demolition" },
      { title: "Paint & Drywall" },
      { title: "Flooring" },
      { title: "Ceiling" },
    ];

    const milestones = generateMilestones(sections);

    // Should have 6 milestones: signing + 4 phases + final walkthrough
    expect(milestones).toHaveLength(6);

    // First is always contract signed at week 0
    expect(milestones[0]).toMatchObject({
      name: "Contract Signed",
      weekNumber: 0,
      paymentPct: 10,
      paymentLabel: "Contract Signing",
      position: 0,
    });

    // Last is always final walkthrough
    expect(milestones[5]).toMatchObject({
      name: "Final Walkthrough & Punch List",
      paymentPct: 5,
      paymentLabel: "Project Completion",
      position: 5,
    });

    // Payment percentages sum to 100
    const totalPct = milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
    expect(totalPct).toBe(100);

    // Demolition should have known duration
    expect(milestones[1]).toMatchObject({
      name: "Demolition",
      weekNumber: 1,
      duration: "3-5 days",
      paymentPct: 25,
      paymentLabel: "Materials Purchase",
    });
  });

  it("generates milestones for 2 scope sections", () => {
    const sections = [
      { title: "Demolition" },
      { title: "Flooring" },
    ];

    const milestones = generateMilestones(sections);

    // signing + 2 phases + final = 4
    expect(milestones).toHaveLength(4);

    const totalPct = milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
    expect(totalPct).toBe(100);
  });

  it("generates milestones for 6 scope sections", () => {
    const sections = [
      { title: "Demolition" },
      { title: "Framing" },
      { title: "Electrical" },
      { title: "Plumbing" },
      { title: "Drywall" },
      { title: "Paint & Drywall" },
    ];

    const milestones = generateMilestones(sections);

    // signing + 6 phases + final = 8
    expect(milestones).toHaveLength(8);

    const totalPct = milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
    expect(totalPct).toBe(100);
  });

  it("handles unknown trade names with default duration", () => {
    const sections = [{ title: "Custom Millwork" }];

    const milestones = generateMilestones(sections);

    expect(milestones[1].duration).toBe("3-5 days");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/milestone-defaults.test.ts --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/milestone-defaults.ts`:

```typescript
export interface MilestoneInput {
  title: string;
}

export interface GeneratedMilestone {
  name: string;
  weekNumber: number;
  duration: string | null;
  paymentPct: number;
  paymentLabel: string;
  position: number;
}

const TRADE_DURATIONS: Record<string, string> = {
  demolition: "3-5 days",
  "paint & drywall": "5-7 days",
  painting: "5-7 days",
  drywall: "5-7 days",
  flooring: "5-8 days",
  ceiling: "2-3 days",
  electrical: "3-5 days",
  plumbing: "3-5 days",
  framing: "5-7 days",
  "finish carpentry": "3-5 days",
  hvac: "3-5 days",
  roofing: "5-7 days",
  siding: "5-7 days",
  insulation: "2-3 days",
  cabinets: "3-5 days",
  countertops: "2-3 days",
  tile: "5-7 days",
};

const DEFAULT_DURATION = "3-5 days";

/**
 * Parse a duration string like "3-5 days" into fractional weeks.
 * Uses the average of the range divided by 7.
 */
export function durationToWeeks(duration: string | null | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+)\s*-\s*(\d+)\s*days?/i);
  if (match) {
    const avg = (parseInt(match[1]) + parseInt(match[2])) / 2;
    return Math.round((avg / 7) * 100) / 100;
  }
  const single = duration.match(/(\d+)\s*days?/i);
  if (single) return Math.round((parseInt(single[1]) / 7) * 100) / 100;
  const weeks = duration.match(/(\d+)\s*weeks?/i);
  if (weeks) return parseInt(weeks[1]);
  return 0;
}

function lookupDuration(title: string): string {
  const key = title.toLowerCase().trim();
  for (const [trade, dur] of Object.entries(TRADE_DURATIONS)) {
    if (key.includes(trade) || trade.includes(key)) return dur;
  }
  return DEFAULT_DURATION;
}

/**
 * Default payment split: 10% signing, 5% final walkthrough,
 * remaining 85% distributed across scope phases.
 */
function distributePayments(phaseCount: number): number[] {
  const signingPct = 10;
  const finalPct = 5;
  const remaining = 85;

  if (phaseCount === 0) return [signingPct, finalPct];

  // Distribute remaining evenly, rounding to integers, fix remainder on first phase
  const perPhase = Math.floor(remaining / phaseCount);
  const remainder = remaining - perPhase * phaseCount;

  const phasePcts: number[] = [];
  for (let i = 0; i < phaseCount; i++) {
    phasePcts.push(perPhase + (i < remainder ? 1 : 0));
  }

  return [signingPct, ...phasePcts, finalPct];
}

const PHASE_LABELS = [
  "Materials Purchase",
  "Phase 2 Progress",
  "Phase 3 Progress",
  "Phase 4 Progress",
  "Phase 5 Progress",
  "Phase 6 Progress",
  "Phase 7 Progress",
  "Phase 8 Progress",
];

export function generateMilestones(sections: MilestoneInput[]): GeneratedMilestone[] {
  const paymentPcts = distributePayments(sections.length);
  const milestones: GeneratedMilestone[] = [];

  // Position 0: Contract Signed
  milestones.push({
    name: "Contract Signed",
    weekNumber: 0,
    duration: null,
    paymentPct: paymentPcts[0],
    paymentLabel: "Contract Signing",
    position: 0,
  });

  // Scope phases
  sections.forEach((sec, i) => {
    milestones.push({
      name: sec.title,
      weekNumber: i + 1,
      duration: lookupDuration(sec.title),
      paymentPct: paymentPcts[i + 1],
      paymentLabel: PHASE_LABELS[i] ?? `Phase ${i + 2} Progress`,
      position: i + 1,
    });
  });

  // Final walkthrough
  milestones.push({
    name: "Final Walkthrough & Punch List",
    weekNumber: sections.length + 1,
    duration: "1-2 days",
    paymentPct: paymentPcts[paymentPcts.length - 1],
    paymentLabel: "Project Completion",
    position: sections.length + 1,
  });

  return milestones;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/milestone-defaults.test.ts --no-coverage`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/milestone-defaults.ts src/__tests__/milestone-defaults.test.ts
git commit -m "feat: add milestone auto-generation module with trade-duration mapping"
```

---

### Task 3: Add payment schedule calculation to pricing module

**Files:**
- Modify: `src/lib/pricing.ts`
- Modify or create: `src/__tests__/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/pricing.test.ts` (create if it doesn't exist — check first):

```typescript
import { calculatePaymentSchedule } from "@/lib/pricing";

describe("calculatePaymentSchedule", () => {
  it("calculates amounts and running balance from milestones", () => {
    const milestones = [
      { name: "Contract Signed", weekNumber: 0, paymentPct: 10, paymentLabel: "Signing" },
      { name: "Demolition", weekNumber: 1, paymentPct: 25, paymentLabel: "Materials" },
      { name: "Flooring", weekNumber: 2, paymentPct: 60, paymentLabel: "Phase 2" },
      { name: "Punch List", weekNumber: 3, paymentPct: 5, paymentLabel: "Completion" },
    ];
    const total = 10000;

    const schedule = calculatePaymentSchedule(milestones, total);

    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toEqual({ name: "Contract Signed", weekNumber: 0, paymentLabel: "Signing", paymentPct: 10, amount: 1000, balance: 9000 });
    expect(schedule[1]).toEqual({ name: "Demolition", weekNumber: 1, paymentLabel: "Materials", paymentPct: 25, amount: 2500, balance: 6500 });
    expect(schedule[2]).toEqual({ name: "Flooring", weekNumber: 2, paymentLabel: "Phase 2", paymentPct: 60, amount: 6000, balance: 500 });
    expect(schedule[3]).toEqual({ name: "Punch List", weekNumber: 3, paymentLabel: "Completion", paymentPct: 5, amount: 500, balance: 0 });
  });

  it("skips milestones with no paymentPct", () => {
    const milestones = [
      { name: "Signing", weekNumber: 0, paymentPct: 100, paymentLabel: "Full" },
      { name: "Work", weekNumber: 1, paymentPct: null, paymentLabel: null },
    ];

    const schedule = calculatePaymentSchedule(milestones, 5000);

    expect(schedule).toHaveLength(1);
    expect(schedule[0].amount).toBe(5000);
    expect(schedule[0].balance).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/pricing.test.ts --no-coverage`

Expected: FAIL — `calculatePaymentSchedule` not found.

- [ ] **Step 3: Add the function to pricing.ts**

Append to `src/lib/pricing.ts`:

```typescript
export interface PaymentMilestone {
  name: string;
  weekNumber: number;
  paymentPct: number | null;
  paymentLabel: string | null;
}

export interface PaymentScheduleRow {
  name: string;
  weekNumber: number;
  paymentLabel: string | null;
  paymentPct: number;
  amount: number;
  balance: number;
}

export function calculatePaymentSchedule(
  milestones: PaymentMilestone[],
  total: number
): PaymentScheduleRow[] {
  const paying = milestones.filter((m) => m.paymentPct != null && m.paymentPct > 0);
  let remaining = round2(total);
  return paying.map((m, i) => {
    const amount = round2((m.paymentPct! / 100) * total);
    remaining = round2(remaining - amount);
    // Fix floating point on last row
    if (i === paying.length - 1) remaining = 0;
    return {
      name: m.name,
      weekNumber: m.weekNumber,
      paymentLabel: m.paymentLabel,
      paymentPct: m.paymentPct!,
      amount,
      balance: remaining,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/pricing.test.ts --no-coverage`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/__tests__/pricing.test.ts
git commit -m "feat: add calculatePaymentSchedule to pricing module"
```

---

### Task 4: Wire milestones into quote API endpoints

**Files:**
- Modify: `src/app/api/quotes/route.ts`
- Modify: `src/app/api/quotes/[id]/route.ts`

- [ ] **Step 1: Update POST /api/quotes to auto-generate milestones**

In `src/app/api/quotes/route.ts`, add the import at the top:

```typescript
import { generateMilestones } from "@/lib/milestone-defaults";
```

After the sections creation loop (after line 86, after `}` closing `if (body.sections?.length)`), add:

```typescript
  // Auto-generate milestones from sections
  if (body.sections?.length) {
    const milestoneDefaults = generateMilestones(body.sections.map((s: { title: string }) => ({ title: s.title })));
    for (const m of milestoneDefaults) {
      await prisma.quoteMilestone.create({
        data: {
          quoteId: quote.id,
          name: m.name,
          weekNumber: m.weekNumber,
          duration: m.duration,
          paymentPct: m.paymentPct,
          paymentLabel: m.paymentLabel,
          position: m.position,
        },
      });
    }
  }
```

Update the `finalQuote` re-fetch include (around line 92) to add milestones:

```typescript
  const finalQuote = await prisma.quote.findUnique({
    where: { id: quote.id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      milestones: { orderBy: { position: "asc" } },
    },
  });
```

- [ ] **Step 2: Update GET /api/quotes/[id] to include milestones**

In `src/app/api/quotes/[id]/route.ts`, update the `include` in the GET handler (line 13-21) to add:

```typescript
      milestones: { orderBy: { position: "asc" } },
```

Add it after the `acceptance: true,` line.

- [ ] **Step 3: Update PUT /api/quotes/[id] to accept milestones**

In the PUT handler of `src/app/api/quotes/[id]/route.ts`, after the sections handling block (after line 73 `}`), add:

```typescript
  if (body.milestones) {
    await prisma.quoteMilestone.deleteMany({ where: { quoteId: id } });
    for (let i = 0; i < body.milestones.length; i++) {
      const m = body.milestones[i];
      await prisma.quoteMilestone.create({
        data: {
          quoteId: id,
          name: m.name,
          weekNumber: m.weekNumber,
          duration: m.duration ?? null,
          paymentPct: m.paymentPct ?? null,
          paymentLabel: m.paymentLabel ?? null,
          position: i,
        },
      });
    }
  }
```

Update the response to re-fetch with milestones. Replace the final `return NextResponse.json(quote);` with:

```typescript
  const updated = await prisma.quote.findUnique({
    where: { id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      milestones: { orderBy: { position: "asc" } },
    },
  });
  return NextResponse.json(updated);
```

- [ ] **Step 4: Update GET /api/quotes (list) to include milestones**

In `src/app/api/quotes/route.ts`, update the GET handler's `include` to add:

```typescript
      milestones: { orderBy: { position: "asc" } },
```

- [ ] **Step 5: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

Expected: Build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/quotes/route.ts src/app/api/quotes/[id]/route.ts
git commit -m "feat: wire QuoteMilestone into quote API endpoints"
```

---

### Task 5: Add milestone editor to QuoteEditor sidebar

**Files:**
- Modify: `src/components/internal/QuoteEditor.tsx`

- [ ] **Step 1: Add milestone type and state to QuoteEditor**

Add the `Milestone` interface after the existing `Section` interface (after line 22):

```typescript
interface Milestone {
  id?: string;
  name: string;
  weekNumber: number;
  duration: string | null;
  paymentPct: number | null;
  paymentLabel: string | null;
}
```

Add `milestones` to the `Quote` interface (after `sections: Section[];` on line 41):

```typescript
  milestones: Milestone[];
```

- [ ] **Step 2: Add the import for generateMilestones**

At the top of the file, add:

```typescript
import { generateMilestones } from "@/lib/milestone-defaults";
```

- [ ] **Step 3: Add milestone mutation helpers**

After the `addSection` function (after line 117), add:

```typescript
  const updateMilestone = (idx: number, field: keyof Milestone, value: string | number | null) => {
    setQuote((q) => ({
      ...q,
      milestones: q.milestones.map((m, i) =>
        i !== idx ? m : { ...m, [field]: value }
      ),
    }));
  };

  const regenerateMilestones = () => {
    if (!confirm("Regenerate milestones from current sections? This will replace all existing milestones.")) return;
    const generated = generateMilestones(quote.sections.map((s) => ({ title: s.title })));
    setQuote((q) => ({
      ...q,
      milestones: generated.map((m) => ({
        name: m.name,
        weekNumber: m.weekNumber,
        duration: m.duration,
        paymentPct: m.paymentPct,
        paymentLabel: m.paymentLabel,
      })),
    }));
  };
```

- [ ] **Step 4: Add the milestone editor UI in the sidebar**

In the sidebar panel, after the existing "Project Timeline" section (after the closing `</div>` on line 334), add:

```tsx
          {/* Milestone Editor */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest">
                Milestones & Payments
              </h3>
              <button
                onClick={regenerateMilestones}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                Regenerate
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {quote.milestones.map((m, idx) => (
                <div key={idx} className="bg-surface-2 rounded px-2.5 py-2 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-text-primary font-medium truncate flex-1 mr-2">{m.name}</span>
                    <input
                      type="number"
                      value={m.weekNumber}
                      onChange={(e) => updateMilestone(idx, "weekNumber", parseInt(e.target.value) || 0)}
                      className="w-10 bg-surface border border-border rounded px-1 py-0.5 text-[10px] text-text-primary text-center focus:outline-none focus:border-accent"
                      title="Week"
                    />
                    <span className="text-text-muted text-[10px] ml-1">wk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={m.duration ?? ""}
                      onChange={(e) => updateMilestone(idx, "duration", e.target.value || null)}
                      placeholder="Duration"
                      className="flex-1 bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      value={m.paymentPct ?? ""}
                      onChange={(e) => updateMilestone(idx, "paymentPct", e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="%"
                      className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-[10px] text-text-primary text-right focus:outline-none focus:border-accent"
                    />
                    <span className="text-text-muted text-[10px]">%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment % total indicator */}
            {quote.milestones.length > 0 && (() => {
              const totalPct = quote.milestones.reduce((sum, m) => sum + (m.paymentPct ?? 0), 0);
              const isValid = Math.abs(totalPct - 100) < 0.01;
              return (
                <div className={`mt-2 text-[10px] text-right font-medium ${
                  isValid ? "text-green-400" : totalPct > 100 ? "text-red-400" : "text-amber-400"
                }`}>
                  Payment total: {totalPct}%{!isValid && (totalPct > 100 ? " (over 100%)" : " (under 100%)")}
                </div>
              );
            })()}
          </div>
```

- [ ] **Step 5: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

Expected: Build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/internal/QuoteEditor.tsx
git commit -m "feat: add milestone editor to QuoteEditor sidebar"
```

---

### Task 6: Add visual bar chart timeline to proposal page

**Files:**
- Modify: `src/app/proposals/[slug]/page.tsx`

- [ ] **Step 1: Update the query to include milestones**

In the `prisma.quote.findFirst` include block (around line 17-25), add after `acceptance: true,`:

```typescript
      milestones: { orderBy: { position: "asc" } },
```

- [ ] **Step 2: Add the imports and helpers**

Add at the top of the file, after the existing imports:

```typescript
import { durationToWeeks } from "@/lib/milestone-defaults";
import { calculatePaymentSchedule } from "@/lib/pricing";
```

After the `totals` calculation (around line 37), add:

```typescript
  const schedule = calculatePaymentSchedule(
    quote.milestones.map((m) => ({
      name: m.name,
      weekNumber: m.weekNumber,
      paymentPct: m.paymentPct,
      paymentLabel: m.paymentLabel,
    })),
    totals.total
  );
  const maxWeek = quote.milestones.length > 0
    ? Math.max(...quote.milestones.map((m) => m.weekNumber)) + 1
    : 0;
  const anchorDate = quote.estimatedStartDate
    ? new Date(quote.estimatedStartDate)
    : new Date();
  const weekDate = (wk: number) => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + wk * 7);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
```

- [ ] **Step 3: Add the timeline bar chart and payment schedule sections**

In the JSX, after the totals block (after the closing `</div>` of the "Total Investment" section — the one with `mb-10`), add:

```tsx
        {/* Project Timeline — Bar Chart */}
        {quote.milestones.length > 0 && (
          <div className="mb-10 print:mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
              <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Project Timeline</h3>
            </div>

            <div className="bg-white rounded border border-[#E8E4DD] p-5 print:p-3">
              {/* Week header row */}
              <div className="flex mb-1" style={{ paddingLeft: "140px" }}>
                {Array.from({ length: maxWeek + 1 }, (_, wk) => (
                  <div key={wk} className="flex-1 text-center">
                    <div className="text-[10px] font-bold text-[#6B6560]">WK {wk}</div>
                    <div className="text-[9px] text-[#9A9591]">{weekDate(wk)}</div>
                  </div>
                ))}
              </div>

              {/* Phase bars */}
              <div className="flex flex-col gap-1.5 mt-2">
                {quote.milestones.filter((m) => m.position > 0).map((m) => {
                  const widthWeeks = Math.max(durationToWeeks(m.duration), 0.3);
                  const startPct = (m.weekNumber / (maxWeek + 1)) * 100;
                  const widthPct = (widthWeeks / (maxWeek + 1)) * 100;
                  const hasPayment = m.paymentPct != null && m.paymentPct > 0;

                  return (
                    <div key={m.id ?? m.position} className="flex items-center">
                      <div className="w-[140px] shrink-0 pr-3 text-right">
                        <span className="text-xs text-[#3A3530] font-medium">{m.name}</span>
                      </div>
                      <div className="flex-1 relative h-7">
                        {/* Background grid lines */}
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: maxWeek + 1 }, (_, wk) => (
                            <div key={wk} className="flex-1 border-l border-[#F0EDE8]" />
                          ))}
                        </div>
                        {/* Phase bar */}
                        <div
                          className="absolute top-0.5 h-6 rounded"
                          style={{
                            left: `${startPct}%`,
                            width: `${Math.min(widthPct, 100 - startPct)}%`,
                            backgroundColor: "#1E2A38",
                            borderLeft: hasPayment ? "3px solid #C17F3A" : undefined,
                          }}
                        >
                          {m.duration && (
                            <span className="text-[9px] text-white/70 px-2 leading-6 whitespace-nowrap">
                              {m.duration}
                            </span>
                          )}
                        </div>
                        {/* Payment diamond marker */}
                        {hasPayment && (
                          <div
                            className="absolute top-0 w-2.5 h-2.5 bg-[#C17F3A] rotate-45"
                            style={{ left: `calc(${startPct}% - 5px)`, top: "-4px" }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-[#9A9591] mt-4 italic">
                Timeline assumes project start of {weekDate(0)}. Actual dates may vary based on material availability and scheduling.
              </p>
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        {schedule.length > 0 && (
          <div className="mb-10 print:mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
              <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Payment Schedule</h3>
            </div>

            <div className="bg-white rounded border border-[#E8E4DD] overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#F7F5F0] text-[10px] font-bold text-[#6B6560] uppercase tracking-wider border-b border-[#E8E4DD]">
                <span className="col-span-4">Milestone</span>
                <span className="col-span-2 text-center">Week</span>
                <span className="col-span-2 text-right">Payment</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-2 text-right">Balance</span>
              </div>

              {schedule.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-12 gap-2 px-5 py-2.5 text-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"
                  } ${i > 0 ? "border-t border-[#F0EDE8]" : ""}`}
                >
                  <div className="col-span-4">
                    <span className="text-[#3A3530] font-medium">{row.name}</span>
                    {row.paymentLabel && (
                      <span className="text-[#9A9591] text-xs ml-1.5">({row.paymentLabel})</span>
                    )}
                  </div>
                  <span className="col-span-2 text-center text-[#6B6560]">{row.weekNumber}</span>
                  <span className="col-span-2 text-right text-[#6B6560]">{row.paymentPct}%</span>
                  <span className="col-span-2 text-right text-[#1A1917] font-semibold tabular-nums">
                    ${fmt(row.amount)}
                  </span>
                  <span className="col-span-2 text-right text-[#6B6560] tabular-nums">
                    ${fmt(row.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

Expected: Build completes with no errors.

- [ ] **Step 5: Preview locally**

Open: `http://localhost:3000/proposals/price-831-deming-way-mn6q44p1`

Verify: Bar chart timeline and payment schedule table render below the totals block.

- [ ] **Step 6: Commit**

```bash
git add "src/app/proposals/[slug]/page.tsx"
git commit -m "feat: add visual timeline bar chart and payment schedule to proposal page"
```

---

### Task 7: Backfill milestones for existing Deming Way quote

**Files:** None (database operation)

- [ ] **Step 1: Generate and insert milestones for the existing quote**

Run this script to add milestones to the Deming Way quote already in production:

```bash
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:CzYxtoBunfUlSOxHOLELDWAkLkHQBduC@centerbeam.proxy.rlwy.net:38364/railway' });
async function main() {
  await c.connect();
  const quoteId = '9ae7a689-c4cc-4f34-a473-ac78205706dc';

  // Check if milestones already exist
  const existing = await c.query('SELECT count(*) FROM \"QuoteMilestone\" WHERE \"quoteId\" = \$1', [quoteId]);
  if (parseInt(existing.rows[0].count) > 0) {
    console.log('Milestones already exist, skipping.');
    await c.end();
    return;
  }

  const milestones = [
    { name: 'Contract Signed', weekNumber: 0, duration: null, paymentPct: 10, paymentLabel: 'Contract Signing', position: 0 },
    { name: 'Demolition', weekNumber: 1, duration: '3-5 days', paymentPct: 25, paymentLabel: 'Materials Purchase', position: 1 },
    { name: 'Paint & Drywall', weekNumber: 2, duration: '5-7 days', paymentPct: 25, paymentLabel: 'Phase 2 Progress', position: 2 },
    { name: 'Flooring', weekNumber: 3, duration: '5-8 days', paymentPct: 25, paymentLabel: 'Phase 3 Progress', position: 3 },
    { name: 'Ceiling', weekNumber: 4, duration: '2-3 days', paymentPct: 10, paymentLabel: 'Phase 4 Progress', position: 4 },
    { name: 'Final Walkthrough & Punch List', weekNumber: 5, duration: '1-2 days', paymentPct: 5, paymentLabel: 'Project Completion', position: 5 },
  ];

  for (const m of milestones) {
    await c.query(
      'INSERT INTO \"QuoteMilestone\" (id, \"quoteId\", name, \"weekNumber\", duration, \"paymentPct\", \"paymentLabel\", position) VALUES (gen_random_uuid(), \$1, \$2, \$3, \$4, \$5, \$6, \$7)',
      [quoteId, m.name, m.weekNumber, m.duration, m.paymentPct, m.paymentLabel, m.position]
    );
    console.log('Created:', m.name);
  }

  console.log('Done — 6 milestones created for Deming Way quote');
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
"
```

Expected: 6 milestones created.

- [ ] **Step 2: Verify by previewing locally**

Open: `http://localhost:3000/proposals/price-831-deming-way-mn6q44p1`

Verify: Timeline bar chart and payment schedule render with Deming Way data.

---

### Task 8: End-to-end verification and push

- [ ] **Step 1: Run all tests**

Run: `npx jest --no-coverage`

Expected: All tests pass.

- [ ] **Step 2: Run full build**

Run: `npx next build 2>&1 | tail -10`

Expected: Clean build, no errors.

- [ ] **Step 3: Push all commits**

```bash
git push
```
