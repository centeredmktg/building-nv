/**
 * Seeds a CPP proposal Quote from an extracted JSON intermediate.
 *
 * Usage: npx tsx scripts/import-cpp-proposal/seed.ts <json-path> [--force]
 *   --force: bypass totalMismatch guard
 *
 * Idempotent: deletes any existing Quote with the same slug first.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../../src/lib/prisma";
import { sectionTitleForTrade } from "./trade-mapping";
import type { ExtractionResult, ExtractedLineItem } from "./types";
import type { TradeId } from "../../src/lib/trades";

async function main() {
  const jsonPath = process.argv[2];
  const force = process.argv.includes("--force");
  if (!jsonPath) {
    console.error("usage: tsx scripts/import-cpp-proposal/seed.ts <json-path> [--force]");
    process.exit(1);
  }

  const raw = readFileSync(resolve(jsonPath), "utf-8");
  const data: ExtractionResult = JSON.parse(raw);

  if (data.reviewFlags.totalMismatch && !force) {
    console.error("✗ Refusing to seed: totalMismatch is true.");
    console.error(`  stated:   $${data.reviewFlags.statedTotal.toFixed(2)}`);
    console.error(`  computed: $${data.reviewFlags.computedTotal.toFixed(2)}`);
    console.error(`  Resolve the JSON or re-run with --force.`);
    process.exit(1);
  }

  // Idempotent reset
  await prisma.quote.deleteMany({ where: { slug: data.quote.slug } });

  // Find-or-create customer Company (case-insensitive)
  const existing = await prisma.company.findFirst({
    where: { name: { equals: data.quote.customerCompany, mode: "insensitive" } },
  });
  const company = existing
    ?? (await prisma.company.create({ data: { name: data.quote.customerCompany, type: "customer" } }));

  // Group non-alternate line items by tradeTag (preserving PDF order within each group)
  const grouped = new Map<TradeId, ExtractedLineItem[]>();
  const tradeOrder: TradeId[] = [];
  for (const item of data.lineItems) {
    if (item.isAlternate) continue;
    if (!grouped.has(item.tradeTag)) {
      grouped.set(item.tradeTag, []);
      tradeOrder.push(item.tradeTag);
    }
    grouped.get(item.tradeTag)!.push(item);
  }

  const sectionsCreate = tradeOrder.map((trade, sIdx) => ({
    title: sectionTitleForTrade(trade),
    trade,
    position: sIdx,
    items: {
      create: grouped.get(trade)!.map((item, iIdx) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        isMaterial: false,
        trade,
        position: iIdx,
      })),
    },
  }));

  // Build notes from alternates + disclaimers
  const alternates = data.lineItems.filter((li) => li.isAlternate);
  const notesParts: string[] = [];
  if (alternates.length > 0) {
    notesParts.push("OPTIONS / ALTERNATES");
    for (const alt of alternates) {
      const total = alt.quantity * alt.unitPrice;
      notesParts.push(`- ${alt.description}: $${total.toFixed(2)}`);
    }
  }
  if (data.quote.disclaimers.length > 0) {
    if (notesParts.length > 0) notesParts.push("");
    notesParts.push("DISCLAIMERS");
    for (const d of data.quote.disclaimers) notesParts.push(d);
  }
  const notes = notesParts.length > 0 ? notesParts.join("\n") : null;

  const proposalDate = new Date(data.quote.proposalDate);

  const quote = await prisma.quote.create({
    data: {
      slug: data.quote.slug,
      title: data.quote.title,
      address: data.quote.address,
      projectType: data.quote.projectType,
      status: "sent",
      sentAt: proposalDate,
      createdAt: proposalDate,
      scopeText: `Building NV proposes to perform work for ${data.quote.address} as outlined below.`,
      notes,
      exclusions: data.quote.exclusions,
      paymentTerms: data.quote.paymentTerms,
      materialMarkupPct: 0,
      overheadPct: data.quote.overheadPct,
      profitPct: data.quote.profitPct,
      paddingPct: 0,
      cppBranded: true,
      sections: { create: sectionsCreate },
      quoteCompanies: { create: [{ companyId: company.id, role: "tenant" }] },
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
  console.log(`  subtotal: $${subtotal.toFixed(2)}`);
  console.log(`  OH ${quote.overheadPct}%: $${overhead.toFixed(2)}`);
  console.log(`  profit ${quote.profitPct}%: $${profit.toFixed(2)}`);
  console.log(`  total: $${total.toFixed(2)}  (stated: $${data.reviewFlags.statedTotal.toFixed(2)})`);
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
