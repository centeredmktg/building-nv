import { generatePlan } from "@/lib/compliance/plan-generator";
import type { ComplianceRule, ProjectContext, GeneratedPlan } from "@/lib/compliance/types";

const demoRule: ComplianceRule = {
  id: "osha-engineering-survey",
  title: "Engineering Survey Required Before Demolition",
  severity: "BLOCK",
  citation: "29 CFR 1926.850(a)",
  domain: "osha",
  triggers: { scope_keywords: ["demolition", "demo"], project_types: [], conditions: [] },
  action: "Obtain engineering survey from licensed PE",
  body: "",
};

const permitRule: ComplianceRule = {
  id: "washoe-building-permit",
  title: "Building Permit Required",
  severity: "BLOCK",
  citation: "Washoe County Building Code",
  domain: "washoe",
  triggers: { scope_keywords: ["framing", "wall", "partition"], project_types: [], conditions: [] },
  action: "Obtain building permit before structural work",
  body: "",
};

const infoRule: ComplianceRule = {
  id: "nrs108-notice-of-completion",
  title: "Track Notice of Completion",
  severity: "INFO",
  citation: "NRS 108.228",
  domain: "nrs108",
  triggers: { scope_keywords: [], project_types: [], conditions: [] },
  action: "Monitor for NoC filing",
  body: "",
};

const rules = [demoRule, permitRule, infoRule];

const baseContext: ProjectContext = {
  projectType: "Office Buildout",
  scopeSections: [
    {
      title: "Demolition",
      items: [
        { description: "Demo existing partition walls" },
        { description: "Remove ceiling tiles" },
      ],
    },
    {
      title: "Framing",
      items: [
        { description: "Frame new partition walls per plan" },
        { description: "Install door frames" },
      ],
    },
    {
      title: "Painting",
      items: [
        { description: "Paint all new walls - 2 coats" },
      ],
    },
  ],
};

describe("plan-generator", () => {
  let plan: GeneratedPlan;

  beforeAll(() => {
    plan = generatePlan(rules, baseContext);
  });

  describe("task skeleton generation", () => {
    it("creates tasks for each scope section", () => {
      const phases = [...new Set(plan.tasks.map((t) => t.phase))];
      expect(phases).toContain("demolition");
      expect(phases).toContain("framing");
      expect(phases).toContain("painting");
    });

    it("assigns sequential positions", () => {
      const positions = plan.tasks.map((t) => t.position);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it("assigns positive durations to all tasks (excluding Resolve: tasks)", () => {
      for (const task of plan.tasks) {
        if (task.name.startsWith("Resolve:")) continue;
        expect(task.durationDays).toBeGreaterThan(0);
      }
    });
  });

  describe("dependency wiring", () => {
    it("makes later phases depend on earlier phases", () => {
      const framingTasks = plan.tasks.filter((t) => t.phase === "framing");
      const demoTasks = plan.tasks.filter((t) => t.phase === "demolition");
      const demoPositions = demoTasks.map((t) => t.position);
      const hasDepOnDemo = framingTasks.some((t) =>
        t.dependsOnPositions.some((p) => demoPositions.includes(p))
      );
      expect(hasDepOnDemo).toBe(true);
    });
  });

  describe("compliance flag injection", () => {
    it("attaches BLOCK flags to matching tasks", () => {
      const demoTasks = plan.tasks.filter((t) => t.phase === "demolition");
      const hasEngSurveyFlag = demoTasks.some((t) =>
        t.complianceFlags.some((f) => f.ruleId === "osha-engineering-survey")
      );
      expect(hasEngSurveyFlag).toBe(true);
    });

    it("attaches permit flags to framing tasks", () => {
      const framingTasks = plan.tasks.filter((t) => t.phase === "framing");
      const hasPermitFlag = framingTasks.some((t) =>
        t.complianceFlags.some((f) => f.ruleId === "washoe-building-permit")
      );
      expect(hasPermitFlag).toBe(true);
    });

    it("includes severity, citation, and action on flags", () => {
      const flaggedTask = plan.tasks.find((t) =>
        t.complianceFlags.some((f) => f.ruleId === "osha-engineering-survey")
      );
      expect(flaggedTask).toBeDefined();
      const flag = flaggedTask!.complianceFlags.find(
        (f) => f.ruleId === "osha-engineering-survey"
      );
      expect(flag!.severity).toBe("BLOCK");
      expect(flag!.citation).toBe("29 CFR 1926.850(a)");
      expect(flag!.actionItem).toContain("engineering survey");
    });

    it("creates predecessor resolve tasks for BLOCK flags", () => {
      const resolveTasks = plan.tasks.filter((t) => t.name.startsWith("Resolve:"));
      expect(resolveTasks.length).toBeGreaterThan(0);
      for (const t of resolveTasks) {
        expect(t.durationDays).toBe(0);
      }
    });
  });

  describe("critical path computation", () => {
    it("computes totalDurationDays", () => {
      expect(plan.totalDurationDays).toBeGreaterThan(0);
    });

    it("marks at least one task as critical path", () => {
      const criticalTasks = plan.tasks.filter((t) => t.isCriticalPath);
      expect(criticalTasks.length).toBeGreaterThan(0);
    });

    it("critical path includes first and last tasks", () => {
      expect(plan.criticalPath.length).toBeGreaterThan(0);
      const lastCrit = plan.criticalPath[plan.criticalPath.length - 1];
      const lastTask = plan.tasks.find((t) => t.name === lastCrit);
      expect(lastTask).toBeDefined();
      expect(lastTask!.endDay).toBe(plan.totalDurationDays);
    });

    it("startDay and endDay are consistent with dependencies", () => {
      for (const task of plan.tasks) {
        expect(task.endDay).toBe(task.startDay + task.durationDays);
        for (const depPos of task.dependsOnPositions) {
          const dep = plan.tasks.find((t) => t.position === depPos);
          if (dep) {
            expect(task.startDay).toBeGreaterThanOrEqual(dep.endDay);
          }
        }
      }
    });
  });
});
