/**
 * Extracts a CPP proposal PDF into a JSON intermediate for human review before seeding.
 *
 * Usage: npx tsx scripts/import-cpp-proposal/extract.ts <pdf-path>
 *
 * Output: outputs/cpp-imports/<slug>.json
 */

import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_MODEL, EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL_SCHEMA } from "./prompts";
import { deriveSlug, isKnownTrade } from "./trade-mapping";
import type { ExtractionResult } from "./types";

const OUT_DIR = "outputs/cpp-imports";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("usage: tsx scripts/import-cpp-proposal/extract.ts <pdf-path>");
    process.exit(1);
  }

  const absPath = resolve(pdfPath);
  if (!existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const pdfBytes = readFileSync(absPath);
  const pdfBase64 = pdfBytes.toString("base64");
  console.log(`Loaded ${basename(pdfPath)} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
  console.log(`Calling ${EXTRACTION_MODEL}...\n`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 8192,
    tools: [EXTRACTION_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "record_proposal" },
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
        },
        { type: "text", text: "Extract this proposal." },
      ],
    }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    console.error("Model did not return a tool_use block. Full response:");
    console.error(JSON.stringify(response, null, 2));
    process.exit(1);
  }

  const extracted = toolUse.input as {
    customerCompany: string;
    address: string;
    proposalDate: string;
    projectType: string;
    overheadPct: number;
    profitPct: number;
    paymentTerms: string;
    exclusions: string;
    disclaimers: string[];
    statedTotal: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      tradeTag: string;
      isAlternate: boolean;
    }>;
  };

  const slug = deriveSlug(extracted.address, extracted.projectType);

  const subtotal = extracted.lineItems
    .filter((li) => !li.isAlternate)
    .reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const overhead = subtotal * (extracted.overheadPct / 100);
  const profit = subtotal * (extracted.profitPct / 100);
  const computedTotal = round2(subtotal + overhead + profit);

  const totalMismatch = Math.abs(computedTotal - extracted.statedTotal) > 1.0;
  const unknownTrades = Array.from(new Set(
    extracted.lineItems.map((li) => li.tradeTag).filter((t) => !isKnownTrade(t)),
  ));

  const result: ExtractionResult = {
    source: {
      pdfPath: absPath,
      extractedAt: new Date().toISOString(),
      model: EXTRACTION_MODEL,
    },
    quote: {
      slug,
      title: `${extracted.address} — ${extracted.projectType}`,
      address: extracted.address,
      projectType: extracted.projectType,
      proposalDate: extracted.proposalDate,
      customerCompany: extracted.customerCompany,
      overheadPct: extracted.overheadPct,
      profitPct: extracted.profitPct,
      paymentTerms: extracted.paymentTerms,
      exclusions: extracted.exclusions,
      disclaimers: extracted.disclaimers,
    },
    lineItems: extracted.lineItems.map((li) => ({
      ...li,
      tradeTag: isKnownTrade(li.tradeTag) ? li.tradeTag : "other",
    })),
    reviewFlags: {
      totalMismatch,
      statedTotal: extracted.statedTotal,
      computedTotal,
      unknownTrades,
    },
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const outPath = `${OUT_DIR}/${slug}.json`;
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`✓ Extracted ${result.lineItems.length} line items`);
  console.log(`  customer: ${result.quote.customerCompany}`);
  console.log(`  address: ${result.quote.address}`);
  console.log(`  date: ${result.quote.proposalDate}`);
  console.log(`  subtotal: $${subtotal.toFixed(2)}`);
  console.log(`  OH ${extracted.overheadPct}%: $${overhead.toFixed(2)}`);
  console.log(`  profit ${extracted.profitPct}%: $${profit.toFixed(2)}`);
  console.log(`  computed total: $${computedTotal.toFixed(2)}`);
  console.log(`  stated total:   $${extracted.statedTotal.toFixed(2)}`);
  if (totalMismatch) {
    console.log(`  ⚠ TOTAL MISMATCH — review JSON before seeding`);
  }
  if (unknownTrades.length > 0) {
    console.log(`  ⚠ UNKNOWN TRADES: ${unknownTrades.join(", ")} — fixed to "other" in JSON`);
  }
  console.log(`\nWrote ${outPath}`);
  console.log(`Next: review the JSON, then run:`);
  console.log(`  npx tsx scripts/import-cpp-proposal/seed.ts ${outPath}`);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
