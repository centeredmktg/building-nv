import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { ComplianceRule, ReferenceDoc } from "./types";

let rules: Map<string, ComplianceRule> = new Map();
let referenceDocs: ReferenceDoc[] = [];
let keywordIndex: Map<string, string[]> = new Map();
let loaded = false;

const DEFAULT_RULES_DIR = path.join(process.cwd(), "src/data/compliance/rules");
const DEFAULT_REFERENCE_DIR = path.join(process.cwd(), "src/data/compliance/reference");

function parseRuleFile(filePath: string): ComplianceRule | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  if (!data.id || !data.severity || !data.citation) {
    console.warn(`Skipping invalid rule file: ${filePath}`);
    return null;
  }

  return {
    id: data.id,
    title: data.title ?? data.id,
    severity: data.severity as ComplianceRule["severity"],
    citation: data.citation,
    domain: data.domain ?? "unknown",
    triggers: {
      scope_keywords: data.triggers?.scope_keywords ?? [],
      project_types: data.triggers?.project_types ?? [],
      conditions: data.triggers?.conditions ?? [],
    },
    action: data.action ?? "",
    body: content.trim(),
  };
}

function parseReferenceFile(filePath: string): ReferenceDoc | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  if (!data.id) {
    console.warn(`Skipping invalid reference file: ${filePath}`);
    return null;
  }

  return {
    id: data.id,
    title: data.title ?? data.id,
    domain: data.domain ?? "unknown",
    body: content.trim(),
  };
}

function buildKeywordIndex(ruleList: ComplianceRule[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const rule of ruleList) {
    for (const keyword of rule.triggers.scope_keywords) {
      const lower = keyword.toLowerCase();
      const existing = index.get(lower) ?? [];
      existing.push(rule.id);
      index.set(lower, existing);
    }
  }
  return index;
}

export function loadCorpus(
  rulesDir: string = DEFAULT_RULES_DIR,
  referenceDir: string = DEFAULT_REFERENCE_DIR
): void {
  rules = new Map();
  referenceDocs = [];

  if (fs.existsSync(rulesDir)) {
    const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    for (const file of ruleFiles) {
      const rule = parseRuleFile(path.join(rulesDir, file));
      if (rule) rules.set(rule.id, rule);
    }
  }

  if (fs.existsSync(referenceDir)) {
    const refFiles = fs.readdirSync(referenceDir).filter((f) => f.endsWith(".md"));
    for (const file of refFiles) {
      const doc = parseReferenceFile(path.join(referenceDir, file));
      if (doc) referenceDocs.push(doc);
    }
  }

  keywordIndex = buildKeywordIndex(Array.from(rules.values()));
  loaded = true;
}

function ensureLoaded(): void {
  if (!loaded) loadCorpus();
}

export function getAllRules(): ComplianceRule[] {
  ensureLoaded();
  return Array.from(rules.values());
}

export function getRule(id: string): ComplianceRule | undefined {
  ensureLoaded();
  return rules.get(id);
}

export function getKeywordIndex(): Map<string, string[]> {
  ensureLoaded();
  return keywordIndex;
}

export function getAllReferenceDocs(): ReferenceDoc[] {
  ensureLoaded();
  return referenceDocs;
}

export function getRulesByDomain(domain: string): ComplianceRule[] {
  ensureLoaded();
  return Array.from(rules.values()).filter((r) => r.domain === domain);
}
