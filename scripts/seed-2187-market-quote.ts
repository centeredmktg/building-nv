/**
 * Archival import: 2187 Market St T.I. proposal for Hallmark Investments & Management.
 * Source: PDF dated 2026-04-24 (CPP-branded; archived under Building NV).
 *
 * Run: pnpm tsx scripts/seed-2187-market-quote.ts
 * Idempotent: deletes any existing quote with this slug first.
 *
 * Pricing policy: numbers preserved verbatim from PDF.
 *   subtotal = $36,233.00 (sum of 15 line items)
 *   8% overhead = $2,898.64 + 20% profit = $7,246.60
 *   total = $46,378.24
 * The $1,800 LVT-removal alternate is captured in `notes` (not a line item)
 * so it does not roll into the headline total.
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const SLUG = "2187-market-st-ti";
const CUSTOMER_NAME = "Hallmark Investments & Management";
const PROPOSAL_DATE = new Date("2026-04-24T00:00:00Z");

type Item = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
};

type Section = {
  title: string;
  trade: string;
  items: Item[];
};

const sections: Section[] = [
  {
    title: "Demo & Disposal",
    trade: "demolition",
    items: [
      { description: "Remove slat walls throughout office area and repair", quantity: 1, unit: "ls", unitPrice: 2200, isMaterial: false },
      { description: "Dump fees", quantity: 1, unit: "ls", unitPrice: 350, isMaterial: false },
    ],
  },
  {
    title: "Framing & Carpentry",
    trade: "carpentry",
    items: [
      { description: "Install demising wall 26' wide x 13' tall, insulated", quantity: 1, unit: "ls", unitPrice: 3990, isMaterial: false },
      { description: "Frame & install fire-rated door in demising wall", quantity: 1, unit: "ea", unitPrice: 1560, isMaterial: false },
    ],
  },
  {
    title: "Electrical",
    trade: "electrical",
    items: [
      { description: "Install convenience electrical throughout wall (3 plugs per side)", quantity: 1, unit: "ls", unitPrice: 2160, isMaterial: false },
      { description: "Remove and replace office lighting (14')", quantity: 10, unit: "ea", unitPrice: 216, isMaterial: false },
    ],
  },
  {
    title: "Drywall",
    trade: "drywall",
    items: [
      { description: "Texture office walls and demising wall", quantity: 1, unit: "ls", unitPrice: 3100, isMaterial: false },
    ],
  },
  {
    title: "Painting",
    trade: "painting",
    items: [
      { description: "Prep, prime, and paint bright white", quantity: 1, unit: "ls", unitPrice: 10798, isMaterial: false },
    ],
  },
  {
    title: "Flooring",
    trade: "flooring",
    items: [
      { description: "Install customer-supplied LVT (office, hallway, & restrooms)", quantity: 1, unit: "ls", unitPrice: 3150, isMaterial: false },
      { description: "Install 4\" cove base (office, hallway, & restrooms)", quantity: 1, unit: "ls", unitPrice: 1395, isMaterial: false },
      { description: "Pressure wash shop floors", quantity: 1, unit: "ls", unitPrice: 1000, isMaterial: false },
      { description: "Install epoxy on shop floors", quantity: 1, unit: "ls", unitPrice: 2750, isMaterial: false },
      { description: "Install epoxy on stairs", quantity: 1, unit: "ls", unitPrice: 500, isMaterial: false },
    ],
  },
  {
    title: "Equipment & Inspections",
    trade: "general_labor",
    items: [
      { description: "Test all electrical, HVAC, and plumbing", quantity: 1, unit: "ls", unitPrice: 250, isMaterial: false },
      { description: "Scissor lift rental, delivery, & pick up (2 days)", quantity: 1, unit: "ls", unitPrice: 870, isMaterial: false },
    ],
  },
];

const NOTES = `OPTIONS / ALTERNATES
- Remove existing LVT flooring: $1,800.00 (only required if new LVT cannot be laid over existing)

DISCLAIMER
After final touch-ups have been approved, natural settling or earth movement may cause woodwork, cabinets, doors, or trim to shrink. Kiln-dried wood does not guarantee against shrinkage and may result in separations, voids, cracks, or other issues. Any necessary repairs will be performed at the owner's request on a time-and-materials basis at $95.00 per man-hour.`;

const EXCLUSIONS =
  "Plans. Any permit fees. Any work not specifically described above is excluded. All valuables and personal property to be removed from work areas prior to work.";

const PAYMENT_TERMS =
  "10% due at signing of proposal. 25% due after materials have been purchased. Balance due net 30.";

const SCOPE_TEXT =
  "Building NV proposes to perform tenant-improvement work for 2187 Market St as outlined below.";

async function main() {
  // Idempotent reset
  await prisma.quote.deleteMany({ where: { slug: SLUG } });

  // Upsert customer Company by name
  const existingCompany = await prisma.company.findFirst({ where: { name: CUSTOMER_NAME } });
  const company = existingCompany
    ?? (await prisma.company.create({ data: { name: CUSTOMER_NAME, type: "customer" } }));

  const quote = await prisma.quote.create({
    data: {
      slug: SLUG,
      title: "2187 Market St — Tenant Improvement",
      address: "2187 Market St",
      projectType: "Suite Renovation",
      status: "sent",
      sentAt: PROPOSAL_DATE,
      scopeText: SCOPE_TEXT,
      notes: NOTES,
      exclusions: EXCLUSIONS,
      paymentTerms: PAYMENT_TERMS,
      // Preserve PDF math exactly: 8% OH + 20% Profit on subtotal, no material markup.
      materialMarkupPct: 0,
      overheadPct: 8,
      profitPct: 20,
      paddingPct: 0,
      cppBranded: true, // archival CPP-era proposal — display under CPP Painting & Construction

      createdAt: PROPOSAL_DATE,
      sections: {
        create: sections.map((s, sIdx) => ({
          title: s.title,
          trade: s.trade,
          position: sIdx,
          items: {
            create: s.items.map((item, iIdx) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              isMaterial: item.isMaterial,
              trade: s.trade,
              position: iIdx,
            })),
          },
        })),
      },
      quoteCompanies: {
        create: [{ companyId: company.id, role: "tenant" }],
      },
    },
    include: { sections: { include: { items: true } } },
  });

  // Verify totals
  const subtotal = quote.sections
    .flatMap((s) => s.items)
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const overhead = subtotal * (quote.overheadPct / 100);
  const profit = subtotal * (quote.profitPct / 100);
  const total = subtotal + overhead + profit;

  console.log(`✓ Created quote ${quote.id}`);
  console.log(`  slug: ${quote.slug}`);
  console.log(`  customer: ${company.name}`);
  console.log(`  sections: ${quote.sections.length}`);
  console.log(`  line items: ${quote.sections.flatMap((s) => s.items).length}`);
  console.log(`  subtotal: $${subtotal.toFixed(2)}  (expected $36,233.00)`);
  console.log(`  overhead 8%: $${overhead.toFixed(2)}  (expected $2,898.64)`);
  console.log(`  profit 20%: $${profit.toFixed(2)}  (expected $7,246.60)`);
  console.log(`  total: $${total.toFixed(2)}  (expected $46,378.24)`);
  console.log(`  view: /internal/quotes/${quote.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
