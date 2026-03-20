"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CRMProject, JobProject } from "@/lib/crmTypes";
import { isAtRisk } from "@/lib/projectFinancials";

type AnyProject = CRMProject | JobProject;

interface LeadCardProps {
  project: AnyProject;
  onClick: (project: AnyProject) => void;
  onActivate?: (project: AnyProject) => void;
}

function isJobProject(p: AnyProject): p is JobProject {
  return "milestones" in p;
}

export default function LeadCard({ project, onClick, onActivate }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const primaryContact = project.projectContacts?.[0]?.contact;
  const primaryCompany = project.projectCompanies?.[0]?.company;
  const date = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const atRisk = isJobProject(project) && isAtRisk(project);

  const acceptedQuote = (project as any).quotes?.find(
    (q: { status: string; sections: { items: { quantity: number; unitPrice: number; isMaterial: boolean }[] }[] }) =>
      q.status === "accepted"
  );

  const quoteTotal = acceptedQuote
    ? acceptedQuote.sections
        .flatMap((s: { items: { quantity: number; unitPrice: number }[] }) => s.items)
        .reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0)
    : null;

  const formattedClose = project.estimatedCloseDate
    ? new Date(project.estimatedCloseDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick(project)}
      className="bg-surface-2 border border-border rounded-sm p-3 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
    >
      <p className="text-text-primary font-semibold text-sm leading-tight">{project.name}</p>
      {atRisk && (
        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-400">
          ⚠ At Risk
        </span>
      )}
      {primaryCompany && (
        <p className="text-text-muted text-xs mt-0.5">{primaryCompany.name}</p>
      )}
      {primaryContact && (
        <p className="text-accent text-xs mt-1">
          {primaryContact.firstName} {primaryContact.lastName}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <p className="text-text-muted text-xs">{project.projectType ?? "—"}</p>
        <p className="text-text-muted text-xs">{date}</p>
      </div>
      {(formattedClose || quoteTotal !== null) && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-text-muted text-xs">
            {quoteTotal !== null
              ? `$${quoteTotal.toLocaleString()}`
              : "—"}
          </span>
          <span className="text-text-muted text-xs">
            {formattedClose ? `Est. Close: ${formattedClose}` : "—"}
          </span>
        </div>
      )}
      {project.stage === "contract_signed" && onActivate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onActivate(project);
          }}
          className="mt-2 w-full text-xs bg-accent text-white rounded-sm py-1 px-2 hover:bg-accent/90 transition-colors"
        >
          Activate Job →
        </button>
      )}
    </div>
  );
}
