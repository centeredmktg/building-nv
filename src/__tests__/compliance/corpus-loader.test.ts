import path from "path";
import { loadCorpus, getKeywordIndex, getRule, getAllRules } from "@/lib/compliance/corpus-loader";

const RULES_DIR = path.join(process.cwd(), "src/data/compliance/rules");
const REFERENCE_DIR = path.join(process.cwd(), "src/data/compliance/reference");

describe("corpus-loader", () => {
  beforeAll(() => {
    loadCorpus(RULES_DIR, REFERENCE_DIR);
  });

  it("loads all rule files from the rules directory", () => {
    const rules = getAllRules();
    expect(rules.length).toBeGreaterThanOrEqual(20);
  });

  it("parses frontmatter correctly for a known rule", () => {
    const rule = getRule("osha-engineering-survey");
    expect(rule).toBeDefined();
    expect(rule!.title).toBe("Engineering Survey Required Before Demolition");
    expect(rule!.severity).toBe("BLOCK");
    expect(rule!.citation).toBe("29 CFR 1926.850(a)");
    expect(rule!.domain).toBe("osha");
    expect(rule!.triggers.scope_keywords).toContain("demolition");
    expect(rule!.triggers.scope_keywords).toContain("demo");
    expect(rule!.action).toContain("engineering survey");
    expect(rule!.body).toContain("OSHA requires");
  });

  it("builds keyword index mapping keywords to rule IDs", () => {
    const index = getKeywordIndex();
    expect(index.get("demolition")).toContain("osha-engineering-survey");
    expect(index.get("demo")).toContain("osha-engineering-survey");
    expect(index.get("restroom")).toContain("ada-path-of-travel");
    expect(index.get("restroom")).toContain("ada-changing-table");
  });

  it("handles rules with empty scope_keywords (condition-only rules)", () => {
    const rule = getRule("nrs108-preliminary-lien-notice");
    expect(rule).toBeDefined();
    expect(rule!.triggers.scope_keywords).toEqual([]);
    expect(rule!.triggers.conditions).toContain("contract_above_100k");
  });

  it("returns undefined for unknown rule IDs", () => {
    expect(getRule("nonexistent-rule")).toBeUndefined();
  });
});
