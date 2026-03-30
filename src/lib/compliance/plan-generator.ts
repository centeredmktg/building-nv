import { matchRules } from "./rule-engine";
import type {
  ComplianceRule,
  ProjectContext,
  GeneratedPlan,
  GeneratedTask,
} from "./types";

interface TaskTemplate {
  name: string;
  durationDays: number;
}

const TRADE_TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  demolition: [
    { name: "Site protection & containment", durationDays: 1 },
    { name: "Selective demolition per scope", durationDays: 3 },
    { name: "Debris removal & haul-off", durationDays: 1 },
  ],
  framing: [
    { name: "Layout & snap lines", durationDays: 1 },
    { name: "Frame partition walls", durationDays: 4 },
    { name: "Install door frames & headers", durationDays: 1 },
  ],
  electrical: [
    { name: "Rough-in electrical per plan", durationDays: 3 },
    { name: "Install panels & circuits", durationDays: 2 },
  ],
  plumbing: [
    { name: "Rough-in plumbing per plan", durationDays: 3 },
    { name: "Install fixtures", durationDays: 2 },
  ],
  hvac: [
    { name: "HVAC rough-in & ductwork", durationDays: 3 },
    { name: "Equipment installation", durationDays: 2 },
  ],
  drywall: [
    { name: "Hang drywall", durationDays: 3 },
    { name: "Tape, mud & sand", durationDays: 3 },
  ],
  painting: [
    { name: "Surface prep & priming", durationDays: 1 },
    { name: "Paint application — 2 coats", durationDays: 3 },
  ],
  flooring: [
    { name: "Subfloor preparation", durationDays: 1 },
    { name: "Install flooring", durationDays: 4 },
    { name: "Install cove base & transitions", durationDays: 1 },
  ],
  ceiling: [
    { name: "Install ceiling grid", durationDays: 2 },
    { name: "Set ceiling tiles", durationDays: 1 },
  ],
  tile: [
    { name: "Substrate prep & waterproofing", durationDays: 1 },
    { name: "Set tile", durationDays: 4 },
    { name: "Grout & seal", durationDays: 1 },
  ],
  cabinets: [
    { name: "Install cabinets", durationDays: 3 },
    { name: "Install countertops", durationDays: 2 },
  ],
  roofing: [
    { name: "Roof tear-off", durationDays: 2 },
    { name: "Install roofing system", durationDays: 4 },
  ],
  insulation: [
    { name: "Install insulation", durationDays: 2 },
  ],
};

const DEFAULT_TASKS: TaskTemplate[] = [
  { name: "Execute scope of work", durationDays: 4 },
];

function lookupTasks(sectionTitle: string): { phase: string; tasks: TaskTemplate[] } {
  const lower = sectionTitle.toLowerCase().trim();
  for (const [trade, tasks] of Object.entries(TRADE_TASK_TEMPLATES)) {
    if (lower.includes(trade) || trade.includes(lower)) {
      return { phase: lower, tasks };
    }
  }
  return { phase: lower, tasks: DEFAULT_TASKS };
}

function buildTaskSkeleton(sections: ProjectContext["scopeSections"]): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  let position = 0;
  let prevPhaseLastPosition = -1;

  for (const section of sections) {
    const { phase, tasks: templates } = lookupTasks(section.title);
    const phaseStartPosition = position;

    for (const template of templates) {
      const deps: number[] = [];
      if (position === phaseStartPosition && prevPhaseLastPosition >= 0) {
        deps.push(prevPhaseLastPosition);
      }
      if (position > phaseStartPosition) {
        deps.push(position - 1);
      }

      tasks.push({
        name: template.name,
        phase,
        position,
        durationDays: template.durationDays,
        startDay: 0,
        endDay: 0,
        dependsOnPositions: deps,
        isMilestoneTask: false,
        isCriticalPath: false,
        complianceFlags: [],
      });
      position++;
    }
    prevPhaseLastPosition = position - 1;
  }

  return tasks;
}

