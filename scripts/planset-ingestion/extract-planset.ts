import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { splitPdf } from "./split-pdf";
import { SHEET_CLASSIFIER_PROMPT, SCOPE_EXTRACTION_PROMPT } from "./prompts";
import { ClassifiedSheet } from "./types";

const client = new Anthropic();

async function classifySheet(imagePath: string): Promise<{ sheetNumber: string; sheetType: string; title: string }> {
  const base64 = readFileSync(imagePath).toString("base64");
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
        { type: "text", text: SHEET_CLASSIFIER_PROMPT },
      ],
    }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try { return JSON.parse(text); }
  catch { return { sheetNumber: "unknown", sheetType: "unknown", title: "unknown" }; }
}

async function extractScope(imagePath: string, sheetType: string) {
  const base64 = readFileSync(imagePath).toString("base64");
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
        { type: "text", text: `Sheet type: ${sheetType}\n\n${SCOPE_EXTRACTION_PROMPT}` },
      ],
    }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try { return JSON.parse(text); }
  catch { return { items: [] }; }
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npx tsx scripts/planset-ingestion/extract-planset.ts <path-to-pdf>");
    process.exit(1);
  }

  console.log("Step 1: Splitting PDF...");
  const pageImages = splitPdf(pdfPath);

  console.log("\nStep 2: Classifying sheets...");
  const classified: ClassifiedSheet[] = [];
  for (let i = 0; i < pageImages.length; i++) {
    const result = await classifySheet(pageImages[i]);
    classified.push({
      pageNumber: i + 1,
      sheetNumber: result.sheetNumber,
      sheetType: result.sheetType as ClassifiedSheet["sheetType"],
      title: result.title,
      imagePath: pageImages[i],
    });
    console.log(`  Page ${i + 1}: ${result.sheetNumber} — ${result.title} (${result.sheetType})`);
  }

  console.log("\nStep 3: Extracting scope...");
  const scopeTypes = ["demo_plan", "proposed_plan", "keynotes", "electrical", "interior_design"];
  const scopeSheets = classified.filter((s) => scopeTypes.includes(s.sheetType));
  const allItems: Array<Record<string, unknown>> = [];

  for (const sheet of scopeSheets) {
    const result = await extractScope(sheet.imagePath, sheet.sheetType);
    const items = result.items.map((item: Record<string, unknown>) => ({ ...item, sourceSheet: sheet.sheetNumber }));
    allItems.push(...items);
    console.log(`  ${sheet.sheetNumber}: ${result.items.length} items`);
  }

  const outputPath = pdfPath.replace(/\.pdf$/i, "-extraction.json");
  writeFileSync(outputPath, JSON.stringify({ sheets: classified, items: allItems }, null, 2));
  console.log(`\n=== EXTRACTION COMPLETE ===`);
  console.log(`  ${allItems.length} items from ${scopeSheets.length} sheets`);
  console.log(`  Trades: ${[...new Set(allItems.map((i) => i.trade))].join(", ")}`);
  console.log(`  Saved to: ${outputPath}`);
  console.log(`\nNext: Review extraction, add pricing, create typed extraction-data file.`);
}

main().catch(console.error);
