import { JobProject } from "@/lib/crmTypes";
import { getScheduleHealth, getNextMilestone } from "@/lib/scheduleHealth";
import Link from "next/link";

const STAGE_BADGE: Record<string, string> = {
  preconstruction: "bg-blue-500/20 text-blue-400",
  active: "bg-amber-500/20 text-amber-400",
  punch_list: "bg-orange-500/20 text-orange-400",
  complete: "bg-green-500/20 text-green-400",
};

const STAGE_LABEL: Record<string, string> = {
  preconstruction: "Preconstruction",
  active: "Active",
  punch_list: "Punch List",
  complete: "Complete",
};

const HEALTH_DOT: Record<string, string> = {
  gray: "bg-text-muted",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

function formatDate(val: string | Date | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  return `$${val.toLocaleString()}`;
}

function calcMargin(contractAmount: number | null | undefined, targetCostAmount: number | null | undefined): string {
  if (contractAmount == null || targetCostAmount == null || contractAmount === 0) return "—";
  const margin = ((contractAmount - targetCostAmount) / contractAmount) * 100;
  return `${margin.toFixed(1)}%`;
}

export default function JobCard({ project }: { project: JobProject }) {
  const scheduleHealth = getScheduleHealth(project.milestones);
  const nextMilestone = getNextMilestone(project.milestones);

  return (
    <Link
      href={`/internal/projects/${project.id}`}
      className="block bg-surface-2 border border-border rounded-sm p-4 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-text-primary font-semibold text-sm leading-tight">{project.name}</p>
          <p className="text-text-muted text-xs mt-0.5">
            {project.projectType ?? "No type on file"}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STAGE_BADGE[project.stage] ?? ""}`}>
          {STAGE_LABEL[project.stage] ?? project.stage}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-text-muted text-xs">Contract</p>
          <p className="text-text-primary text-sm font-medium">{formatCurrency(project.contractAmount)}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Margin</p>
          <p className="text-text-primary text-sm font-medium">
            {calcMargin(project.contractAmount, project.targetCostAmount)}
          </p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Uninvoiced</p>
          <p className="text-text-primary text-sm font-medium">
            {project.contractAmount != null
              ? formatCurrency(project.contractAmount - (project.invoicedTotal ?? 0))
              : '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-text-muted shrink-0" title="Budget health (placeholder)" />
          <span className="text-text-muted text-xs">Budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[scheduleHealth]}`}
            title={`Schedule health: ${scheduleHealth}`}
          />
          <span className="text-text-muted text-xs">Schedule</span>
        </div>
      </div>

      <div className="border-t border-border pt-2 flex items-center justify-between">
        <div>
          <p className="text-text-muted text-xs">Next milestone</p>
          <p className="text-text-primary text-xs mt-0.5">
            {nextMilestone
              ? `${nextMilestone.name}${nextMilestone.plannedDate ? ` · ${formatDate(nextMilestone.plannedDate)}` : ""}`
              : "No milestones set"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-text-muted text-xs">Est. completion</p>
          <p className="text-text-primary text-xs mt-0.5">{formatDate(project.estimatedEndDate)}</p>
        </div>
      </div>
    </Link>
  );
}
