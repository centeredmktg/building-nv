"use client";

import { useDroppable } from "@dnd-kit/core";
import { CRMProject } from "@/lib/crmTypes";
import LeadCard from "./LeadCard";

interface KanbanColumnProps {
  id: string;
  label: string;
  projects: CRMProject[];
  onCardClick: (project: CRMProject) => void;
}

export default function KanbanColumn({ id, label, projects, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col min-w-[220px] w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-muted text-xs font-semibold uppercase tracking-widest">
          {label}
        </h3>
        <span className="text-text-muted text-xs bg-surface-2 px-2 py-0.5 rounded-full">
          {projects.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 min-h-[80px] rounded-sm p-2 transition-colors ${
          isOver ? "bg-surface-2/60" : "bg-transparent"
        }`}
      >
        {projects.map((p) => (
          <LeadCard key={p.id} project={p} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
