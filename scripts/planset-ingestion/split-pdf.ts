import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, basename } from "path";

const OUTPUT_DIR = resolve(__dirname, "output");

export function splitPdf(pdfPath: string): string[] {
  const pdfName = basename(pdfPath, ".pdf").replace(/\s+/g, "_");
  const pageDir = resolve(OUTPUT_DIR, pdfName);

  if (!existsSync(pageDir)) {
    mkdirSync(pageDir, { recursive: true });
  }

  console.log(`Splitting ${pdfPath} into page images...`);

  execFileSync("pdftoppm", [
    "-png",
    "-r", "200",
    pdfPath,
    resolve(pageDir, pdfName),
  ], { stdio: "inherit" });

  const files = readdirSync(pageDir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => resolve(pageDir, f));

  console.log(`Split into ${files.length} page images in ${pageDir}`);
  return files;
}

if (require.main === module) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npx tsx scripts/planset-ingestion/split-pdf.ts <path-to-pdf>");
    process.exit(1);
  }
  splitPdf(pdfPath);
}
