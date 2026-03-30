import { buildChatContext, findDirectRuleMatch } from "@/lib/compliance/chatbot";
import type { ComplianceRule } from "@/lib/compliance/types";

const demoRule: ComplianceRule = {
  id: "osha-engineering-survey",
  title: "Engineering Survey Required Before Demolition",
  severity: "BLOCK",
  citation: "29 CFR 1926.850(a)",
  domain: "osha",
  triggers: { scope_keywords: ["demolition", "demo", "tear-out"], project_types: [], conditions: [] },
  action: "Obtain engineering survey from licensed PE",
  body: "OSHA requires an engineering survey before demo work begins.",
};

const adaRule: ComplianceRule = {
  id: "ada-path-of-travel",
  title: "ADA Path of Travel",
  severity: "WARNING",
  citation: "28 CFR 36.402",
  domain: "ada",
  triggers: { scope_keywords: ["restroom", "bathroom"], project_types: [], conditions: ["restroom_in_scope"] },
  action: "Verify path of travel meets ADA requirements",
  body: "ADA path of travel requirements for altered areas.",
};

const rules = [demoRule, adaRule];

const keywordIndex = new Map<string, string[]>([
  ["demolition", ["osha-engineering-survey"]],
  ["demo", ["osha-engineering-survey"]],
  ["tear-out", ["osha-engineering-survey"]],
  ["restroom", ["ada-path-of-travel"]],
  ["bathroom", ["ada-path-of-travel"]],
]);

describe("chatbot", () => {
  describe("findDirectRuleMatch", () => {
    it("returns a rule when the message contains a trigger keyword", () => {
      const result = findDirectRuleMatch("do I need an engineering survey for demo?", rules, keywordIndex);
      expect(result).toBeDefined();
      expect(result!.id).toBe("osha-engineering-survey");
    });

    it("returns null when no keywords match", () => {
      const result = findDirectRuleMatch("what color should I paint the walls?", rules, keywordIndex);
      expect(result).toBeNull();
    });

    it("is case-insensitive", () => {
      const result = findDirectRuleMatch("DEMOLITION requirements?", rules, keywordIndex);
      expect(result).toBeDefined();
      expect(result!.id).toBe("osha-engineering-survey");
    });
  });

  describe("buildChatContext", () => {
    it("includes the rule body when a direct match is found", () => {
      const ctx = buildChatContext(demoRule, []);
      expect(ctx).toContain("OSHA requires");
      expect(ctx).toContain("29 CFR 1926.850(a)");
    });

    it("includes vector search results as additional context", () => {
      const chunks = [
        { id: "a-0", sourceId: "a", sourceType: "reference" as const, text: "Additional safety info", embedding: [] },
      ];
      const ctx = buildChatContext(null, chunks);
      expect(ctx).toContain("Additional safety info");
    });
  });
});
