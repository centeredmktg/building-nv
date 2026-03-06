import { generateQuoteSlug } from "@/lib/slug";

describe("generateQuoteSlug", () => {
  it("generates a slug with date prefix", () => {
    const slug = generateQuoteSlug("Hallmark LLC", "50 Freeport #1-8");
    expect(slug).toMatch(/^\d{4}-\d{2}-\d{2}-/);
  });

  it("lowercases and hyphenates client name", () => {
    const slug = generateQuoteSlug("Hallmark LLC", "50 Freeport");
    expect(slug).toContain("hallmark-llc");
  });

  it("lowercases and hyphenates address", () => {
    const slug = generateQuoteSlug("Acme", "50 Freeport #1-8");
    expect(slug).toContain("50-freeport-1-8");
  });

  it("removes special characters except hyphens", () => {
    const slug = generateQuoteSlug("Smith & Sons, Inc.", "123 Main St.");
    expect(slug).not.toMatch(/[&,\.]/);
  });
});
