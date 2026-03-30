import { matchRules } from "@/lib/compliance/rule-engine";
import type { ComplianceRule, ProjectContext } from "@/lib/compliance/types";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const demoRule: ComplianceRule = {
  id: "osha-engineering-survey",
  title: "Engineering Survey Required Before Demolition",
  severity: "BLOCK",
  citation: "29 CFR 1926.850(a)",
  domain: "osha",
  triggers: {
    scope_keywords: ["demolition", "demo", "tear-out"],
    project_types: [],
    conditions: [],
  },
  action: "Obtain engineering survey from licensed PE",
  body: "OSHA requires...",
};

const adaRule: ComplianceRule = {
  id: "ada-path-of-travel",
  title: "ADA Path of Travel",
  severity: "WARNING",
  citation: "28 CFR 36.402",
  domain: "ada",
  triggers: {
    scope_keywords: ["restroom", "bathroom", "lavatory"],
    project_types: [],
    conditions: ["restroom_in_scope"],
  },
  action: "Verify path of travel meets ADA requirements",
  body: "When a primary function area is altered...",
};

const prevailingWageRule: ComplianceRule = {
  id: "nrs338-prevailing-wage",
  title: "Prevailing Wage for Public Works",
  severity: "BLOCK",
  citation: "NRS 338.020",
  domain: "nrs338",
  triggers: {
    scope_keywords: ["government"],
    project_types: [],
    conditions: ["government_tenant"],
  },
  action: "Ensure prevailing wage compliance",
  body: "Public works projects...",
};

const bidLimitRule: ComplianceRule = {
  id: "nrs624-bid-limit",
  title: "NRS 624 Bid Limit",
  severity: "BLOCK",
  citation: "NRS 624.220",
  domain: "nrs624",
  triggers: {
    scope_keywords: [],
    project_types: [],
    conditions: ["contract_above_bid_limit"],
  },
  action: "Contract exceeds bid limit",
  body: "Cannot exceed...",
};

const tiOnlyRule: ComplianceRule = {
  id: "ti-specific",
  title: "TI-Specific Rule",
  severity: "INFO",
  citation: "Test",
  domain: "test",
  triggers: {
    scope_keywords: ["flooring"],
    project_types: ["tenant_improvement"],
    conditions: [],
  },
  action: "TI-specific action",
  body: "Only applies to TI...",
};

const allRules = [demoRule, adaRule, prevailingWageRule, bidLimitRule, tiOnlyRule];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rule-engine", () => {
  describe("keyword matching", () => {
    it("matches rules when scope contains a trigger keyword", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Demolition", items: [{ description: "Demo existing partition walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });

    it("matches on item description, not just section title", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Interior Work", items: [{ description: "Tear-out existing cabinetry" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });

    it("is case-insensitive", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "DEMOLITION PHASE", items: [{ description: "Remove walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });

    it("does not match when no keywords present", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Painting", items: [{ description: "Paint all walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).not.toContain("osha-engineering-survey");
    });
  });

  describe("condition matching", () => {
    it("matches government_tenant condition", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        companyRoles: [{ type: "government", role: "tenant" }],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("nrs338-prevailing-wage");
    });

    it("matches contract_above_bid_limit condition", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        contractAmount: 1_500_000,
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("nrs624-bid-limit");
    });

    it("does not match contract_above_bid_limit when under limit", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        contractAmount: 500_000,
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).not.toContain("nrs624-bid-limit");
    });

    it("matches restroom_in_scope condition when restroom keyword found", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Restroom Renovation", items: [{ description: "Install new fixtures" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("ada-path-of-travel");
    });
  });

  describe("project type filtering", () => {
    it("matches when project type is in the rule's list", () => {
      const ctx: ProjectContext = {
        projectType: "tenant_improvement",
        scopeSections: [
          { title: "Flooring", items: [{ description: "Install LVT flooring" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("ti-specific");
    });

    it("does not match when project type is not in the rule's list", () => {
      const ctx: ProjectContext = {
        projectType: "residential",
        scopeSections: [
          { title: "Flooring", items: [{ description: "Install LVT flooring" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).not.toContain("ti-specific");
    });

    it("matches rules with empty project_types against any project type", () => {
      const ctx: ProjectContext = {
        projectType: "any-type-at-all",
        scopeSections: [
          { title: "Demo", items: [{ description: "Remove walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const ids = matches.map((m) => m.rule.id);
      expect(ids).toContain("osha-engineering-survey");
    });
  });

  describe("deduplication", () => {
    it("deduplicates when the same rule matches multiple scope items", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Demolition Phase 1", items: [{ description: "Demo north wing" }] },
          { title: "Demolition Phase 2", items: [{ description: "Demo south wing" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const demoMatches = matches.filter((m) => m.rule.id === "osha-engineering-survey");
      expect(demoMatches).toHaveLength(1);
      expect(demoMatches[0].matchedOn.length).toBeGreaterThan(1);
    });
  });

  describe("matchedOn tracking", () => {
    it("records which keywords triggered the match", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [
          { title: "Demolition", items: [{ description: "Tear-out existing walls" }] },
        ],
      };
      const matches = matchRules(allRules, ctx);
      const demoMatch = matches.find((m) => m.rule.id === "osha-engineering-survey");
      expect(demoMatch).toBeDefined();
      expect(demoMatch!.matchedOn).toContain("keyword:demolition");
      expect(demoMatch!.matchedOn).toContain("keyword:tear-out");
    });

    it("records conditions in matchedOn", () => {
      const ctx: ProjectContext = {
        projectType: "Office Buildout",
        scopeSections: [{ title: "General", items: [] }],
        companyRoles: [{ type: "government", role: "tenant" }],
      };
      const matches = matchRules(allRules, ctx);
      const wageMatch = matches.find((m) => m.rule.id === "nrs338-prevailing-wage");
      expect(wageMatch).toBeDefined();
      expect(wageMatch!.matchedOn).toContain("condition:government_tenant");
    });
  });
});
