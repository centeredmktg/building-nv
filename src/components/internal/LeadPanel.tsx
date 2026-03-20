"use client";

import { useState } from "react";
import { CRMProject, JobProject, STAGES } from "@/lib/crmTypes";
import { computeMargin } from "@/lib/projectFinancials";

type AnyProject = CRMProject | JobProject;

interface LeadPanelProps {
  project: AnyProject;
  onClose: () => void;
  onNotesUpdate: (id: string, notes: string) => void;
  onStageChange: (id: string, stage: string) => void;
  onTargetCostUpdate: (id: string, targetCostAmount: number) => void;
}

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0, ...opts });
}

export default function LeadPanel({
  project,
  onClose,
  onNotesUpdate,
  onStageChange,
  onTargetCostUpdate,
}: LeadPanelProps) {
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [targetCostDraft, setTargetCostDraft] = useState(
    project.targetCostAmount != null ? String(project.targetCostAmount) : ""
  );
  const [targetCostDirty, setTargetCostDirty] = useState(false);
  const [savingCost, setSavingCost] = useState(false);

  const date = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const saveNotes = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      onNotesUpdate(project.id, notes);
    }
    setSaving(false);
  };

  const handleStageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = e.target.value;
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    if (res.ok) {
      onStageChange(project.id, newStage);
    }
  };

  const handleTargetCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetCostDraft(e.target.value);
    setTargetCostDirty(true);
  };

  const handleTargetCostSave = async () => {
    const parsed = parseFloat(targetCostDraft);
    if (isNaN(parsed)) return;
    setSavingCost(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCostAmount: parsed }),
    });
    if (res.ok) {
      onTargetCostUpdate(project.id, parsed);
      setTargetCostDirty(false);
    }
    setSavingCost(false);
  };

  const targetCostNum = parseFloat(targetCostDraft);
  const margin = computeMargin(
    project.contractAmount,
    isNaN(targetCostNum) ? null : targetCostNum
  );

  return (
    <>
      <div className="fixed inset-0 bg-bg/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface border-l border-border z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-text-primary font-bold text-xl leading-tight pr-4">
              {project.name}
            </h2>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-2xl leading-none shrink-0"
            >
              ×
            </button>
          </div>

          {/* Stage selector */}
          <div className="mb-6">
            <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Stage</p>
            <select
              defaultValue={project.stage}
              onChange={handleStageChange}
              className="w-full bg-surface-2 border border-border rounded-sm px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent appearance-none"
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Financials */}
          <div className="mb-6">
            <p className="text-text-muted text-xs uppercase tracking-widest mb-3">Financials</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-text-muted text-xs">Customer Price</p>
                <p className="text-text-primary text-sm font-medium">
                  {project.contractAmount != null ? `$${fmt(project.contractAmount)}` : "—"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-text-muted text-xs shrink-0">Target Cost</p>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">$</span>
                    <input
                      type="number"
                      value={targetCostDraft}
                      onChange={handleTargetCostChange}
                      placeholder="—"
                      className="bg-surface-2 border border-border rounded-sm pl-5 pr-2 py-1 text-text-primary text-sm w-28 focus:outline-none focus:border-accent [appearance:textfield]"
                    />
                  </div>
                  {targetCostDirty && (
                    <button
                      onClick={handleTargetCostSave}
                      disabled={savingCost}
                      className="text-xs px-2 py-1 bg-accent text-bg rounded-sm hover:bg-accent/80 disabled:opacity-50 transition-colors"
                    >
                      {savingCost ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-text-muted text-xs">Margin $</p>
                <p className={`text-sm font-medium ${!margin ? "text-text-muted" : margin.dollars >= 0 ? "text-text-primary" : "text-red-400"}`}>
                  {margin != null ? `$${fmt(margin.dollars)}` : "—"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-text-muted text-xs">Margin %</p>
                <p className={`text-sm font-medium ${!margin ? "text-text-muted" : margin.percent >= 0 ? "text-text-primary" : "text-red-400"}`}>
                  {margin != null
                    ? `${fmt(margin.percent, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Contacts */}
          {project.projectContacts?.length > 0 && (
            <div className="mb-5">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Contacts</p>
              {project.projectContacts.map(({ contact, role }) => (
                <div key={contact.id} className="mb-3">
                  <p className="text-text-primary text-sm font-semibold">
                    {contact.firstName} {contact.lastName}
                    <span className="text-text-muted font-normal ml-2 text-xs">({role})</span>
                  </p>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="text-accent text-xs hover:underline block">
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="text-text-muted text-xs hover:underline block">
                      {contact.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Companies */}
          {project.projectCompanies?.length > 0 && (
            <div className="mb-5">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Companies</p>
              {project.projectCompanies.map(({ company, role }) => (
                <div key={company.id} className="mb-1">
                  <p className="text-text-primary text-sm">
                    {company.name}
                    <span className="text-text-muted ml-2 text-xs">({role})</span>
                  </p>
                  {company.domain && (
                    <p className="text-text-muted text-xs">{company.domain}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-col gap-3 mb-6">
            {project.projectType && <Field label="Project Type" value={project.projectType} />}
            <Field label="Submitted" value={date} />
            {project.message && <Field label="Message" value={project.message} multiline />}
          </div>

          {/* Notes */}
          <div>
            <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Internal Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={5}
              placeholder="Add notes..."
              className="w-full bg-surface-2 border border-border rounded-sm px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent transition-colors resize-none"
            />
            {saving && <p className="text-text-muted text-xs mt-1">Saving...</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-text-muted text-xs uppercase tracking-widest mb-1">{label}</p>
      {multiline ? (
        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-text-primary text-sm">{value}</p>
      )}
    </div>
  );
}
