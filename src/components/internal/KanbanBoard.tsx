"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CRMProject, STAGES, StageId } from "@/lib/crmTypes";
import KanbanColumn from "./KanbanColumn";
import LeadPanel from "./LeadPanel";

export default function KanbanBoard({ initialProjects }: { initialProjects: CRMProject[] }) {
  const [projects, setProjects] = useState<CRMProject[]>(initialProjects);
  const [selected, setSelected] = useState<CRMProject | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const projectId = active.id as string;
    const newStage = over.id as StageId;
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, stage: newStage } : p))
    );
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  };

  const handleNotesUpdate = (id: string, notes: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, notes } : p)));
    setSelected((prev) => (prev?.id === id ? { ...prev, notes } : prev));
  };

  const handleStageChange = (id: string, stage: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stage: stage as StageId } : p))
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, stage: stage as StageId } : prev));
  };

  const openCount = projects.filter(
    (p) => p.stage !== "contract_signed" && p.stage !== "closed_lost"
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Pipeline</h1>
          <p className="text-text-muted text-sm mt-0.5">
            <span className="text-accent font-semibold">{openCount}</span> open bids
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 w-max pb-6">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                id={stage.id}
                label={stage.label}
                projects={projects.filter((p) => p.stage === stage.id)}
                onCardClick={setSelected}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {selected && (
        <LeadPanel
          project={selected}
          onClose={() => setSelected(null)}
          onNotesUpdate={handleNotesUpdate}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  );
}