function injectComplianceFlags(
  tasks: GeneratedTask[],
  rules: ComplianceRule[],
  ctx: ProjectContext
): GeneratedTask[] {
  const matches = matchRules(rules, ctx);

  for (const match of matches) {
    const targetPhase = match.matchedTask?.toLowerCase().trim();
    let targetTask = targetPhase
      ? tasks.find((t) => t.phase === targetPhase)
      : tasks[0];
    if (!targetTask) targetTask = tasks[0];
    if (!targetTask) continue;

    const flag = {
      ruleId: match.rule.id,
      severity: match.rule.severity,
      title: match.rule.title,
      citation: match.rule.citation,
      actionItem: match.rule.action,
    };

    targetTask.complianceFlags.push(flag);

    if (match.rule.severity === "BLOCK") {
      const resolveTask: GeneratedTask = {
        name: `Resolve: ${match.rule.action}`,
        phase: targetTask.phase,
        position: -1, // placeholder — rebuildDependencies will assign
        durationDays: 0,
        startDay: 0,
        endDay: 0,
        dependsOnPositions: [...targetTask.dependsOnPositions],
        isMilestoneTask: false,
        isCriticalPath: false,
        complianceFlags: [],
      };

      const targetIdx = tasks.indexOf(targetTask);
      tasks.splice(targetIdx, 0, resolveTask);
    }
  }

  rebuildDependencies(tasks);
  return tasks;
}

function rebuildDependencies(tasks: GeneratedTask[]): void {
  let prevPhaseLastIdx = -1;
  let currentPhase = "";
  let phaseStartIdx = 0;

  for (let i = 0; i < tasks.length; i++) {
    tasks[i].position = i;

    if (tasks[i].phase !== currentPhase) {
      if (currentPhase !== "") {
        prevPhaseLastIdx = i - 1;
      }
      currentPhase = tasks[i].phase;
      phaseStartIdx = i;
    }

    const deps: number[] = [];
    if (i === phaseStartIdx && prevPhaseLastIdx >= 0) {
      deps.push(prevPhaseLastIdx);
    }
    if (i > phaseStartIdx) {
      deps.push(i - 1);
    }
    tasks[i].dependsOnPositions = deps;
  }
}

function computeCriticalPath(tasks: GeneratedTask[]): {
  totalDurationDays: number;
  criticalPath: string[];
} {
  const n = tasks.length;
  if (n === 0) return { totalDurationDays: 0, criticalPath: [] };

  // Forward pass: earliest start/end
  for (const task of tasks) {
    let earliestStart = 0;
    for (const depPos of task.dependsOnPositions) {
      const dep = tasks[depPos];
      if (dep) earliestStart = Math.max(earliestStart, dep.endDay);
    }
    task.startDay = earliestStart;
    task.endDay = earliestStart + task.durationDays;
  }

  const totalDuration = Math.max(...tasks.map((t) => t.endDay));

  // Backward pass
  const latestEnd = new Array(n).fill(totalDuration);
  const latestStart = new Array(n).fill(0);

  const dependedOnBy: number[][] = Array.from({ length: n }, () => []);
  for (const task of tasks) {
    for (const depPos of task.dependsOnPositions) {
      if (depPos >= 0 && depPos < n) {
        dependedOnBy[depPos].push(task.position);
      }
    }
  }

  for (let i = n - 1; i >= 0; i--) {
    const successors = dependedOnBy[i];
    if (successors.length === 0) {
      latestEnd[i] = totalDuration;
    } else {
      latestEnd[i] = Math.min(...successors.map((s) => latestStart[s]));
    }
    latestStart[i] = latestEnd[i] - tasks[i].durationDays;
  }

  const criticalPath: string[] = [];
  for (let i = 0; i < n; i++) {
    if (tasks[i].startDay === latestStart[i] && tasks[i].durationDays > 0) {
      tasks[i].isCriticalPath = true;
      criticalPath.push(tasks[i].name);
    }
  }

  return { totalDurationDays: totalDuration, criticalPath };
}

export function generatePlan(
  rules: ComplianceRule[],
  ctx: ProjectContext
): GeneratedPlan {
  let tasks = buildTaskSkeleton(ctx.scopeSections);
  tasks = injectComplianceFlags(tasks, rules, ctx);
  const { totalDurationDays, criticalPath } = computeCriticalPath(tasks);
  return { tasks, totalDurationDays, criticalPath };
}
