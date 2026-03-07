"use client";

import { useState } from "react";
import { CRMProject, STAGES } from "@/lib/crmTypes";

interface LeadPanelProps {
  project: CRMProject;
  onClose: () => void;
  onNotesUpdate: (id: string, notes: string) => void;
  onStageChange: (id: string, stage: string) => void;
}

export default function LeadPanel({ project, onClose, onNotesUpdate, onStageChange }: LeadPanelProps) {
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saving, setSaving] = useState(false);
  const date = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    onNotesUpdate(project.id, notes);
    setSaving(false);
  };

  const handleStageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStage = e.target.value;
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    onStageChange(project.id, newStage);
  };

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
