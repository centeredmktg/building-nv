/**
 * One-off: seed two draft quotes for Jon (master bath + master bedroom).
 * Source: hand sketch, 2026-04-17. See outputs/2026-04-17-jon-bathroom-bedroom-scope-draft.md
 *
 * Run: pnpm tsx scripts/seed-jon-quotes.ts
 * Idempotent: deletes any pre-existing quote with these slugs first.
 *
 * Pricing policy: unitPrice = 0 for all labor/install (deterministic engine prices
 * in the UI). Allowance items use Danny-approved numbers as placeholders.
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { generateMilestones } from "../src/lib/milestone-defaults";

type Item = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isMaterial: boolean;
};

type Section = {
  title: string;
  trade: string | null;
  items: Item[];
};

const BATHROOM_SLUG = "2026-04-17-jon-master-bathroom";
const BEDROOM_SLUG = "2026-04-17-jon-master-bedroom";

const COMMON_ADDRESS = "Address TBD — Jon 775-742-9970";

// ──────────────────────────────────────────────────────────────────────────
// QUOTE 1 — Master Bathroom
// Assumptions: 10×8 footprint (~80 sqft tile), 1 glass-block window,
// allowances: vanity $3K / chandelier $2K / shower fixtures $1.5K.
// ──────────────────────────────────────────────────────────────────────────

const bathroomSections: Section[] = [
  {
    title: "Demolition",
    trade: "demolition",
    items: [
      { description: "Demo existing tile floor, shower surround, and fixtures; haul debris", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Remove existing vanity, toilet, built-in cabinetry", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Floor/subfloor protection and containment", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Plumbing",
    trade: "plumbing",
    items: [
      { description: "Relocate/rough-in vanity supply + drain for new cabinet layout", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Shower valve rough + trim (curbless, round drain)", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Toilet reset on new flooring", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Round drain assembly for curbless shower", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Shower fixtures — allowance (valve trim, showerhead, handheld)", quantity: 1, unit: "allowance", unitPrice: 1500, isMaterial: true },
    ],
  },
  {
    title: "Framing & Carpentry",
    trade: "carpentry",
    items: [
      { description: "Frame curbless shower slope + bench (if required)", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Frame 37¾\" × 16\" built-in cabinet niche", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Frame hamper cabinet", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Frame shower niche + blocking", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Barn-door track blocking", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Electrical",
    trade: "electrical",
    items: [
      { description: "3-gang box — vanity wall", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "4-gang box — secondary wall", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Can lights — supply + install", quantity: 5, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Chandelier over tub — allowance + install", quantity: 1, unit: "allowance", unitPrice: 2000, isMaterial: true },
      { description: "Re-trim existing light locations", quantity: 2, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Heater / vent / fan combo — supply + install", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Drywall & Paint",
    trade: "drywall",
    items: [
      { description: "Patch/repair post-electrical and plumbing", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Level-5 finish at wet walls (pre-tile prep)", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Paint ceiling + non-tile walls, 2 coats", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Tile & Slab",
    trade: "flooring",
    items: [
      { description: "Floor tile — install (10×8 assumption, refine w/ field measurement)", quantity: 80, unit: "sqft", unitPrice: 0, isMaterial: false },
      { description: "Shower slab walls — large format porcelain w/ waterfall corner (3 walls)", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Shower floor tile / mosaic + slope-to-drain mud bed", quantity: 14.4, unit: "sqft", unitPrice: 0, isMaterial: false },
      { description: "Niche tile + edge treatment", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Waterproofing — full shower envelope (Kerdi or equivalent)", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Grout + sealer", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Cabinetry & Vanity",
    trade: "carpentry",
    items: [
      { description: "Vanity cabinet — ~12' run — allowance", quantity: 1, unit: "allowance", unitPrice: 3000, isMaterial: true },
      { description: "Vanity countertop — slab to match shower walls", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Install 37¾\" built-in cabinet face + doors", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Install hamper cabinet face", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Glazing & Openings",
    trade: "glazing",
    items: [
      { description: "Glass-block window retrofit (1 opening)", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "Barn-door shower door system", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Options (client-selectable)",
    trade: "other",
    items: [
      { description: "OPTION — Heated tile floor (electric mat + thermostat, full bath)", quantity: 80, unit: "sqft", unitPrice: 0, isMaterial: false },
      { description: "OPTION — Heat lamp fixture (toilet or shower area)", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "OPTION — Add second shower window (framing + waterproofing)", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "OPTION — Frosted glass in lieu of glass block", quantity: 1, unit: "ea", unitPrice: 0, isMaterial: false },
      { description: "OPTION — Ceiling reinforcement for chandelier drop", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// QUOTE 2 — Master Bedroom (15'7" × 17' ≈ 267 sqft)
// ──────────────────────────────────────────────────────────────────────────

const bedroomSections: Section[] = [
  {
    title: "Demolition",
    trade: "demolition",
    items: [
      { description: "Remove existing flooring + base", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Protection + containment", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Flooring",
    trade: "flooring",
    items: [
      { description: "LVP — supply (allowance $/sqft TBD) + install", quantity: 267, unit: "sqft", unitPrice: 0, isMaterial: false },
      { description: "Underlayment", quantity: 267, unit: "sqft", unitPrice: 0, isMaterial: false },
      { description: "Transitions + base trim", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Back-Wall Built-in",
    trade: "carpentry",
    items: [
      { description: "Full-wall built-in — frame + face + shelving", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Paint/finish built-in", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "Trim + scribe to ceiling/floor", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Paint",
    trade: "painting",
    items: [
      { description: "Full room repaint (walls + ceiling + trim)", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
  {
    title: "Options (client-selectable)",
    trade: "other",
    items: [
      { description: "OPTION — LED strip lighting integrated into built-in", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
      { description: "OPTION — Closet system tie-in to back wall", quantity: 1, unit: "ls", unitPrice: 0, isMaterial: false },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────

async function seedQuote({
  slug,
  title,
  address,
  projectType,
  scopeText,
  sections,
}: {
  slug: string;
  title: string;
  address: string;
  projectType: string;
  scopeText: string;
  sections: Section[];
}) {
  // Idempotency: cascade-delete any prior record
  const existing = await prisma.quote.findUnique({ where: { slug } });
  if (existing) {
    console.log(`  [${slug}] existing quote found — deleting`);
    await prisma.quote.delete({ where: { id: existing.id } });
  }

  const quote = await prisma.quote.create({
    data: {
      slug,
      title,
      address,
      projectType,
      scopeText,
      status: "draft",
    },
  });
  console.log(`  [${slug}] created quote ${quote.id}`);

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const section = await prisma.lineItemSection.create({
      data: { quoteId: quote.id, title: sec.title, trade: sec.trade, position: si },
    });
    for (let li = 0; li < sec.items.length; li++) {
      const item = sec.items[li];
      await prisma.lineItem.create({
        data: {
          sectionId: section.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          isMaterial: item.isMaterial,
          trade: sec.trade,
          position: li,
        },
      });
    }
  }
  console.log(`  [${slug}] ${sections.length} sections, ${sections.reduce((n, s) => n + s.items.length, 0)} line items`);

  const milestoneDefaults = generateMilestones(sections.map((s) => ({ title: s.title })));
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
  console.log(`  [${slug}] ${milestoneDefaults.length} milestones`);

  return quote;
}

async function main() {
  const dbHost = process.env.DATABASE_URL?.match(/@([^:/]+)/)?.[1] ?? "unknown";
  console.log(`Seeding Jon's quotes → ${dbHost}`);

  await seedQuote({
    slug: BATHROOM_SLUG,
    title: `${COMMON_ADDRESS} — Master Bathroom Remodel`,
    address: COMMON_ADDRESS,
    projectType: "residential_remodel",
    scopeText: "Full master bathroom remodel: curbless tile shower (45x46) with slab walls + waterfall, new vanity (~12' run), built-in cabinet (37¾x16), hamper cabinet, glass-block window, barn-door shower, chandelier over tub + 5 cans, heater/vent/fan combo. Sourced from hand sketch 2026-04-17.",
    sections: bathroomSections,
  });

  await seedQuote({
    slug: BEDROOM_SLUG,
    title: `${COMMON_ADDRESS} — Master Bedroom`,
    address: COMMON_ADDRESS,
    projectType: "residential_remodel",
    scopeText: "Master bedroom (15'7\" × 17', ~267 sqft): LVP flooring + full-wall built-in on back wall + repaint. Sourced from hand sketch 2026-04-17.",
    sections: bedroomSections,
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
