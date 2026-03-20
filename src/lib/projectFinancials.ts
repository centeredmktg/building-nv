import type { JobProject } from "@/lib/crmTypes";

export type MarginResult = { dollars: number; percent: number };

const AT_RISK_STAGES = new Set(["preconstruction", "active", "punch_list"]);

export function computeMargin(
  contractAmount: number | null | undefined,
  targetCostAmount: number | null | undefined
): MarginResult | null {
  if (!contractAmount || targetCostAmount == null) return null;
  const dollars = contractAmount - targetCostAmount;
  return { dollars, percent: (dollars / contractAmount) * 100 };
}

export function isAtRisk(project: JobProject): boolean {
  if (!AT_RISK_STAGES.has(project.stage)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return project.milestones.some(
    (m) => m.plannedDate !== null && m.completedAt === null && new Date(m.plannedDate) < today
  );
}
