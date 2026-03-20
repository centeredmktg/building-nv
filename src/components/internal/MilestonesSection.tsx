"use client";

import { useState } from "react";
import { Milestone } from "@/lib/crmTypes";

function toDateInput(val: string | null): string {
  if (!val) return "";
  return val.split("T")[0];
}

export default function MilestonesSection({
  projectId,
  initialMilestones,
}: {
  projectId: string;
  initialMilestones: Milestone[];
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);

  const patchMilestone = async (id: string, data: Partial<Milestone>) => {
    const res = await fetch(`/api/projects/${projectId}/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated: Milestone = await res.json();
      setMilestones((prev) => prev.map((m) => (m.id === id ? updated : m)));
    }
  };

  const deleteMilestone = async (id: string) => {
    await fetch(`/api/projects/${projectId}/milestones/${id}`, { method: "DELETE" });
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const addMilestone = async () => {
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Milestone" }),
    });
    if (res.ok) {
      const created: Milestone = await res.json();
      setMilestones((prev) => [...prev, created]);
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const a = milestones[index];
    const b = milestones[index - 1];
    await Promise.all([
      patchMilestone(a.id, { position: b.position }),
      patchMilestone(b.id, { position: a.position }),
    ]);
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...a, position: b.position };
      next[index - 1] = { ...b, position: a.position };
      return next.sort((x, y) => x.position - y.position);
    });
  };

  const moveDown = async (index: number) => {
    if (index === milestones.length - 1) return;
    const a = milestones[index];
    const b = milestones[index + 1];
    await Promise.all([
      patchMilestone(a.id, { position: b.position }),
      patchMilestone(b.id, { position: a.position }),
    ]);
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...a, position: b.position };
      next[index + 1] = { ...b, position: a.position };
      return next.sort((x, y) => x.position - y.position);
    });
  };

  const toggleComplete = async (m: Milestone) => {
    const completedAt = m.completedAt ? null : new Date().toISOString();
    await patchMilestone(m.id, { completedAt } as any);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text-primary font-semibold text-base">Milestones</h2>
        <button
          onClick={addMilestone}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          + Add Milestone
        </button>
      </div>

      {milestones.length === 0 ? (
        <p className="text-text-muted text-sm">No milestones yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {milestones.map((m, i) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              isFirst={i === 0}
              isLast={i === milestones.length - 1}
              onToggleComplete={() => toggleComplete(m)}
              onNameChange={(name) => patchMilestone(m.id, { name })}
              onDateChange={(plannedDate) => patchMilestone(m.id, { plannedDate } as any)}
              onNotesChange={(notes) => patchMilestone(m.id, { notes })}
              onDelete={() => deleteMilestone(m.id)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MilestoneRow({
  milestone,
  isFirst,
  isLast,
  onToggleComplete,
  onNameChange,
  onDateChange,
  onNotesChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  milestone: Milestone;
  isFirst: boolean;
  isLast: boolean;
  onToggleComplete: () => void;
  onNameChange: (v: string) => void;
  onDateChange: (v: string | null) => void;
  onNotesChange: (v: string | null) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [name, setName] = useState(milestone.name);
  const [notes, setNotes] = useState(milestone.notes ?? "");

  return (
    <div className={`flex items-center gap-2 py-2 border-b border-border/50 ${milestone.completedAt ? "opacity-60" : ""}`}>
      {/* Complete toggle */}
      <input
        type="checkbox"
        checked={!!milestone.completedAt}
        onChange={onToggleComplete}
        className="shrink-0 accent-accent"
      />

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name !== milestone.name) onNameChange(name); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`flex-1 bg-transparent text-sm text-text-primary border-none outline-none hover:bg-surface-2 focus:bg-surface-2 rounded-sm px-1 py-0.5 ${milestone.completedAt ? "line-through text-text-muted" : ""}`}
      />

      {/* Planned date */}
      <input
        type="date"
        defaultValue={toDateInput(milestone.plannedDate)}
        onBlur={(e) => onDateChange(e.target.value || null)}
        className="bg-transparent text-xs text-text-muted border-none outline-none hover:bg-surface-2 focus:bg-surface-2 rounded-sm px-1 py-0.5 w-32"
      />

      {/* Notes */}
      <input
        type="text"
        value={notes}
        placeholder="Notes"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => { if (notes !== (milestone.notes ?? "")) onNotesChange(notes || null); }}
        className="bg-transparent text-xs text-text-muted border-none outline-none hover:bg-surface-2 focus:bg-surface-2 rounded-sm px-1 py-0.5 w-32 hidden md:block"
      />

      {/* Reorder buttons */}
      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-text-muted hover:text-text-primary disabled:opacity-20 text-xs px-1"
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-text-muted hover:text-text-primary disabled:opacity-20 text-xs px-1"
          title="Move down"
        >
          ↓
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="text-text-muted hover:text-red-400 text-xs px-1 shrink-0 transition-colors"
        title="Delete milestone"
      >
        ×
      </button>
    </div>
  );
}
